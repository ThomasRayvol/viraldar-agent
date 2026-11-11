// Les zones sûres TikTok et les formats, lus dans modeles/zones-sures.json (une seule source pour les carrousels,
// le montage, l'aperçu et les compositions Remotion). Ce module ne fait que reporter une zone, donnée en fractions
// de l'écran 9:16, sur une image de n'importe quelle taille, et vérifier des boîtes de texte contre elle.
//
// Le report suit le mécanisme mesuré : l'image est mise à la largeur de l'écran et centrée verticalement.
// Une image 3:4 (1080 × 1440) dans l'écran 1080 × 1920 commence donc à y = 240 : la zone y 0,21 – 0,72 de l'écran
// devient y 163 – 1142 de l'image (0,113 – 0,793).
import { readFileSync } from "node:fs";
import { z } from "zod";
import { sousRacine } from "../racine.ts";

export interface Fractions { x0: number; x1: number; y0: number; y1: number }
interface CasDonnees {
  titre: string; quand: string; zone: Fractions; eviter: (Fractions & { quoi: string })[]; source: string; date: string;
}
interface Donnees {
  repere: { largeur: number; hauteur: number };
  formats: Record<string, { largeur: number; hauteur: number; usage: string }>;
  defaut: string;
  cas: Record<string, CasDonnees>;
}

export const FICHIER_ZONES = sousRacine("modeles/zones-sures.json");
export const ZONES: Donnees = JSON.parse(readFileSync(FICHIER_ZONES, "utf8"));

export const NOMS_CAS = Object.keys(ZONES.cas) as [string, ...string[]];
export const NOMS_FORMATS = Object.keys(ZONES.formats) as [string, ...string[]];
if (!NOMS_CAS.length || !(ZONES.defaut in ZONES.cas)) throw new Error("modeles/zones-sures.json : aucun cas, ou défaut inconnu");

export const zCas = z.enum(NOMS_CAS).describe(
  "Zone sûre : " + NOMS_CAS.join(", ") + ` (défaut « ${ZONES.defaut} » ; détail dans carrousel_modeles ou montage_infos).`,
);

/** Un rectangle en px de l'image. */
export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface ZonePx {
  cas: string; l: number; h: number;
  /** La zone telle qu'elle tombe sur l'image (px), bornée à l'image. */
  zone: Rect;
  /** Les parties de la zone à éviter (avatars, colonne de pub), en px de l'image. */
  eviter: (Rect & { quoi: string })[];
  /** Le rectangle où poser du texte sans rien vérifier d'autre : la zone, rétrécie des parties à éviter qui la
   *  touchent par un bord. Marges en px depuis chaque bord de l'image. */
  marges: { haut: number; bas: number; gauche: number; droite: number };
}

/** Une fraction de l'écran → px de l'image l × h (mise à la largeur, centrée verticalement). */
function versImage(l: number, h: number) {
  const { largeur: L, hauteur: H } = ZONES.repere;
  const s = L / l;                       // px d'écran par px d'image
  const decalage = (H - h * s) / 2;      // négatif pour une image plus haute que l'écran (rognée au centre)
  return {
    x: (fx: number) => Math.min(l, Math.max(0, (fx * L) / s)),
    y: (fy: number) => Math.min(h, Math.max(0, (fy * H - decalage) / s)),
  };
}

export function zonePour(l: number, h: number, cas: string = ZONES.defaut): ZonePx {
  const c = ZONES.cas[cas];
  if (!c) throw new Error(`Zone sûre inconnue : « ${cas} » (possibles : ${NOMS_CAS.join(", ")})`);
  const v = versImage(l, h);
  const rect = (f: Fractions): Rect => ({ x0: v.x(f.x0), x1: v.x(f.x1), y0: v.y(f.y0), y1: v.y(f.y1) });
  const zone = rect(c.zone);
  const eviter = c.eviter.map((e) => ({ ...rect(e), quoi: e.quoi }));
  let gauche = zone.x0, droite = zone.x1;
  for (const e of eviter) {
    if (e.y1 <= zone.y0 || e.y0 >= zone.y1) continue;            // hors de la hauteur de la zone
    if (e.x0 <= zone.x0 + 1) gauche = Math.max(gauche, e.x1);    // collé au bord gauche
    else if (e.x1 >= zone.x1 - 1) droite = Math.min(droite, e.x0);
  }
  const r = (n: number) => Math.round(n);
  return { cas, l, h, zone, eviter, marges: { haut: r(zone.y0), bas: r(h - zone.y1), gauche: r(gauche), droite: r(l - droite) } };
}

/** Les manquements d'une liste de boîtes (px de l'image) ; liste vide = tout tient. Tolérance de 2 px. */
export function verifier(boites: Rect[], z: ZonePx): string[] {
  const t = 2, fautes = new Set<string>();
  const f = (n: number) => String(Math.round(n));
  for (const b of boites) {
    if (b.y0 < z.zone.y0 - t) fautes.add(`trop haut (y ${f(b.y0)} < ${f(z.zone.y0)})`);
    if (b.y1 > z.zone.y1 + t) fautes.add(`trop bas (y ${f(b.y1)} > ${f(z.zone.y1)})`);
    if (b.x0 < z.zone.x0 - t) fautes.add(`trop à gauche (x ${f(b.x0)} < ${f(z.zone.x0)})`);
    if (b.x1 > z.zone.x1 + t) fautes.add(`trop à droite (x ${f(b.x1)} > ${f(z.zone.x1)})`);
    for (const e of z.eviter) {
      if (b.x0 < e.x1 - t && b.x1 > e.x0 + t && b.y0 < e.y1 - t && b.y1 > e.y0 + t) fautes.add(`sous ${e.quoi}`);
    }
  }
  return [...fautes];
}

/** Le résumé d'un cas pour un format, à rendre à l'agent. */
export function descriptionCas(cas: string, l = ZONES.repere.largeur, h = ZONES.repere.hauteur) {
  const c = ZONES.cas[cas]!;
  const z = zonePour(l, h, cas);
  return {
    titre: c.titre, quand: c.quand,
    texte_entre: `x ${Math.round(z.zone.x0)}–${Math.round(z.zone.x1)}, y ${Math.round(z.zone.y0)}–${Math.round(z.zone.y1)} px sur ${l}×${h}`,
    eviter: z.eviter.map((e) => `${e.quoi} : x ${Math.round(e.x0)}–${Math.round(e.x1)}, y ${Math.round(e.y0)}–${Math.round(e.y1)}`),
    source: `${c.source} (${c.date})`,
  };
}

/** Largeur et hauteur d'une image PNG, JPEG, WebP ou GIF, lues dans son en-tête (sans dépendance). */
export function dimensionsImage(b: Buffer): { l: number; h: number } | undefined {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { l: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length > 10 && b.toString("ascii", 0, 3) === "GIF") return { l: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const t = b.toString("ascii", 12, 16);
    if (t === "VP8X") return { l: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (t === "VP8 ") return { l: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (t === "VP8L") { const n = b.readUInt32LE(21); return { l: 1 + (n & 0x3fff), h: 1 + ((n >> 14) & 0x3fff) }; }
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1]!;
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { l: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return undefined;
}
