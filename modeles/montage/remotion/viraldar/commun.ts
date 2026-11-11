// Commun aux compositions viraldar : format TikTok, zones sûres, médias.
// ./zones-sures.ts est écrit par l'outil remotion_modeles du MCP viraldar à partir de modeles/zones-sures.json (la
// même source que les carrousels et montage_texte) : ne pas l'éditer à la main, relancer remotion_modeles.
import { staticFile } from "remotion";
import { ZONES_DONNEES } from "./zones-sures";

export const LARGEUR = 1080;
export const HAUTEUR = 1920;
export const FPS = 30;

/** Les cas de zone sûre : « description » (post avec légende, défaut), « sans_description », « pub ». */
export type CasZone = keyof typeof ZONES_DONNEES.cas;

/** Marges à laisser libres de l'interface TikTok pour un cas, en px sur 1080×1920 : la zone du cas, rétrécie des
 *  parties à éviter qui la touchent par un bord (avatars « aimé par » à gauche, colonne d'une pub à droite). */
export function zonesSures(cas?: string): { haut: number; bas: number; gauche: number; droite: number } {
  const c = (ZONES_DONNEES.cas as Record<string, { zone: { x0: number; x1: number; y0: number; y1: number }; eviter: readonly { x0: number; x1: number; y0: number; y1: number }[] }>)[cas ?? ZONES_DONNEES.defaut]
    ?? ZONES_DONNEES.cas[ZONES_DONNEES.defaut as CasZone];
  let gauche = c.zone.x0, droite = c.zone.x1;
  for (const e of c.eviter) {
    if (e.y1 <= c.zone.y0 || e.y0 >= c.zone.y1) continue;
    if (e.x0 <= c.zone.x0) gauche = Math.max(gauche, e.x1);
    else if (e.x1 >= c.zone.x1) droite = Math.min(droite, e.x0);
  }
  return {
    haut: Math.round(c.zone.y0 * HAUTEUR), bas: Math.round((1 - c.zone.y1) * HAUTEUR),
    gauche: Math.round(gauche * LARGEUR), droite: Math.round((1 - droite) * LARGEUR),
  };
}
/** Les marges du cas par défaut. */
export const ZONES_SURES = zonesSures();
export const POLICE = "'TikTok Sans', Arial, Helvetica, sans-serif";

/** Un média : URL (http…) telle quelle, sinon un fichier de public/ (staticFile). */
export const media = (src: string) => (/^(https?:|data:|blob:)/.test(src) ? src : staticFile(src));

/** Secondes → images, au moins 1. */
export const images = (secondes: number, fps = FPS) => Math.max(1, Math.round(secondes * fps));
