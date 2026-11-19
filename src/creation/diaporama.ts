/// <reference types="node" />
// Les images d'un diaporama TikTok (post photo), pour les lire TOUTES (19/11/2026, demandé par le propriétaire : « ça
// n'a pas d'intérêt de regarder que la première image »). Sur la machine de l'utilisateur seulement, jamais chez viraldar.
//   - yt-dlp ne rend pas les images d'un post photo (seulement la bande-son et la couverture : vérifié le 19/11/2026,
//     yt-dlp 2026.08.19) ;
//   - la page publique du post, elle, porte ses images dans le JSON qu'elle embarque
//     (`__UNIVERSAL_DATA_FOR_REHYDRATION__` → webapp.video-detail → itemInfo.itemStruct.imagePost.images[].imageURL).
//     Une requête ordinaire (fetch de Node, son en-tête par défaut : rien de maquillé), sans jeton ni cookie ; si TikTok
//     répond par un captcha ou une page vide, on s'arrête et on le dit, sans rien contourner.
//     L'adresse en /photo/ rend une page sans le détail : on lit la même par /video/ (TikTok la sert pour les deux).
//   - les images (adresses signées du CDN de TikTok, valables quelques jours) sont téléchargées par telechargerImage
//     (https, hôte public, taille et type bornés) dans le dossier de travail ; rien n'est envoyé ni gardé chez viraldar.
//   - le texte de chaque image : un OCR local (tesseract) s'il est installé, avec le français s'il a ce pack ; sinon,
//     l'agent lit les images lui-même.
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { telechargerImage } from "../chemins.ts";
import { ErreurMontage, executer, ffmpeg } from "./montage.ts";
import { dansLePath } from "./analyse.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const IMAGES_MAX = 35;                 // un diaporama TikTok en a 35 au plus
const OCTETS_MAX = 15 * 1024 * 1024;   // par image
const CDN = /(^|\.)(tiktokcdn(-[a-z]+)?\.com|tiktokcdn\.[a-z]{2,3}|ibyteimg\.com|byteoversea\.com|muscdn\.com)$/i;

export interface Diaporama {
  id: string;
  url: string;
  images: string[];          // adresses des images, dans l'ordre
  largeur?: number; hauteur?: number;
  legende?: string; son?: string; titre?: string;
}

/** Lit la page publique d'un post TikTok. Rend le diaporama, ou null si c'est une vidéo ; lève une erreur si la page
 *  ne se lit pas (captcha, blocage, post privé). */
export async function lireDiaporama(url: string): Promise<Diaporama | null> {
  const u = new URL(url);
  // un lien court (vm., vt.) : la redirection donne l'adresse longue
  let page = u.href.replace(/\/photo\/(\d+)/, "/video/$1");
  let rep = await fetch(page, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (/\/photo\/\d+/.test(rep.url)) {
    page = rep.url.replace(/\/photo\/(\d+)/, "/video/$1");
    rep = await fetch(page, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  }
  const hote = new URL(rep.url).hostname.toLowerCase();
  if (!(hote === "tiktok.com" || hote.endsWith(".tiktok.com"))) throw new ErreurMontage(`La page du post a redirigé hors de TikTok (${hote}).`);
  if (!rep.ok) throw new ErreurMontage(`La page du post répond ${rep.status}.`);
  const html = await rep.text();
  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new ErreurMontage("La page du post ne porte pas ses données (captcha, ou TikTok a changé sa page) : rien n'est contourné.");
  let d: any;
  try { d = JSON.parse(m[1]!); } catch { throw new ErreurMontage("Les données de la page du post sont illisibles."); }
  const detail = d?.__DEFAULT_SCOPE__?.["webapp.video-detail"];
  const it = detail?.itemInfo?.itemStruct;
  if (!it) throw new ErreurMontage(`Le post ne se lit pas (${detail?.statusMsg || `statut ${detail?.statusCode ?? "?"}`} : privé, supprimé, ou réservé aux connectés).`);
  const brutes: any[] = it.imagePost?.images || [];
  if (!brutes.length) return null;
  const images = brutes.slice(0, IMAGES_MAX).map((x) => {
    const a = (x?.imageURL?.urlList || []).find((s: string) => { try { const v = new URL(s); return v.protocol === "https:" && CDN.test(v.hostname); } catch { return false; } });
    return a as string | undefined;
  });
  if (images.some((x) => !x)) throw new ErreurMontage("Une image du diaporama n'a pas d'adresse sur le CDN de TikTok.");
  return {
    id: String(it.id || ""), url: rep.url.split("?")[0]!, images: images as string[],
    largeur: brutes[0]?.imageWidth, hauteur: brutes[0]?.imageHeight,
    legende: typeof it.desc === "string" ? it.desc : undefined,
    son: it.music?.title ? `${it.music.title}${it.music.authorName ? ` — ${it.music.authorName}` : ""}` : undefined,
    titre: typeof it.imagePost?.title === "string" ? it.imagePost.title : undefined,
  };
}

/** Télécharge les images dans `dossier` (image-01.jpg…), dans l'ordre. */
export async function telechargerImages(d: Diaporama, dossier: string): Promise<string[]> {
  await mkdir(dossier, { recursive: true });
  const chemins: string[] = [];
  for (const [i, src] of d.images.entries()) {
    const { type, octets } = await telechargerImage(src, OCTETS_MAX);
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const c = join(dossier, `image-${String(i + 1).padStart(2, "0")}.${ext}`);
    await writeFile(c, octets);
    chemins.push(c);
  }
  return chemins;
}

/** Une copie réduite en JPEG (pour la montrer à l'agent), sans métadonnées. */
export async function reduire(source: string, sortie: string, hauteur: number): Promise<void> {
  await ffmpeg(["-i", source, "-vf", `scale=-2:${hauteur}`, "-frames:v", "1", "-q:v", "4", "-map_metadata", "-1", sortie]);
}

/** La planche numérotée : les images dans l'ordre, de gauche à droite puis de haut en bas. */
export async function plancheImages(chemins: string[], sortie: string, l = 300, h = 400): Promise<number> {
  const tmp = await mkdtemp(join(tmpdir(), "viraldar-diapo-"));
  try {
    const colonnes = Math.min(chemins.length, 6);
    const lignes = Math.ceil(chemins.length / colonnes);
    for (let i = 0; i < lignes * colonnes; i++) {
      const c = join(tmp, `c-${String(i).padStart(3, "0")}.png`);
      if (i < chemins.length) await ffmpeg(["-i", chemins[i]!, "-vf",
        `scale=${l}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${l}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x202024,setsar=1`,
        "-frames:v", "1", c]);
      else await ffmpeg(["-f", "lavfi", "-i", `color=c=0x202024:s=${l}x${h}`, "-frames:v", "1", c]);
    }
    await ffmpeg(["-framerate", "1", "-i", "c-%03d.png", "-vf", `tile=${colonnes}x${lignes}:padding=6:margin=6:color=0x101012`,
      "-frames:v", "1", "-q:v", "3", "-map_metadata", "-1", sortie], tmp);
    return colonnes;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------------------------
// OCR local (facultatif) : tesseract, trouvé, jamais installé.

export const trouverTesseract = () => process.env.VIRALDAR_TESSERACT && existsSync(process.env.VIRALDAR_TESSERACT)
  ? process.env.VIRALDAR_TESSERACT : dansLePath(["tesseract"]);

/** Les langues installées de tesseract. */
export async function languesTesseract(exe: string): Promise<string[]> {
  try {
    const { stdout, stderr } = await executer(exe, ["--list-langs"], { nom: "tesseract", delaiMs: 20_000 });
    return (stdout + "\n" + stderr).split(/\r?\n/).map((s) => s.trim()).filter((s) => /^[a-z_]{3,}$/i.test(s) && s !== "osd");
  } catch { return []; }
}

/** La langue à demander : le français (avec l'anglais) si le pack est là, sinon l'anglais, sinon la première. */
export function langueOcr(langues: string[]): string | null {
  if (langues.includes("fra")) return langues.includes("eng") ? "fra+eng" : "fra";
  if (langues.includes("eng")) return "eng";
  return langues[0] ?? null;
}

/** Le texte d'une image (tesseract, sortie standard), lignes vides retirées. */
export async function ocr(exe: string, image: string, langue: string): Promise<string> {
  const { stdout } = await executer(exe, [image, "stdout", "-l", langue], { nom: "tesseract", delaiMs: 60_000 });
  return stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).join("\n");
}

