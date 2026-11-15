// Commun aux compositions viraldar : formats, zones sûres, médias.
// ./zones-sures.ts est écrit par l'outil remotion_modeles du MCP viraldar à partir de modeles/zones-sures.json (la
// même source que les carrousels et montage_texte) : ne pas l'éditer à la main, relancer remotion_modeles.
//
// Formats (12/11/2026) : la prop `format` (9:16 par défaut ; 3:4, 4:5, 1:1, 4:3, 16:9, 2.35:1) donne la taille de la
// vidéo (calculateMetadata). Les compositions dessinent dans un repère de 1080 de large (la largeur de l'écran du
// téléphone), haut de 1920 en 9:16 et de 608 en 16:9, mis à l'échelle de la vidéo par <Repere> : une taille de texte
// se lit pareil sur le téléphone, quel que soit le format, et les px des props gardent leur sens.
import React from "react";
import { staticFile, useVideoConfig } from "remotion";
import { ZONES_DONNEES } from "./zones-sures";

export const LARGEUR = 1080;
export const HAUTEUR = 1920;
export const FPS = 30;
export const FORMAT_DEFAUT = "9:16";

type Taille = { largeur: number; hauteur: number };
const FORMATS = ZONES_DONNEES.formats as Record<string, Taille>;
export const NOMS_FORMATS = Object.keys(FORMATS);

/** La taille de la vidéo d'un format (9:16 si absent ou inconnu). */
export function taille(format?: string): { width: number; height: number } {
  const f = (format && FORMATS[format]) || FORMATS[FORMAT_DEFAUT]!;
  return { width: f.largeur, height: f.hauteur };
}

/** Les cas de zone sûre : « description » (post avec légende, défaut), « sans_description », « pub ». */
export type CasZone = keyof typeof ZONES_DONNEES.cas;

/** Marges à laisser libres de l'interface TikTok pour un cas, en px du repère (1080 × h) : la zone du cas, rétrécie
 *  des parties à éviter qui la touchent par un bord (avatars « aimé par » à gauche, colonne d'une pub à droite).
 *  TikTok met l'image à la largeur de l'écran et la centre : la zone de l'écran 1080×1920 se reporte sur le repère
 *  1080 × h par ce centrage (un format paysage tient alors entier dans la hauteur de la zone). */
export function zonesSures(cas?: string, h: number = HAUTEUR): { haut: number; bas: number; gauche: number; droite: number } {
  const c = (ZONES_DONNEES.cas as Record<string, { zone: { x0: number; x1: number; y0: number; y1: number }; eviter: readonly { x0: number; x1: number; y0: number; y1: number }[] }>)[cas ?? ZONES_DONNEES.defaut]
    ?? ZONES_DONNEES.cas[ZONES_DONNEES.defaut as CasZone];
  let gauche = c.zone.x0, droite = c.zone.x1;
  for (const e of c.eviter) {
    if (e.y1 <= c.zone.y0 || e.y0 >= c.zone.y1) continue;
    if (e.x0 <= c.zone.x0) gauche = Math.max(gauche, e.x1);
    else if (e.x1 >= c.zone.x1) droite = Math.min(droite, e.x0);
  }
  const decalage = (HAUTEUR - h) / 2;
  const y = (f: number) => Math.min(h, Math.max(0, f * HAUTEUR - decalage));
  return {
    haut: Math.round(y(c.zone.y0)), bas: Math.round(h - y(c.zone.y1)),
    gauche: Math.round(gauche * LARGEUR), droite: Math.round((1 - droite) * LARGEUR),
  };
}
/** Les marges du cas par défaut, en 9:16. */
export const ZONES_SURES = zonesSures();
export const POLICE = "'TikTok Sans', Arial, Helvetica, sans-serif";

/** Le repère de la composition en cours : 1080 de large, h de haut, k = l'échelle vers la vidéo. */
export function useRepere(): { k: number; h: number } {
  const { width, height } = useVideoConfig();
  const k = width / LARGEUR;
  return { k, h: Math.round(height / k) };
}

/** Dessine ses enfants dans le repère 1080 × h, mis à l'échelle de la vidéo. */
export const Repere: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { k, h } = useRepere();
  return React.createElement("div", {
    style: { position: "absolute", left: 0, top: 0, width: LARGEUR, height: h, transform: `scale(${k})`, transformOrigin: "0 0", overflow: "hidden" },
  }, children);
};

/** Un média : URL (http…) telle quelle, sinon un fichier de public/ (staticFile). */
export const media = (src: string) => (/^(https?:|data:|blob:)/.test(src) ? src : staticFile(src));

/** Secondes → images, au moins 1. */
export const images = (secondes: number, fps = FPS) => Math.max(1, Math.round(secondes * fps));
