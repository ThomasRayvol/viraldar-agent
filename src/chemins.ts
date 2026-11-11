// Les chemins et les URL qui viennent du modèle. L'agent de l'utilisateur lit des textes écrits par des inconnus
// (descriptions et commentaires TikTok, pages web) : une injection de prompt peut lui faire passer n'importe quel
// chemin ou URL à un outil. Règles (revue de sécurité du 11/11/2026) :
//   - lecture : seulement des fichiers du type attendu (extension, et signature pour les images), jamais dans un
//     dossier caché (~/.ssh, ~/.config, ~/.aws…), liens symboliques résolus avant le contrôle ; par défaut (11/11/2026,
//     lecture stricte) seulement dans le dossier de travail ; VIRALDAR_LECTURE l'élargit, par choix explicite de
//     l'utilisateur : des dossiers en plus, ou « partout » (tout le disque hors dossiers cachés) ;
//   - écriture : seulement sous le dossier de travail (les modules construisent eux-mêmes les noms de sortie) ;
//   - envoi vers l'extérieur (brouillon TikTok) : seulement un fichier du dossier de travail ;
//   - téléchargement d'image : http(s) seulement, aucune adresse locale ou privée (SSRF), taille et type bornés.
import { lookup } from "node:dns/promises";
import { open, realpath, stat } from "node:fs/promises";
import { isIP } from "node:net";
import { homedir } from "node:os";
import { delimiter, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const EXT_IMAGES = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".bmp", ".tif", ".tiff"];
export const EXT_VIDEOS = [".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"];
export const EXT_SONS = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".opus", ".flac"];
export const EXT_MEDIAS = [...EXT_IMAGES, ...EXT_VIDEOS, ...EXT_SONS];

export class CheminRefuse extends Error {}

/** ~ et chemins relatifs → absolu (relatif au dossier de travail, pas au dossier courant du client). */
export function developper(p: string, base: string): string {
  const s = p.trim();
  if (s === "~" || s.startsWith("~/") || s.startsWith("~\\")) return resolve(homedir(), s.slice(2));
  return isAbsolute(s) ? resolve(s) : resolve(base, s);
}

export const sous = (racine: string, p: string) => {
  const r = relative(racine, p);
  return r === "" || (!r.startsWith("..") && !isAbsolute(r));
};

function cache(p: string, travail: string): string | null {
  // Le dossier de travail peut lui-même être caché (choix de l'utilisateur) : on ne regarde que ce qui est hors de lui.
  if (sous(travail, p)) return null;
  const morceau = p.split(sep).find((s) => s.startsWith(".") && s !== "." && s !== "..");
  return morceau ?? null;
}

async function reel(p: string): Promise<string> {
  try { return await realpath(p); } catch { throw new CheminRefuse(`Fichier introuvable : ${p}`); }
}

/** Les dossiers lisibles en plus du dossier de travail, choisis par l'utilisateur (VIRALDAR_LECTURE, séparés par « : »,
 *  ou « ; » sous Windows). Non posée : aucun (lecture stricte, le défaut). « partout » : tout le disque hors dossiers
 *  cachés (null). */
function racinesLecture(): string[] | null {
  const v = (process.env.VIRALDAR_LECTURE || "").trim();
  if (!v) return [];
  if (v.toLowerCase() === "partout" || v === "*") return null;
  return v.split(delimiter).map((s) => s.trim()).filter(Boolean).map((s) => developper(s, homedir()));
}

function horsLecture(r: string, travail: string, quoi: string): CheminRefuse | null {
  const racines = racinesLecture();
  if (racines === null || sous(travail, r) || racines.some((x) => sous(x, r))) return null;
  return new CheminRefuse(`${quoi} refusé : ${r} est hors du dossier de travail (${travail})`
    + (racines.length ? ` et des dossiers permis par VIRALDAR_LECTURE` : "") + `. Copie-le d'abord dans ${travail}, `
    + `ou l'utilisateur élargit la lecture lui-même (réglage « lecture » / VIRALDAR_LECTURE).`);
}

const SIGNATURES: [string, (b: Buffer) => boolean][] = [
  ["image/jpeg", (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["image/png", (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ["image/gif", (b) => b.subarray(0, 4).toString("latin1") === "GIF8"],
  ["image/webp", (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP"],
  ["image/avif", (b) => b.subarray(4, 8).toString("latin1") === "ftyp" && /^avi[fs]/.test(b.subarray(8, 12).toString("latin1"))],
  ["image/bmp", (b) => b.subarray(0, 2).toString("latin1") === "BM"],
  ["image/tiff", (b) => ["II*\0", "MM\0*"].includes(b.subarray(0, 4).toString("latin1"))],
];
/** Le type d'une image d'après ses premiers octets (null si ce n'en est pas une). */
export function typeImage(debut: Buffer): string | null {
  return SIGNATURES.find(([, t]) => t(debut))?.[0] ?? null;
}

/** Un fichier que l'outil va LIRE. Rend son chemin réel. */
export async function cheminLu(p: string, o: { travail: string; extensions: string[]; quoi?: string; image?: boolean }): Promise<string> {
  const quoi = o.quoi ?? "fichier";
  const demande = developper(p, o.travail);
  const r = await reel(demande);
  const travail = await realpath(o.travail).catch(() => resolve(o.travail));
  const c = cache(r, travail);
  if (c) throw new CheminRefuse(`${quoi} refusé : ${r} est dans un dossier caché (« ${c} »). Copie-le d'abord dans ${travail}.`);
  const hors = horsLecture(r, travail, quoi);
  if (hors) throw hors;
  const ext = extname(r).toLowerCase();
  if (!o.extensions.includes(ext)) throw new CheminRefuse(`${quoi} refusé : ${r} (extension ${ext || "absente"} ; attendu ${o.extensions.join(", ")}).`);
  const s = await stat(r);
  if (!s.isFile()) throw new CheminRefuse(`${quoi} introuvable (pas un fichier) : ${r}`);
  if (o.image) {
    const f = await open(r, "r");
    try {
      const b = Buffer.alloc(16); await f.read(b, 0, 16, 0);
      if (!typeImage(b)) throw new CheminRefuse(`${quoi} refusé : ${r} n'est pas une image (contenu).`);
    } finally { await f.close(); }
  }
  return r;
}

/** Un dossier que l'outil va lire (polices). */
export async function dossierLu(p: string, travail: string): Promise<string> {
  const r = await reel(developper(p, travail));
  const t = await realpath(travail).catch(() => resolve(travail));
  const c = cache(r, t);
  if (c) throw new CheminRefuse(`Dossier refusé : ${r} est dans un dossier caché (« ${c} »).`);
  const hors = horsLecture(r, t, "Dossier");
  if (hors) throw hors;
  if (!(await stat(r)).isDirectory()) throw new CheminRefuse(`Pas un dossier : ${r}`);
  return r;
}

/** Un fichier qui va QUITTER la machine (brouillon TikTok) : il doit être dans le dossier de travail. */
export async function cheminDuTravail(p: string, travail: string, extensions: string[]): Promise<string> {
  const r = await reel(developper(p, travail));
  const t = await realpath(travail).catch(() => resolve(travail));
  if (!sous(t, r)) throw new CheminRefuse(`Envoi refusé : seuls les fichiers du dossier de travail (${t}) partent vers TikTok. `
    + `Passe la vidéo par montage_format_tiktok (sortie dans ${join(t, "montages")}), ou demande à l'utilisateur de l'y copier.`);
  const ext = extname(r).toLowerCase();
  if (!extensions.includes(ext)) throw new CheminRefuse(`Format non pris en charge : ${extensions.join(", ")} seulement.`);
  if (!(await stat(r)).isFile()) throw new CheminRefuse(`Pas un fichier : ${r}`);
  return r;
}

// ---------- téléchargement d'image (SSRF) ----------

function adressePrivee(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number) as [number, number];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const x = ip.toLowerCase();
  return x === "::" || x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe8") || x.startsWith("fe9")
    || x.startsWith("fea") || x.startsWith("feb") || x.startsWith("ff");
}

async function hotePublic(u: URL) {
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new CheminRefuse(`${u.href} : http(s) seulement.`);
  if (u.username || u.password) throw new CheminRefuse(`${u.href} : pas d'identifiants dans l'URL.`);
  const hote = u.hostname.replace(/^\[|\]$/g, "");
  if (hote === "localhost" || hote.endsWith(".localhost") || hote.endsWith(".local") || hote.endsWith(".internal"))
    throw new CheminRefuse(`${u.href} : adresse locale refusée.`);
  const adresses = isIP(hote) ? [{ address: hote }] : await lookup(hote, { all: true }).catch(() => []);
  if (!adresses.length) throw new CheminRefuse(`${u.href} : hôte introuvable.`);
  if (adresses.some((a) => adressePrivee(a.address))) throw new CheminRefuse(`${u.href} : adresse locale ou privée refusée.`);
}

/** Télécharge une image publique (3 redirections au plus, chacune contrôlée). */
export async function telechargerImage(source: string, maxOctets: number): Promise<{ type: string; octets: Buffer }> {
  let u = new URL(source);
  for (let saut = 0; saut <= 3; saut++) {
    await hotePublic(u);
    const rep = await fetch(u, { signal: AbortSignal.timeout(20_000), redirect: "manual" });
    if (rep.status >= 300 && rep.status < 400 && rep.headers.get("location")) {
      u = new URL(rep.headers.get("location")!, u);
      continue;
    }
    if (!rep.ok || !rep.body) throw new Error(`${source} : HTTP ${rep.status}`);
    const annonce = Number(rep.headers.get("content-length") || 0);
    if (annonce > maxOctets) throw new Error(`${source} : image trop lourde`);
    const morceaux: Buffer[] = []; let n = 0;
    for await (const m of rep.body as unknown as AsyncIterable<Uint8Array>) {
      n += m.length;
      if (n > maxOctets) throw new Error(`${source} : image trop lourde`);
      morceaux.push(Buffer.from(m));
    }
    const octets = Buffer.concat(morceaux);
    const type = typeImage(octets.subarray(0, 16));
    if (!type) throw new Error(`${source} n'est pas une image (contenu)`);
    return { type, octets };
  }
  throw new Error(`${source} : trop de redirections`);
}
