// Carrousels TikTok : un JSON décrit les diapositives (le texte et les choix viennent de l'agent de
// l'utilisateur), ce module les rend en images avec un Chromium headless (playwright-core).
// Les modèles (CSS, descriptions, exemples) et les polices libres (OFL) sont dans modeles/carrousel/ ;
// rien n'est chargé depuis le réseau au rendu : polices et images sont embarquées en data: URI, et
// toute requête de la page est coupée.
//
// Formats (doc TikTok, vérifiée le 10/11/2026) : un post photo prend 1 à 35 images (API Content
// Posting : `photo_images`, 35 au plus) ; l'API n'accepte que JPEG et WebP, 1080p au plus, 20 Mo
// par image — d'où la sortie `jpeg` pour un envoi en brouillon par l'API, `png` sinon.
// Formats et zones sûres : modeles/zones-sures.json (lu par ./zones.ts), la même source que le montage. Une image
// s'affiche à la largeur de l'écran, centrée en hauteur ; la zone du cas choisi (avec ou sans description, pub) y est
// reportée, le texte est posé dedans, puis chaque ligne de texte rendue est vérifiée contre elle.
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { Page } from "playwright-core";
import type { Contexte, Module } from "../contexte.ts";
import { sousRacine } from "../racine.ts";
import { EXT_IMAGES, cheminLu, telechargerImage, typeImage } from "../chemins.ts";
import { NOMS_FORMATS, ZONES, descriptionCas, verifier, zCas, zonePour, type Rect } from "./zones.ts";
import { lancerNavigateur, nouvellePage, planche } from "./apercu.ts";

const DOSSIER_MODELES = sousRacine("modeles/carrousel/");
const MAX_DIAPOSITIVES = 35;
const K_MIN = 0.55;              // le texte ne rétrécit pas sous 55 % de sa taille prévue
const TAILLE_LISIBLE = 36;       // px sur 1080 de large ≈ 13 pt sur un téléphone : en dessous, on prévient

const FORMATS: Record<string, { l: number; h: number }> = Object.fromEntries(
  Object.entries(ZONES.formats).map(([nom, f]) => [nom, { l: f.largeur, h: f.hauteur }]));
type Format = string;

const POLICES = { archivo: "Archivo", lora: "Lora", caveat: "Caveat", tiktok: "TikTok Sans" } as const;
const NOMS_POLICES = ["archivo", "lora", "caveat", "tiktok"] as const;
const NOMS_MODELES = ["citation", "liste", "notes", "contraste", "ecran", "revelation", "natif"] as const;
// Étalonnage commun à toutes les photos d'un carrousel : c'est ce qui fait d'images disparates une série.
const ETALONNAGES = {
  aucun: "saturate(1)", sombre: "brightness(.72) contrast(1.06)", chaud: "sepia(.22) saturate(1.15) hue-rotate(-6deg)",
  froid: "saturate(.88) hue-rotate(10deg) brightness(.96)", noir_et_blanc: "grayscale(1) contrast(1.15)",
  sepia: "sepia(.65) contrast(1.05) brightness(.95)", doux: "contrast(.88) saturate(.85) brightness(1.04)",
} as const;
type NomModele = (typeof NOMS_MODELES)[number];

// ---------- le format JSON ----------

const zImage = z.string().describe("Image : chemin local ou URL https");
const zBloc = z.object({
  etiquette: z.string().optional(), texte: z.string().optional(), image: zImage.optional(), note: z.string().optional(),
});
const zDiapo = z.object({
  etiquette: z.string().optional().describe("Petit badge en capitales au-dessus du titre"),
  titre: z.string().optional(),
  texte: z.string().optional().describe("Corps de texte. **gras**, ==surligné==, retours à la ligne \\n"),
  liste: z.array(z.string()).optional().describe("Puces. notes/ecran : « [ ] » case vide, « [x] » cochée ; ecran : « * » carte en vedette"),
  citation: z.string().optional(),
  auteur: z.string().optional(),
  date: z.string().optional().describe("notes : la ligne de date en haut de la page"),
  numero: z.union([z.number(), z.string(), z.literal(false)]).optional().describe("liste : numéro forcé, ou false pour ne pas numéroter"),
  image: zImage.optional(),
  image_large: z.boolean().optional().describe("revelation (dernière) : l'image en pleine largeur au lieu d'une vignette carrée"),
  avant: zBloc.optional().describe("contraste : la moitié du haut (mythe, avant)"),
  apres: zBloc.optional().describe("contraste : la moitié du bas (réalité, après)"),
  note: z.string().optional().describe("Petite ligne en bas (source, appel à l'action)"),
  fond: z.string().optional().describe("Couleur de fond de cette diapositive seulement"),
  position: z.enum(["haut", "centre", "bas"]).optional().describe("natif : où poser le bloc de texte dans la zone sûre (centre par défaut ; garder la même sur toute la série)"),
});
const zTheme = z.object({
  fond: z.string().optional(), texte: z.string().optional(), accent: z.string().optional(), accent2: z.string().optional(),
  fond_haut: z.string().optional(), texte_haut: z.string().optional(),
  police_titre: z.enum(NOMS_POLICES).optional().describe("tiktok = TikTok Sans, la police de l'éditeur de texte de TikTok"),
  police_texte: z.enum(NOMS_POLICES).optional(),
  flou: z.number().min(0).max(60).optional().describe("Flou des photos de fond, en px (0 = nette)"),
  etalonnage: z.enum(Object.keys(ETALONNAGES) as [keyof typeof ETALONNAGES]).optional()
    .describe("Commun à toutes les photos (pas aux captures)"),
});
const zCarrousel = {
  nom: z.string().min(1).describe("Nom du carrousel : le dossier de sortie (carrousels/<nom>/)"),
  modele: z.enum(NOMS_MODELES),
  variante: z.string().optional().describe("notes : « app » (par défaut) ou « papier » ; natif : « bandeau » (par défaut), « contour » ou « bandeau_noir »"),
  format: z.enum(NOMS_FORMATS).default("9:16").describe(
    "9:16 plein écran ; 3:4 presque entier sous une description ; 4:5 toujours entier"),
  zone: zCas.optional(),
  sortie: z.enum(["png", "jpeg"]).default("png").describe("jpeg pour l'API TikTok"),
  langue: z.string().default("fr"),
  signature: z.string().optional().describe("@compte affiché discrètement en haut de chaque diapositive"),
  numerotation: z.boolean().default(false).describe("Affiche 2/7 en haut à droite"),
  theme: zTheme.optional().describe("Couleurs (CSS) et polices ; chaque modèle a les siennes par défaut"),
  diapositives: z.array(zDiapo).min(1).max(MAX_DIAPOSITIVES),
};
type Diapo = z.infer<typeof zDiapo>;
type Bloc = z.infer<typeof zBloc>;
type Theme = z.infer<typeof zTheme>;
type Carrousel = z.infer<z.ZodObject<typeof zCarrousel>>;

interface FicheModele {
  description: string; quand: string; champs: string; image: string;
  theme: Required<Pick<Theme, "fond" | "texte" | "accent">> & Theme;
  variantes: Record<string, string>; exemple: unknown;
}

// ---------- fichiers des modèles ----------

const cache = new Map<string, string>();
async function lireModele(nom: string): Promise<string> {
  if (!cache.has(nom)) cache.set(nom, await readFile(new URL(nom, DOSSIER_MODELES), "utf8"));
  return cache.get(nom)!;
}
async function fiches(): Promise<Record<NomModele, FicheModele>> {
  return JSON.parse(await lireModele("modeles.json"));
}

const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT = "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";
let policesCss: Promise<string> | undefined;
function polices(): Promise<string> {
  policesCss ??= (async () => {
    const faces: [string, string, string, string][] = [   // famille, fichier, style, graisses
      ["Archivo", "archivo", "normal", "100 900"], ["Lora", "lora", "normal", "400 700"],
      ["Lora", "lora-italic", "italic", "400 700"], ["Caveat", "caveat", "normal", "400 700"],
      ["TikTok Sans", "tiktok", "normal", "300 900"],
    ];
    const css: string[] = [];
    for (const [famille, fichier, style, graisse] of faces) {
      for (const [jeu, plage] of [["latin", LATIN], ["latin-ext", LATIN_EXT]]) {
        const b64 = (await readFile(new URL(`polices/${fichier}-${jeu}.woff2`, DOSSIER_MODELES))).toString("base64");
        css.push(`@font-face{font-family:"${famille}";font-style:${style};font-weight:${graisse};font-display:block;` +
          `src:url(data:font/woff2;base64,${b64}) format("woff2");unicode-range:${plage};}`);
      }
    }
    return css.join("\n");
  })();
  return policesCss;
}

// ---------- images ----------

const IMAGE_MAX = 25 * 1024 * 1024;
const EXT_CARROUSEL = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"];

/** Une image (chemin local ou URL publique) → data: URI. Le type vient du contenu, jamais d'un en-tête ni d'un nom :
 *  rien de ce qui arrive ici n'est recopié tel quel dans le HTML. */
async function imageEnDataUri(source: string, travail: string): Promise<string> {
  if (/^https?:\/\//i.test(source)) {
    const { type, octets } = await telechargerImage(source, IMAGE_MAX);
    return `data:${type};base64,${octets.toString("base64")}`;
  }
  const chemin = await cheminLu(source, { travail, extensions: EXT_CARROUSEL, quoi: "Image", image: true });
  const octets = await readFile(chemin);
  if (octets.length > IMAGE_MAX) throw new Error(`${source} : image trop lourde (> 25 Mo)`);
  return `data:${typeImage(octets.subarray(0, 16))};base64,${octets.toString("base64")}`;
}

// ---------- HTML ----------

function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
/** Texte de l'agent → HTML sûr : **gras**, ==surligné==, \n. Rien d'autre n'est interprété. */
function enrichir(s: string): string {
  return echapper(s.trim())
    .replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>")
    .replace(/==(.+?)==/gs, "<mark>$1</mark>")
    .replace(/\r?\n/g, "<br>");
}
const attrUrl = (uri: string) => `background-image:url('${uri}')`;

/** Typographie : apostrophe courbe partout ; en français, espace fine insécable avant ? ! ; : et dans « ». */
function typographier(s: string, francais: boolean): string {
  let t = s.replace(/(\p{L})'(?=\p{L})/gu, "$1’");
  if (francais) t = t.replace(/ +([?!;:»])/g, " $1").replace(/« +/g, "« ");
  return t;
}
function typographierCarrousel(c: Carrousel): Carrousel {
  const fr = c.langue.toLowerCase().startsWith("fr");
  const passer = (v: unknown, cle?: string): unknown => {
    if (typeof v === "string") return cle === "image" || cle === "fond" ? v : typographier(v, fr);
    if (Array.isArray(v)) return v.map((x) => passer(x));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, passer(x, k)]));
    return v;
  };
  return { ...c, diapositives: passer(c.diapositives) as Diapo[] };
}

function puceListe(item: string): { classe: string; texte: string } {
  const m = item.match(/^\s*\[( |x|X)\]\s*/);
  if (m) return { classe: m[1] === " " ? "case" : "case cochee", texte: item.slice(m[0].length) };
  const v = item.match(/^\s*\*\s+/);
  if (v) return { classe: "vedette", texte: item.slice(v[0].length) };
  return { classe: "", texte: item };
}

function liste(items: string[], ordonnee: boolean): string {
  return `<ul class="liste">${items.map((it, i) => {
    const { classe, texte } = puceListe(it);
    const puce = classe.startsWith("case") ? "" : ordonnee ? `${i + 1}.` : "•";
    return `<li class="${classe}" data-puce="${puce}">${enrichir(texte)}</li>`;
  }).join("")}</ul>`;
}

/** Les blocs communs, dans l'ordre de lecture. */
function blocs(d: Diapo, o: { illustration?: string; listeOrdonnee?: boolean; sansEtiquette?: boolean } = {}): string {
  const h: string[] = [];
  if (d.etiquette && !o.sansEtiquette) h.push(`<div class="etiquette">${enrichir(d.etiquette)}</div>`);
  if (o.illustration) h.push(`<div class="illustration" style="${attrUrl(o.illustration)}"></div>`);
  if (d.titre) h.push(`<h1 class="titre">${enrichir(d.titre)}</h1>`);
  if (d.citation) h.push(`<blockquote class="citation">${enrichir(d.citation)}</blockquote>`);
  if (d.auteur) h.push(`<div class="auteur">— ${enrichir(d.auteur)}</div>`);
  if (d.texte) h.push(`<p class="texte">${enrichir(d.texte)}</p>`);
  if (d.liste?.length) h.push(liste(d.liste, !!o.listeOrdonnee));
  if (d.note) h.push(`<p class="note">${enrichir(d.note)}</p>`);
  return h.join("");
}

function fondImage(uri: string | undefined, flou: boolean): string {
  return uri ? `<div class="fond-image${flou ? " flou" : ""}" style="${attrUrl(uri)}"></div><div class="voile"></div>` : "";
}

interface Rendu { corps: string; classes: string[] }
type Images = Map<string, string>;       // source → data: URI
const img = (images: Images, s?: string) => (s ? images.get(s) : undefined);

const MODELES: Record<NomModele, (d: Diapo, i: number, n: number, c: Carrousel, images: Images) => Rendu> = {
  citation(d, _i, _n, c, images) {
    const fond = img(images, d.image);
    const flou = (c.theme?.flou ?? 14) > 0;
    const guillemet = d.citation ? `<div class="guillemet">“</div>` : "";
    const filet = d.titre && !d.citation ? `<div class="filet"></div>` : "";
    return {
      classes: fond ? ["sur-image", "centree"] : ["centree"],
      corps: `${fondImage(fond, flou)}<div class="zone centre">${guillemet}${blocs(d)}${filet}</div>`,
    };
  },
  liste(d, i, _n, c, images) {
    const ill = img(images, d.image);
    if (i === 0) return { classes: ["premiere"], corps: `<div class="bande"></div><div class="zone">${blocs(d, { illustration: ill })}</div>` };
    let numero: string | number | false;
    if (d.numero !== undefined) numero = d.numero;
    else numero = c.diapositives.slice(1, i + 1).filter((x) => x.numero === undefined).length;
    const num = numero === false ? "" : `<div class="numero">${echapper(String(numero))}</div>`;
    return { classes: [], corps: `<div class="zone">${num}${blocs(d, { illustration: ill, listeOrdonnee: false })}</div>` };
  },
  notes(d, _i, _n, c, images) {
    const papier = c.variante === "papier";
    const date = d.date ? `<div class="date">${enrichir(d.date)}</div>` : "";
    const barre = `<div class="barre"><span>‹ Notes</span><span class="points">···</span></div>`;
    return {
      classes: papier ? ["papier"] : [],
      corps: `${papier ? `<div class="marge"></div>` : barre}<div class="zone">${date}${blocs(d, { illustration: img(images, d.image) })}</div>`,
    };
  },
  contraste(d, _i, _n, _c, images) {
    if (!d.avant && !d.apres) {
      const fond = img(images, d.image);
      return { classes: fond ? ["sur-image", "centree"] : ["centree"], corps: `${fondImage(fond, true)}<div class="zone centre">${blocs(d)}</div>` };
    }
    const moitie = (b: Bloc | undefined, cote: "haut" | "bas") => {
      const fond = img(images, b?.image);
      return `<div class="moitie ${cote}${fond ? " sur-image" : ""}">${fondImage(fond, false)}<div class="zone">${blocs(b ?? {})}</div></div>`;
    };
    return { classes: ["deux"], corps: moitie(d.avant, "haut") + moitie(d.apres, "bas") };
  },
  ecran(d, _i, _n, _c, images) {
    const capture = img(images, d.image);
    let cadre: string;
    if (capture) cadre = `<div class="cadre capture" style="${attrUrl(capture)}"></div>`;
    else {
      const appli = d.etiquette ? `<div class="appli">${enrichir(d.etiquette)}</div>` : "";
      const cartes = d.liste?.length ? `<ul class="cartes">${d.liste.map((it) => {
        const { classe, texte } = puceListe(it);
        return `<li class="${classe}">${enrichir(texte)}</li>`;
      }).join("")}</ul>` : "";
      const bulle = d.citation ? `<div class="bulle">${enrichir(d.citation)}</div>` : "";
      cadre = `<div class="cadre"><div class="statut"><span>9:41</span><span class="icones"><b></b><i></i></span></div>${appli}${bulle}${cartes}</div>`;
    }
    const titre = d.titre ? `<h1 class="titre">${enrichir(d.titre)}</h1>` : "";
    const texte = d.texte ? `<p class="texte">${enrichir(d.texte)}</p>` : "";
    const note = d.note ? `<p class="note">${enrichir(d.note)}</p>` : "";
    return { classes: [], corps: `<div class="zone">${titre}${cadre}${texte}${note}</div>` };
  },
  natif(d, _i, _n, c, images) {
    // Le texte de l'éditeur de TikTok posé sur une photo plein cadre, nette : bandeaux (« avec fond »), contour, ou
    // bandeaux noirs. Chaque ligne a son pavé ; l'auteur prend l'étiquette rouge.
    const fond = img(images, d.image);
    const flou = (c.theme?.flou ?? 0) > 0;
    const style = c.variante && ["contour", "bandeau_noir"].includes(c.variante) ? c.variante : "bandeau";
    const b = (cls: string, t: string | undefined, balise = "div") => (t ? `<${balise} class="${cls}"><span>${enrichir(t)}</span></${balise}>` : "");
    const items = d.liste?.length ? `<ul class="liste">${d.liste.map((x) => `<li><span>${enrichir(x)}</span></li>`).join("")}</ul>` : "";
    const numero = d.numero !== undefined && d.numero !== false ? `<div class="numero"><span>${echapper(String(d.numero))}</span></div>` : "";
    const corps = [b("etiquette", d.etiquette), numero, b("titre", d.titre, "h1"), b("citation", d.citation, "blockquote"),
      b("auteur", d.auteur), b("texte", d.texte, "p"), items, b("note", d.note, "p")].join("");
    return {
      classes: [`style-${style}`, `pos-${d.position ?? "centre"}`, ...(fond ? ["avec-photo"] : [])],
      corps: `${fond ? `<div class="fond-image${flou ? " flou" : ""}" style="${attrUrl(fond)}"></div>` : ""}<div class="zone centre">${corps}</div>`,
    };
  },
  revelation(d, i, n, _c, images) {
    const derniere = i === n - 1 && n > 1;
    const image = img(images, d.image);
    if (derniere) {
      const ill = image ? `<div class="illustration${d.image_large ? " large" : ""}" style="${attrUrl(image)}"></div>` : "";
      return { classes: ["derniere"], corps: `<div class="zone">${d.etiquette ? `<div class="etiquette">${enrichir(d.etiquette)}</div>` : ""}${ill}${blocs(d, { sansEtiquette: true })}</div>` };
    }
    return {
      classes: image ? ["sur-image"] : [],
      corps: `${fondImage(image, true)}<div class="zone">${blocs(d)}</div><div class="suite">→</div>`,
    };
  },
};

// Une couleur CSS et rien d'autre : ni url(), ni guillemet, ni accolade, ni point-virgule (injection CSS).
const COULEUR_SURE = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab)\([0-9a-z.,%\s/+-]*\)|[a-z]{3,30})$/i;
/** Défense en profondeur (le réseau est déjà coupé par apercu.nouvellePage) : aucun script de la page, aucune
 *  ressource hors data:, donc ni réseau ni file://. */
export const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'">`;
function couleur(v: string | undefined, defaut: string): string {
  return v && COULEUR_SURE.test(v.trim()) ? v.trim() : defaut;
}

async function pageHtml(c: Carrousel, i: number, fiche: FicheModele, images: Images): Promise<string> {
  const d = c.diapositives[i];
  const n = c.diapositives.length;
  const f = FORMATS[c.format as Format]!;
  const z = zonePour(f.l, f.h, c.zone ?? ZONES.defaut).marges;
  const t = { ...fiche.theme, ...c.theme };
  const rendu = MODELES[c.modele](d, i, n, c, images);
  const entete = c.signature || c.numerotation;
  const classes = [`m-${c.modele}`, ...rendu.classes, entete ? "avec-entete" : "", i === 0 ? "premiere" : "", i === n - 1 ? "derniere" : ""]
    .filter(Boolean);
  // Les classes du rendu vont sur body pour que .m-x.derniere .toile et .m-x .sur-image marchent.
  const vars = [
    `--l:${f.l}px`, `--h:${f.h}px`, `--zh:${z.haut}px`, `--zb:${z.bas}px`, `--zg:${z.gauche}px`, `--zd:${z.droite}px`,
    `--zc:${Math.max(z.gauche, z.droite)}px`, `--coupure:${z.haut + Math.round((f.h - z.haut - z.bas) / 2)}px`,
    `--fond:${couleur(d.fond ?? t.fond, fiche.theme.fond)}`, `--texte:${couleur(t.texte, fiche.theme.texte)}`,
    `--accent:${couleur(t.accent, fiche.theme.accent)}`, `--accent2:${couleur(t.accent2, "#D64545")}`,
    `--fond-haut:${couleur(t.fond_haut, "#1D1D1F")}`, `--texte-haut:${couleur(t.texte_haut, "#FFFFFF")}`,
    `--police-titre:"${POLICES[t.police_titre ?? "archivo"]}"`, `--police-texte:"${POLICES[t.police_texte ?? "archivo"]}"`,
    `--flou:${t.flou ?? 14}px`, `--etalonnage:${ETALONNAGES[t.etalonnage ?? "aucun"]}`,
  ].join(";");
  const enteteHtml = entete
    ? `<div class="entete"><span>${c.signature ? echapper(c.signature) : ""}</span><span>${c.numerotation ? `${i + 1}/${n}` : ""}</span></div>`
    : "";
  const css = [await polices(), await lireModele("commun.css"), await lireModele(`${c.modele}.css`)].join("\n");
  return `<!doctype html><html lang="${echapper(c.langue)}"><head><meta charset="utf-8">${CSP}<style>${css}\n:root{${vars}}</style></head>` +
    `<body class="${classes.join(" ")}"><div class="toile">${rendu.corps}${enteteHtml}</div></body></html>`;
}

// ---------- ajustement du texte (dans la page) ----------

interface Ajustement { k: number; deborde: boolean; plusPetite: number }
/** Baisse --k de chaque .zone tant que son contenu déborde ; rend la plus petite taille de texte. */
async function ajuster(page: Page): Promise<Ajustement[]> {
  return page.evaluate((kMin: number) => {
    const res: { k: number; deborde: boolean; plusPetite: number }[] = [];
    for (const zone of Array.from(document.querySelectorAll<HTMLElement>(".zone"))) {
      const deborde = () => zone.scrollHeight > zone.clientHeight + 1 || zone.scrollWidth > zone.clientWidth + 1;
      let k = 1;
      zone.style.setProperty("--k", String(k));
      // Sans coupure de mot pendant la mesure : un mot trop long fait réduire le texte au lieu d'être coupé.
      zone.style.overflowWrap = "normal";
      while (deborde() && k > kMin) {
        k = Math.max(kMin, Math.round((k - 0.03) * 100) / 100);
        zone.style.setProperty("--k", String(k));
      }
      if (deborde()) zone.style.overflowWrap = "break-word";   // dernier recours
      let plusPetite = Infinity;
      // Le texte à lire seulement : étiquettes, dates, notes et barre d'état sont petits exprès.
      for (const el of Array.from(zone.querySelectorAll<HTMLElement>(".titre, .texte, .citation, .liste li, .cartes li, .bulle"))) {
        plusPetite = Math.min(plusPetite, parseFloat(getComputedStyle(el).fontSize));
      }
      res.push({ k, deborde: deborde(), plusPetite: Number.isFinite(plusPetite) ? Math.round(plusPetite) : 0 });
    }
    return res;
  }, K_MIN);
}

/** Les boîtes de chaque ligne de texte rendue (px de l'image), ramenées à la hauteur d'un em : la boîte d'une ligne
 *  déborde de son interligne serré, l'em suit l'encre des lettres. Les pavés (bandeaux, étiquettes) en font partie. */
async function boitesTexte(page: Page): Promise<Rect[]> {
  return page.evaluate(() => {
    const out: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const toile = document.querySelector(".toile");
    if (!toile) return out;
    const marche = document.createTreeWalker(toile, NodeFilter.SHOW_TEXT);
    const r = document.createRange();
    for (let n = marche.nextNode(); n; n = marche.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim()) continue;
      const st = getComputedStyle(el);
      if (st.visibility === "hidden" || parseFloat(st.opacity) === 0) continue;
      const em = parseFloat(st.fontSize);
      r.selectNodeContents(n);
      for (const b of Array.from(r.getClientRects())) {
        if (b.width < 1 || b.height < 1) continue;
        const c = (b.top + b.bottom) / 2, demi = Math.min(b.height, em) / 2;
        out.push({ x0: b.left, x1: b.right, y0: c - demi, y1: c + demi });
      }
    }
    // Les pavés de fond (bandeaux, étiquettes, numéros) : leur boîte entière.
    for (const el of Array.from(toile.querySelectorAll<HTMLElement>(".style-bandeau .zone span, .style-bandeau_noir .zone span, .etiquette, .numero"))) {
      for (const b of Array.from(el.getClientRects())) if (b.width >= 1 && b.height >= 1) out.push({ x0: b.left, x1: b.right, y0: b.top, y1: b.bottom });
    }
    return out;
  });
}

// ---------- rendu ----------

function slug(nom: string): string {
  const s = nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return s || "carrousel";
}
const FICHIER_DIAPO = /^\d{2}\.(png|jpe?g)$/;

async function rendre(ctx: Contexte, entree: Carrousel) {
  const c = typographierCarrousel(entree);
  const toutes = await fiches();
  const fiche = toutes[c.modele];
  if (c.variante && Object.keys(fiche.variantes).length && !(c.variante in fiche.variantes))
    throw new Error(`Variante inconnue pour ${c.modele} : ${c.variante} (possibles : ${Object.keys(fiche.variantes).join(", ")})`);
  const avertissements: string[] = [];

  // Les images, une fois chacune.
  const images: Images = new Map();
  const sources = new Set<string>();
  for (const d of c.diapositives) for (const s of [d.image, d.avant?.image, d.apres?.image]) if (s) sources.add(s);
  await Promise.all([...sources].map(async (s) => {
    try { images.set(s, await imageEnDataUri(s, ctx.dossierTravail)); } catch (e) { avertissements.push(`Image ignorée : ${(e as Error).message}`); }
  }));

  const dossier = join(ctx.dossierTravail, "carrousels", slug(c.nom));
  await mkdir(dossier, { recursive: true });
  for (const f of await readdir(dossier)) if (FICHIER_DIAPO.test(f) || f.startsWith("apercu.")) await rm(join(dossier, f));

  const f = FORMATS[c.format as Format]!;
  const cas = c.zone ?? ZONES.defaut;
  const zone = zonePour(f.l, f.h, cas);
  const nav = await lancerNavigateur();
  const chemins: string[] = [];
  try {
    const page = await nouvellePage(nav, f.l, f.h);
    for (let i = 0; i < c.diapositives.length; i++) {
      await page.setContent(await pageHtml(c, i, fiche, images), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const aj = await ajuster(page);
      const n = i + 1;
      for (const a of aj) {
        if (a.deborde) avertissements.push(`Diapositive ${n} : le texte ne tient pas, même réduit — il est coupé. Raccourcis-le ou répartis-le sur deux diapositives.`);
        else if (a.plusPetite && a.plusPetite < TAILLE_LISIBLE) avertissements.push(`Diapositive ${n} : texte réduit à ${a.plusPetite} px, peu lisible sur un téléphone. Raccourcis-le.`);
      }
      const hors = verifier(await boitesTexte(page), zone);
      if (hors.length) avertissements.push(`Diapositive ${n} : du texte sort de la zone sûre « ${cas} » — ${hors.join(" ; ")}. Raccourcis ou déplace le texte.`);
      const fichier = join(dossier, `${String(n).padStart(2, "0")}.${c.sortie === "jpeg" ? "jpg" : "png"}`);
      // PNG de Chromium : aucun bloc tEXt/iTXt/eXIf ; JPEG : JFIF nu, sans EXIF.
      await page.screenshot({ path: fichier, type: c.sortie, ...(c.sortie === "jpeg" ? { quality: 92 } : {}), animations: "disabled", caret: "hide" });
      chemins.push(fichier);
    }
  } finally {
    await nav.close();
  }
  await writeFile(join(dossier, "carrousel.json"), JSON.stringify(entree, null, 2) + "\n");
  return { dossier, chemins, format: `${f.l}×${f.h}`, zone: cas, zone_verifiee: !avertissements.some((a) => a.includes("zone sûre")), avertissements };
}

// ---------- les outils ----------

const texte = (o: unknown) => ({ type: "text" as const, text: typeof o === "string" ? o : JSON.stringify(o, null, 2) });
const erreur = (e: unknown) => ({ isError: true, content: [texte(`Erreur : ${(e as Error).message}`)] });

export const outilsCarrousel: Module = (serveur, ctx) => {
  serveur.registerTool("carrousel_modeles", {
    title: "Modèles de carrousel",
    description:
      "Liste les modèles de carrousel TikTok (citation, liste, notes, contraste, ecran, revelation, natif) : à quoi chacun sert, " +
      "les champs qu'il lit, son thème par défaut et un exemple de JSON complet à passer à carrousel_rendre ; " +
      "et les formats (9:16, 3:4, 4:5) et les zones sûres par cas (avec ou sans description, pub), avec leur source. " +
      "À appeler avant d'écrire un carrousel. Avec `modele`, ne donne que celui-là.",
    inputSchema: { modele: z.enum(NOMS_MODELES).optional() },
    annotations: { readOnlyHint: true },
  }, async ({ modele }) => {
    try {
      const toutes = await fiches();
      const choisis = modele ? { [modele]: toutes[modele] } : toutes;
      return { content: [texte({
        formats: Object.fromEntries(Object.entries(ZONES.formats).map(([nom, f]) => [nom, `${f.largeur}×${f.hauteur} — ${f.usage}`])),
        zones_sures: {
          principe: "Le texte est posé dans la zone sûre du cas choisi (`zone`), reportée sur le format (l'image s'affiche à la largeur " +
            "de l'écran, centrée en hauteur), puis chaque ligne rendue est vérifiée : un avertissement nomme la diapositive qui en sort. " +
            "Le texte rétrécit seul s'il déborde. Choisis le cas d'après la publication prévue : une légende → « description ».",
          cas: Object.fromEntries(Object.keys(ZONES.cas).map((cas) => [cas, descriptionCas(cas)])),
          par_defaut: ZONES.defaut,
        },
        limite: `${MAX_DIAPOSITIVES} diapositives au plus (limite TikTok des posts photo).`,
        mise_en_forme: "Dans tous les textes : **gras**, ==surligné== (couleur d'accent), \\n pour un retour à la ligne. Les emojis passent.",
        lisibilite: "Une idée par diapositive. Titre ≤ 12 mots, texte ≤ 40 mots ; au-delà le texte rétrécit.",
        modeles: choisis,
      })] };
    } catch (e) { return erreur(e); }
  });

  serveur.registerTool("carrousel_rendre", {
    title: "Rendre un carrousel",
    description:
      "Rend un carrousel TikTok décrit en JSON : une image par diapositive (PNG, ou JPEG pour l'envoi par l'API TikTok) " +
      "dans <dossier de travail>/carrousels/<nom>/ (01.png, 02.png…), plus carrousel.json (l'entrée, pour retoucher). " +
      "Renvoie les chemins et des avertissements (texte coupé, trop réduit, hors de la zone sûre du cas `zone`, image introuvable). " +
      "Voir carrousel_modeles pour les champs et des exemples ; vérifier ensuite avec carrousel_apercu.",
    inputSchema: zCarrousel,
  }, async (c) => {
    try {
      const r = await rendre(ctx, c as Carrousel);
      return { content: [texte({ ...r, suite: "Appelle carrousel_apercu avec ce nom pour voir le rendu." })] };
    } catch (e) { return erreur(e); }
  });

  serveur.registerTool("carrousel_apercu", {
    title: "Aperçu d'un carrousel",
    description:
      "Planche contact : toutes les diapositives d'un carrousel rendu, réduites, en une image (renvoyée ici et gardée dans apercu.jpg). " +
      "Les zones couvertes par l'interface TikTok sont surlignées en rouge, le cadre vert est la zone du texte (zones_sures, par défaut oui) : " +
      "aucun texte ne doit tomber dans le rouge. Le cas (`zone`) est celui du carrousel rendu, sinon la description. " +
      "Donner `nom` (un carrousel rendu par carrousel_rendre) ou `chemins` (des images quelconques, de toute taille : " +
      "une image tirée d'une vidéo par montage_couverture s'y vérifie de la même façon).",
    inputSchema: {
      nom: z.string().optional(),
      chemins: z.array(z.string()).max(MAX_DIAPOSITIVES).optional(),
      zones_sures: z.boolean().default(true),
      zone: zCas.optional(),
    },
    annotations: { readOnlyHint: true },
  }, async ({ nom, chemins, zones_sures, zone }) => {
    try {
      let fichiers: string[];
      let cas: string | undefined = zone;
      let sortie: string;
      if (nom) {
        const dossier = join(ctx.dossierTravail, "carrousels", slug(nom));
        if (!existsSync(dossier)) throw new Error(`Aucun carrousel « ${nom} » dans ${join(ctx.dossierTravail, "carrousels")}`);
        fichiers = (await readdir(dossier)).filter((x) => FICHIER_DIAPO.test(x)).sort().map((x) => join(dossier, x));
        if (!cas) try { cas = JSON.parse(await readFile(join(dossier, "carrousel.json"), "utf8")).zone; } catch { /* entrée illisible */ }
        sortie = join(dossier, "apercu.jpg");
      } else if (chemins?.length) {
        fichiers = await Promise.all(chemins.map((p) => cheminLu(p, { travail: ctx.dossierTravail, extensions: EXT_IMAGES, quoi: "Image", image: true })));
        sortie = join(ctx.dossierTravail, "carrousels", "apercu.jpg");
        await mkdir(join(ctx.dossierTravail, "carrousels"), { recursive: true });
      } else throw new Error("Donne `nom` ou `chemins`.");
      if (!fichiers.length) throw new Error("Aucune diapositive à montrer.");
      cas = zones_sures ? cas ?? ZONES.defaut : undefined;
      const b64 = await planche(fichiers, cas, sortie);
      return { content: [
        texte({ apercu: sortie, diapositives: fichiers.length, zones_sures: cas ? `« ${cas} » : en rouge, couvert par TikTok ; en vert, la zone du texte` : "non montrées" }),
        { type: "image" as const, data: b64, mimeType: "image/jpeg" },
      ] };
    } catch (e) { return erreur(e); }
  });
};

// Pour les essais hors MCP (un script qui importe ce module) : rend, puis fait la planche contact.
export async function plancheHorsMcp(chemins: string[], cas: string, sortie: string) {
  await planche(chemins, cas, sortie);
  return sortie;
}
export async function rendreHorsMcp(entree: unknown, dossierTravail: string) {
  const c = z.object(zCarrousel).parse(entree) as Carrousel;
  const ctx = { dossierTravail } as Contexte;
  const r = await rendre(ctx, c);
  const sortie = join(r.dossier, "apercu.jpg");
  await planche(r.chemins, c.zone ?? ZONES.defaut, sortie);
  return { ...r, apercu: sortie };
}
