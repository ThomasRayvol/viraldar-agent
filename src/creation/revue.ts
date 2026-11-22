/// <reference types="node" />
// La revue de création (21/11/2026, demandée par le propriétaire) : juger chaque contenu du jour à côté de son modèle,
// avec ce qu'il est censé tester sous les yeux (angle, série, déclencheur, variables, place du produit).
//
//   plancheComparaison   modèle | nous en une image : une ligne par côté (toutes les slides d'un carrousel, ou N
//                        images d'une vidéo), numérotées, et la lecture au-dessus et au-dessous ; composée pour un écran 16:9 (un long carrousel se replie en blocs). Rendue par
//                        Chrome (texte propre, accents, retours à la ligne) ; sans Chrome, ffmpeg seul, sans texte.
//   ajouterARevue        range la planche (et la vidéo côte à côte) dans <travail>/revue/<revue>/ sous un nom stable,
//                        avec sa fiche JSON, et refait la page index.html du dossier (toutes les planches, les vidéos,
//                        la lecture, « OK / à reprendre » et le bilan à recopier à l'agent)
//   revue_ouvrir         ouvre la revue là où l'utilisateur regarde : dans la conversation (Claude Desktop, claude.ai :
//                        les planches y sont rendues), sinon dans sa visionneuse d'images (imv, feh, Aperçu…) ; son lecteur
//                        vidéo (mpv, VLC…) s'il le demande ; la page dans le navigateur en dernier recours (21/11/2026, le
//                        propriétaire : « pas pratique », un agent l'avait choisie de lui-même) ; et donne la commande pour la
//                        rouvrir lui-même. Les retours se donnent dans la conversation.
//
// Sécurité : on ne lance que des programmes d'une liste fixe, ou celui que l'UTILISATEUR a réglé (VIRALDAR_VISIONNEUSE,
// VIRALDAR_LECTEUR ; jamais l'agent), sans shell, avec pour seuls arguments des fichiers du dossier de revue. Le texte
// de la lecture est échappé partout (page, planche). La planche contient le modèle : elle reste sur la machine.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { z } from "zod";
import type { Contexte, Module } from "../contexte.ts";
import { typeImage } from "../chemins.ts";
import { candidatsNavigateur, lancerNavigateur, nouvellePage } from "./apercu.ts";
import { dansLePath } from "./analyse.ts";
import { ErreurMontage, capture, ffmpeg } from "./montage.ts";

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---------------------------------------------------------------------------------------------
// La lecture : ce que le contenu est censé tester (les mots de la stratégie et du brief)

export const zLecture = z.object({
  angle: z.string().max(200).optional().describe("L'angle testé (son nom dans la stratégie)."),
  serie: z.string().max(200).optional().describe("La série / le format (ex. « 10/10 choses qui… », « parabole en 6 slides »)."),
  declencheur: z.string().max(200).optional().describe("Le déclencheur visé, en texte libre court (ex. « se reconnaître », « peur de rater »)."),
  variables: z.array(z.string().max(200)).max(8).optional().describe("Ce qui change par rapport au modèle (le sujet, les images, la chute…)."),
  produit: z.string().max(200).optional().describe("La place du produit (ex. « slide 4, écran verrouillé », « aucune »)."),
  note: z.string().max(400).optional().describe("Ce que l'utilisateur doit regarder en priorité, ou un doute."),
}).describe("Ce que le contenu est censé tester, mis en bandeau sous la ligne « nous » : angle, série, déclencheur, variables, place du produit. Reprends les mots de la stratégie et du brief (angle, format_vise, declencheur_vise du créneau).");
export type Lecture = z.infer<typeof zLecture>;

const CHAMPS: [keyof Lecture, string][] = [
  ["angle", "Angle"], ["serie", "Série"], ["declencheur", "Déclencheur"], ["variables", "Variables"], ["produit", "Place du produit"], ["note", "À regarder"],
];
const lectureVide = (l?: Lecture) => !l || CHAMPS.every(([k]) => { const v = l[k]; return Array.isArray(v) ? !v.length : !v?.trim(); });
const valeur = (l: Lecture, k: keyof Lecture) => { const v = l[k]; return Array.isArray(v) ? v.join(" · ") : (v ?? "").trim(); };
export const lectureTexte = (l?: Lecture) => lectureVide(l) ? "" : CHAMPS.filter(([k]) => valeur(l!, k)).map(([k, n]) => `${n} : ${valeur(l!, k)}`).join("\n");

// ---------------------------------------------------------------------------------------------
// La planche

export interface Ligne { etiquette: string; couleur: string; images: string[] }

export const navigateurPresent = () => candidatsNavigateur().some((x) => existsSync(x));

/** Modèle | nous en une image JPEG. `hauteur` : hauteur d'une image dans la planche. Rend vrai si le texte (étiquettes,
 *  bandeau) y est, faux si elle a été faite sans navigateur (ffmpeg seul, images nues). */
export async function plancheComparaison(lignes: Ligne[], lecture: Lecture | undefined, sortie: string, hauteur = 560): Promise<boolean> {
  if (navigateurPresent()) {
    try { await plancheChrome(lignes, lecture, sortie, hauteur); return true; } catch { /* repli ffmpeg */ }
  }
  await plancheFfmpeg(lignes, sortie, Math.min(hauteur, 480));
  return false;
}

// La planche se regarde en plein écran (imv, Aperçu…) : on la compose pour un écran 16:9. Le texte de la lecture va
// au-dessus (angle, série, déclencheur, place du produit) et au-dessous (variables, à regarder) des images, en grille,
// à une taille qui reste lisible une fois la planche réduite à l'écran ; un long carrousel se replie en plusieurs blocs
// modèle | nous (les slides 1 à 7, puis 8 à 14…), pour que les images restent grandes. On essaie chaque repli, on garde
// celui qui montre les images le plus grand.
const ECRAN = { l: 1920, h: 1080 };
const HAUT: (keyof Lecture)[] = ["angle", "serie", "declencheur", "produit"];
const BAS: (keyof Lecture)[] = ["variables", "note"];

async function plancheChrome(lignes: Ligne[], lecture: Lecture | undefined, sortie: string, hauteur: number) {
  const figures = await Promise.all(lignes.map((l) => Promise.all(l.images.map(async (p, i) => {
    const o = await readFile(p);
    return `<figure><img src="data:${typeImage(o.subarray(0, 16)) ?? "image/png"};base64,${o.toString("base64")}"><b>${i + 1}</b></figure>`;
  }))));
  const grille = (champs: (keyof Lecture)[], cls: string) => {
    const c = lectureVide(lecture) ? [] : CHAMPS.filter(([k]) => champs.includes(k) && valeur(lecture!, k));
    return c.length ? `<dl class="${cls}">${c.map(([k, n]) => `<div><dt>${n}</dt><dd>${echapper(valeur(lecture!, k))}</dd></div>`).join("")}</dl>` : "";
  };
  const haut = grille(HAUT, "haut"), bas = grille(BAS, "bas");
  const n = Math.max(...figures.map((f) => f.length));
  const html = (blocs: number) => {
    const par = Math.ceil(n / blocs);
    const corps: string[] = [haut];
    for (let b = 0; b < blocs; b++) {
      const de = b * par, a = Math.min(n, de + par);
      if (de >= n) break;
      corps.push(`<section>${lignes.map((l, i) => `<h2 style="color:${l.couleur}">${echapper(l.etiquette)}${blocs > 1 ? ` <i>${de + 1}–${a}</i>` : ""}</h2>`
        + `<div class="r">${figures[i]!.slice(de, a).join("")}</div>`).join("")}</section>`);
    }
    corps.push(bas);
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>
    *{margin:0;padding:0;box-sizing:border-box} :root{--f:28px}
    body{background:#1e1e1e;padding:calc(var(--f)*.6) calc(var(--f)*.7);width:max-content;color:#eee;font-family:system-ui,"Noto Sans","Helvetica Neue",Arial,sans-serif}
    h2{font-size:calc(var(--f)*1.15);font-weight:700;margin:calc(var(--f)*.25) 0 calc(var(--f)*.4)} h2 i{font-style:normal;opacity:.6;font-weight:400}
    section{width:max-content;margin:0 auto} section+section{margin-top:calc(var(--f)*.5);padding-top:calc(var(--f)*.5);border-top:2px solid #333}
    .r{display:flex;gap:14px;margin-bottom:calc(var(--f)*.4)}
    figure{position:relative;height:${hauteur}px;flex:none} img{display:block;height:100%;width:auto}
    figure b{position:absolute;left:0;bottom:0;background:#000;color:#ffcc00;font-size:30px;min-width:50px;padding:6px 12px;text-align:center}
    dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(calc(var(--f)*13),1fr));gap:calc(var(--f)*.4) calc(var(--f)*1.2);background:#111;border-left:6px solid #7CFC9A;padding:calc(var(--f)*.5) calc(var(--f)*.8)}
    dl.haut{margin-bottom:calc(var(--f)*.5)} dl.bas{margin-top:calc(var(--f)*.2)}
    dt{font-size:calc(var(--f)*.62);text-transform:uppercase;letter-spacing:.06em;color:#9a9aa2;margin-bottom:.2em} dd{font-size:var(--f);line-height:1.3}
    </style></head><body>${corps.join("")}</body></html>`;
  };
  const nav = await lancerNavigateur();
  try {
    const page = await nouvellePage(nav, 800, 600);
    // Mise en page : la police vise ~18 px une fois la planche à l'écran. La grille de texte prend au moins la largeur
    // des images ; quand elles sont moins larges que l'écran (un carrousel court), le texte s'élargit (moins de lignes,
    // donc moins de hauteur) et les images se centrent dessous : on essaie plusieurs largeurs, on garde celle qui montre
    // les images le plus grand. (24/11/2026 : la largeur des images se mesure sur les figures ; mesurée sur la rangée,
    // elle prenait la largeur du texte sur une ligne, et un carrousel de 6 laissait un grand vide à droite.)
    const composer = async (blocs: number, force?: number) => {
      await page.setContent(html(blocs), { waitUntil: "load" });
      return page.evaluate(([el, eh, f]) => {
        const rangs = [...document.querySelectorAll<HTMLElement>(".r")];
        const large = (r: HTMLElement) => {
          const fs = [...r.querySelectorAll<HTMLElement>("figure")];
          return fs.length ? fs[fs.length - 1]!.getBoundingClientRect().right - fs[0]!.getBoundingClientRect().left : 0;
        };
        const l = Math.max(...rangs.map(large));
        const essayer = (k: number) => {
          for (const d of document.querySelectorAll<HTMLElement>("dl")) d.style.width = `${Math.round(l * k)}px`;
          // Deux passes : l'échelle à l'écran dépend de la hauteur, qui dépend de la police.
          for (let i = 0; i < 2; i++) {
            const W = document.body.scrollWidth, H = document.body.scrollHeight;
            const ech = Math.min(el / W, eh / H);
            document.documentElement.style.setProperty("--f", `${Math.max(24, Math.min(56, Math.round(18 / ech)))}px`);
          }
          const W = document.body.scrollWidth, H = document.body.scrollHeight;
          return { k, l: W, h: H, img: rangs[0]!.getBoundingClientRect().height * Math.min(el / W, eh / H) };
        };
        if (f) return essayer(f);
        let mieux = essayer(1);
        for (const k of [1.15, 1.3, 1.5, 1.75, 2, 2.5, 3]) {
          const r = essayer(k);
          if (r.img > mieux.img * 1.01) mieux = r;
        }
        return mieux;
      }, [ECRAN.l, ECRAN.h, force ?? 0] as const);
    };
    let mieux = { blocs: 1, k: 1, img: -1 };
    for (let blocs = 1; blocs <= Math.min(4, n); blocs++) {
      if (blocs > 1 && Math.ceil(n / blocs) === Math.ceil(n / (blocs - 1))) continue;
      const r = await composer(blocs);
      if (r.img > mieux.img * 1.03) mieux = { blocs, k: r.k, img: r.img };
    }
    const t = await composer(mieux.blocs, mieux.k);
    await page.setViewportSize({ width: Math.ceil(t.l), height: Math.ceil(t.h) });
    await page.screenshot({ path: sortie, type: "jpeg", quality: 85, fullPage: true });
  } finally {
    await nav.close();
  }
}

/** Sans navigateur : ffmpeg seul, une case par image (même taille pour toutes), une ligne par côté. */
async function plancheFfmpeg(lignes: Ligne[], sortie: string, h: number) {
  const tmp = await mkdtemp(join(tmpdir(), "viraldar-revue-"));
  try {
    const l = 2 * Math.round((h * 3) / 8); // 3:4 par défaut : la case la plus courante (carrousel, image de vidéo 9:16 y tient)
    const colonnes = Math.max(...lignes.map((x) => x.images.length));
    let k = 0;
    for (const ligne of lignes) for (let i = 0; i < colonnes; i++, k++) {
      const c = join(tmp, `c-${String(k).padStart(3, "0")}.png`);
      const src = ligne.images[i];
      if (src) await ffmpeg(["-i", src, "-frames:v", "1", "-vf",
        `scale=${l}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${l}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x202024,setsar=1`, c]);
      else await ffmpeg(["-f", "lavfi", "-i", `color=c=0x202024:s=${l}x${h}`, "-frames:v", "1", c]);
    }
    await ffmpeg(["-framerate", "1", "-i", "c-%03d.png", "-vf", `tile=${colonnes}x${lignes.length}:padding=6:margin=6:color=0x101012`,
      "-frames:v", "1", "-q:v", "3", "-map_metadata", "-1", sortie], tmp);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------------------------
// Le dossier de revue

export const zRevue = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/, "un nom court : la date (AAAA-MM-JJ) ou lettres, chiffres, . _ -")
  .describe("Le dossier de revue où ranger aussi la comparaison, sous un nom stable (refaire écrase) : en général le jour de publication, AAAA-MM-JJ. "
    + "Tout le lot d'un jour dans le même dossier ; `revue_ouvrir` l'ouvre ensuite d'un coup.");

interface Fiche { nom: string; titre: string; modele: string; genre: "carrousel" | "video"; lecture?: Lecture; planche: string; video?: string; texte: boolean; fait_le: string }

const nomStable = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "contenu";

export const dossierRevue = (ctx: Contexte, revue: string) => join(ctx.dossierTravail, "revue", revue);

export async function ajouterARevue(ctx: Contexte, revue: string, f: Omit<Fiche, "planche" | "video" | "fait_le" | "nom"> & { nom: string; planche: string; video?: string }): Promise<string> {
  const dossier = dossierRevue(ctx, revue);
  await mkdir(dossier, { recursive: true });
  const nom = nomStable(f.nom);
  await copyFile(f.planche, join(dossier, `${nom}.jpg`));
  if (f.video) await copyFile(f.video, join(dossier, `${nom}.mp4`));
  else await rm(join(dossier, `${nom}.mp4`), { force: true });
  const fiche: Fiche = { ...f, nom, planche: `${nom}.jpg`, video: f.video ? `${nom}.mp4` : undefined, fait_le: new Date().toISOString() };
  await writeFile(join(dossier, `${nom}.json`), JSON.stringify(fiche, null, 2) + "\n", "utf8");
  await ecrirePage(dossier, revue);
  return dossier;
}

async function fiches(dossier: string): Promise<Fiche[]> {
  const noms = (await readdir(dossier).catch(() => [] as string[])).filter((x) => x.endsWith(".json")).sort();
  const r: Fiche[] = [];
  for (const n of noms) try { r.push(JSON.parse(await readFile(join(dossier, n), "utf8")) as Fiche); } catch { /* fiche illisible : sautée */ }
  return r.filter((x) => x && typeof x.planche === "string" && existsSync(join(dossier, basename(x.planche))));
}

/** index.html du dossier : une section par contenu, lecture en tête, planche (clic : taille réelle), vidéo côte à
 *  côte ; ← → (ou j k) d'un contenu à l'autre ; « OK » / « À reprendre » + un mot, gardés dans ce navigateur ; le bilan
 *  à recopier à l'agent. Aucune ressource extérieure. */
async function ecrirePage(dossier: string, revue: string) {
  const liste = await fiches(dossier);
  const sections = liste.map((f, i) => {
    const lec = lectureVide(f.lecture) ? "" : `<dl>${CHAMPS.filter(([k]) => valeur(f.lecture!, k)).map(([k, n]) =>
      `<div><dt>${n}</dt><dd>${echapper(valeur(f.lecture!, k))}</dd></div>`).join("")}</dl>`;
    const p = encodeURIComponent(basename(f.planche));
    return `<section id="c${i}" data-nom="${echapper(f.nom)}"><header><h2><span>${i + 1}/${liste.length}</span> ${echapper(f.titre)}</h2>
<p>modèle : ${echapper(f.modele)} · ${f.genre === "video" ? "vidéo" : "carrousel"}</p></header>${lec}
<a href="${p}" target="_blank"><img src="${p}" alt="" loading="lazy"></a>
${f.video ? `<video src="${encodeURIComponent(basename(f.video))}" controls loop preload="metadata"></video>` : ""}
<div class="v"><button data-v="ok">OK</button><button data-v="reprendre">À reprendre</button><input placeholder="ce qui ne va pas (facultatif)"></div></section>`;
  }).join("\n");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' file:; media-src 'self' file:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>Revue ${echapper(revue)} – viraldar</title><style>
:root{color-scheme:dark} *{box-sizing:border-box} body{margin:0;background:#0c111c;color:#eef1f7;font:16px/1.45 system-ui,sans-serif}
.haut{position:sticky;top:0;z-index:2;background:#0c111ce8;backdrop-filter:blur(6px);display:flex;gap:16px;align-items:center;padding:10px 16px;border-bottom:1px solid #252c3a}
.haut h1{font-size:18px;margin:0;flex:1} .haut small{color:#9aa3b5} button{font:inherit;cursor:pointer;border:1px solid #3a4356;background:#161d2b;color:inherit;border-radius:6px;padding:6px 12px}
section{padding:18px 16px 28px;border-bottom:1px solid #252c3a;scroll-margin-top:56px} h2{font-size:20px;margin:0} h2 span{color:#c6f432} header p{margin:2px 0 10px;color:#9aa3b5}
dl{display:flex;flex-wrap:wrap;gap:6px 28px;margin:0 0 12px;padding:10px 14px;background:#141b29;border-left:4px solid #7CFC9A} dt{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#9aa3b5} dd{margin:0}
img{max-width:100%;height:auto;display:block;border-radius:4px} video{display:block;max-width:100%;max-height:80vh;margin-top:12px;background:#000}
.v{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap} .v input{flex:1;min-width:200px;font:inherit;background:#161d2b;color:inherit;border:1px solid #3a4356;border-radius:6px;padding:6px 10px}
section.ok button[data-v=ok]{background:#2f6fdb;border-color:#2f6fdb} section.reprendre button[data-v=reprendre]{background:#c0392b;border-color:#c0392b}
section.ok h2::after{content:" ✓";color:#7CFC9A} section.reprendre h2::after{content:" ↺";color:#ff8a7a}
pre{white-space:pre-wrap;background:#141b29;padding:12px;margin:0 16px 24px;border-radius:6px}
</style></head><body>
<div class="haut"><h1>Revue ${echapper(revue)} <small>· ${liste.length} contenu${liste.length > 1 ? "s" : ""} · ← → pour passer de l'un à l'autre</small></h1><button id="bilan">Copier le bilan pour l'agent</button></div>
${sections || "<p style='padding:16px'>Aucune comparaison dans ce dossier.</p>"}
<pre id="sortie" hidden></pre>
<script>
const CLE = "viraldar-revue-" + ${JSON.stringify(revue)};
const S = document.querySelectorAll("section");
let etat = {}; try { etat = JSON.parse(localStorage.getItem(CLE) || "{}"); } catch {}
const garder = () => { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch {} };
S.forEach((s) => {
  const n = s.dataset.nom, e = etat[n] || {}, champ = s.querySelector("input");
  if (e.v) s.classList.add(e.v); champ.value = e.mot || "";
  s.querySelectorAll("button").forEach((b) => b.onclick = () => {
    s.classList.remove("ok", "reprendre"); const v = (etat[n] || {}).v === b.dataset.v ? "" : b.dataset.v;
    if (v) s.classList.add(v); etat[n] = { ...(etat[n] || {}), v }; garder();
  });
  champ.oninput = () => { etat[n] = { ...(etat[n] || {}), mot: champ.value }; garder(); };
});
let i = 0;
addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.key === "ArrowRight" || e.key === "j") i = Math.min(S.length - 1, i + 1); else if (e.key === "ArrowLeft" || e.key === "k") i = Math.max(0, i - 1); else return;
  e.preventDefault(); S[i].scrollIntoView({ behavior: "smooth" });
});
document.getElementById("bilan").onclick = async () => {
  const t = "Revue " + ${JSON.stringify(revue)} + " :\\n" + [...S].map((s) => { const e = etat[s.dataset.nom] || {};
    return "- " + s.dataset.nom + " : " + (e.v === "ok" ? "OK" : e.v === "reprendre" ? "à reprendre" : "pas vu") + (e.mot ? " — " + e.mot : ""); }).join("\\n");
  const o = document.getElementById("sortie"); o.textContent = t; o.hidden = false;
  try { await navigator.clipboard.writeText(t); document.getElementById("bilan").textContent = "Copié ✓"; } catch { o.scrollIntoView(); }
};
</script></body></html>
`;
  await writeFile(join(dossier, "index.html"), html, "utf8");
}

// ---------------------------------------------------------------------------------------------
// Ouvrir : visionneuses et lecteurs trouvés, jamais installés

type Os = "darwin" | "win32" | "linux";
const OS: Os = process.platform === "darwin" || process.platform === "win32" ? process.platform : "linux";

// Visionneuses qui prennent plusieurs images d'un coup et passent de l'une à l'autre.
const VISIONNEUSES = ["imv", "imv-wayland", "imv-x11", "nsxiv", "sxiv", "feh", "qimgv", "loupe", "eog", "eom", "gwenview", "ristretto", "gthumb", "nomacs", "geeqie", "IrfanView", "i_view64"];
const LECTEURS = ["mpv", "celluloid", "vlc", "haruna", "totem", "smplayer", "iina", "mpv.net"];

/** Le programme réglé par l'utilisateur (nom ou chemin, avec ses options éventuelles), ou le premier trouvé. */
function programme(variable: string, liste: string[]): { exe: string; args: string[] } | null {
  const regle = (process.env[variable] || "").trim();
  if (regle) {
    const [p, ...args] = regle.split(/\s+/);
    const exe = existsSync(p!) ? p! : dansLePath([p!]);
    if (exe) return { exe, args };
  }
  const exe = dansLePath(liste);
  return exe ? { exe, args: [] } : null;
}

export const visionneuse = () => programme("VIRALDAR_VISIONNEUSE", VISIONNEUSES);
export const lecteur = () => programme("VIRALDAR_LECTEUR", LECTEURS);

/** Ce que ma_machine dit de la revue. */
export function resumeVisionneuses(): string {
  const v = visionneuse(), l = lecteur();
  const sys = OS === "darwin" ? "Aperçu et QuickTime (macOS)" : OS === "win32" ? "les apps par défaut de Windows" : "xdg-open";
  return `images : ${v ? v.exe : `aucune visionneuse reconnue (${sys} ou le navigateur)`} ; vidéos : ${l ? l.exe : `aucun lecteur reconnu (${sys} ou le navigateur)`}`;
}

function lancer(exe: string, args: string[]) {
  const p = spawn(exe, args, { detached: true, stdio: "ignore", windowsHide: false });
  p.on("error", () => {}); p.unref();
}

const citer = (s: string) => OS === "win32" ? `"${s}"` : /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
/** La commande telle qu'il la taperait : le nom seul quand le programme est dans son PATH. */
const commande = (exe: string, args: string[]) => [basename(exe) === exe || dansLePath([basename(exe)]) === exe ? basename(exe) : citer(exe), ...args.map(citer)].join(" ");

function ouvrirParDefaut(fichiers: string[]): string {
  if (OS === "darwin") { lancer("open", fichiers); return commande("open", fichiers); }
  if (OS === "win32") { lancer("explorer.exe", [fichiers[0]!]); return commande("start", [fichiers[0]!]); }
  lancer("xdg-open", [fichiers[0]!]); return commande("xdg-open", [fichiers[0]!]);
}

const AVEC = ["auto", "conversation", "images", "videos", "navigateur"] as const;

export const outilsRevue: Module = (serveur, ctx) => {
  serveur.registerTool("revue_ouvrir", {
    title: "Ouvrir la revue des contenus",
    description:
      "Ouvre les comparaisons modèle | nous d'un dossier de revue (celles rangées par `montage_comparaison` avec `revue`), pour que "
      + "l'utilisateur juge tout le lot d'un coup ; il te donne ses retours ICI, dans la conversation, contenu par contenu. "
      + "N'indique PAS `avec` : le défaut choisit pour lui (les planches rendues dans la conversation sous Claude Desktop ou claude.ai ; "
      + "ailleurs sa visionneuse d'images — imv, feh, Aperçu… ou celle qu'il a réglée —, plein écran, une planche après l'autre ; "
      + "le navigateur seulement s'il n'a aucune visionneuse). `avec` seulement s'il le demande : videos (son lecteur : mpv, VLC…, "
      + "les vidéos côte à côte), images, conversation, navigateur (une page de secours). Rend aussi la commande pour qu'il la "
      + "rouvre lui-même. Ne lance rien d'autre que ces programmes, sur ces fichiers.",
    inputSchema: {
      revue: zRevue.optional().describe("Le dossier de revue (AAAA-MM-JJ…) ; par défaut le plus récent."),
      avec: z.enum(AVEC).optional().describe("Où ouvrir (auto par défaut)."),
    },
    annotations: { readOnlyHint: true },
  }, capture(async (a) => {
    const racine = join(ctx.dossierTravail, "revue");
    let revue = a.revue as string | undefined;
    if (!revue) {
      const d = (await readdir(racine, { withFileTypes: true }).catch(() => [])).filter((x) => x.isDirectory()).map((x) => x.name).sort();
      revue = d.pop();
      if (!revue) throw new ErreurMontage(`Aucune revue dans ${racine} : fais d'abord les comparaisons avec montage_comparaison et \`revue\` (ex. la date de publication).`);
    }
    const dossier = dossierRevue(ctx, revue);
    const liste = await fiches(dossier);
    if (!liste.length) throw new ErreurMontage(`Aucune comparaison dans ${dossier}.`);
    await ecrirePage(dossier, revue);
    const planches = liste.map((f) => join(dossier, basename(f.planche)));
    const videos = liste.filter((f) => f.video && existsSync(join(dossier, basename(f.video)))).map((f) => join(dossier, basename(f.video!)));
    const page = join(dossier, "index.html");
    const client = (serveur.server.getClientVersion()?.name ?? "").toLowerCase();
    const bureau = /claude-ai|claude desktop|claude\.ai/.test(client);
    let avec = (a.avec ?? "auto") as typeof AVEC[number];
    if (avec === "auto") avec = bureau ? "conversation" : visionneuse() ? "images" : "navigateur";

    const lignes = [`Revue ${revue} : ${liste.length} contenu(s) dans ${dossier}.`];
    for (const f of liste) {
      const l = lectureTexte(f.lecture);
      lignes.push(`- ${f.nom} (${f.genre}, modèle ${f.modele})${l ? ` — ${l.replace(/\n/g, " ; ")}` : " — sans lecture : ajoute-la (paramètre lecture) pour juger angle, série, déclencheur, variables"}`);
    }
    const contenu: ({ type: "text"; text: string } | { type: "image"; data: string; mimeType: string })[] = [];
    if (avec === "conversation") {
      lignes.push("", "Les planches suivent, dans l'ordre (en haut le modèle, en bas nous, la lecture dessous).",
        `Pour les regarder en grand : la page ${page} dans son navigateur${visionneuse() ? `, ou \`${commande(visionneuse()!.exe, [...visionneuse()!.args, ...planches])}\`` : ""}.`);
      const tmp = await mkdtemp(join(tmpdir(), "viraldar-revue-"));
      try {
        for (const [i, p] of planches.slice(0, 12).entries()) {
          const r = join(tmp, `${i}.jpg`);
          await ffmpeg(["-i", p, "-vf", "scale='min(1600,iw)':-2", "-frames:v", "1", "-q:v", "4", "-map_metadata", "-1", r]);
          contenu.push({ type: "image", data: (await readFile(r)).toString("base64"), mimeType: "image/jpeg" });
        }
      } finally { await rm(tmp, { recursive: true, force: true }); }
      if (planches.length > 12) lignes.push(`(12 planches montrées sur ${planches.length} : la suite dans la page.)`);
    } else if (avec === "images") {
      const v = visionneuse();
      const cmd = v ? (lancer(v.exe, [...v.args, ...planches]), commande(v.exe, [...v.args, ...planches])) : ouvrirParDefaut(planches);
      lignes.push("", `Ouvert dans ${v ? basename(v.exe) : "la visionneuse par défaut"}, une planche après l'autre. Pour la rouvrir lui-même : \`${cmd}\`. `
        + "Attends ses retours ici, contenu par contenu, et reprends ce qu'il signale.");
    } else if (avec === "videos") {
      if (!videos.length) throw new ErreurMontage("Aucune vidéo côte à côte dans cette revue (un carrousel n'en a pas) : `avec: images` ou `navigateur`.");
      const l = lecteur();
      const cmd = l ? (lancer(l.exe, [...l.args, ...videos]), commande(l.exe, [...l.args, ...videos])) : ouvrirParDefaut(videos);
      lignes.push("", `${videos.length} vidéo(s) côte à côte ouvertes dans ${l ? basename(l.exe) : "le lecteur par défaut"} (modèle à gauche, nous à droite). Pour les rouvrir : \`${cmd}\``);
    } else {
      const cmd = ouvrirParDefaut([page]);
      lignes.push("", `Page ouverte dans le navigateur (aucune visionneuse d'images trouvée). Pour la rouvrir : \`${cmd}\`. Ses retours viennent ici ; `
        + "s'il préfère une visionneuse, il en installe une (imv, feh…) ou règle la sienne (réglage « visionneuse »).");
    }
    lignes.push("La revue contient les modèles : elle reste sur cette machine, jamais envoyée ni publiée.");
    return { content: [{ type: "text" as const, text: lignes.join("\n") }, ...contenu] };
  }));
};
