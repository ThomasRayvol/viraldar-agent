// Un titre, puis une liste qui apparaît élément par élément ; quand elle déborde, elle défile vers le haut.
import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { HAUTEUR, POLICE, media, zonesSures } from "./commun";

export type PropsListeDefile = {
  titre: string;
  elements: string[];
  /** Secondes avant le premier élément. */
  delaiTitre?: number;
  secondesParElement?: number;
  /** Secondes gardées à la fin, liste complète. */
  pause?: number;
  fond?: string;
  imageFond?: string;
  couleur?: string;
  accent?: string;
  numeroter?: boolean;
  musique?: string;
  volumeMusique?: number;
  /** Zone sûre : « description » (défaut), « sans_description », « pub ». */
  zone?: string;
};

const HAUTEUR_ELEMENT = 150;

export const ListeDefile: React.FC<PropsListeDefile> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ZONES_SURES = zonesSures(p.zone);
  const delai = (p.delaiTitre ?? 1.2) * fps;
  const pas = (p.secondesParElement ?? 1.6) * fps;
  const couleur = p.couleur ?? "#fff";
  const accent = p.accent ?? "#fe2c55";
  const titre = spring({ frame, fps, config: { damping: 16 } });
  // Combien d'éléments sont visibles, et de combien la liste doit monter pour garder le dernier à l'écran.
  const zoneListe = HAUTEUR - ZONES_SURES.haut - ZONES_SURES.bas - 260;
  const visibles = Math.max(0, Math.min(p.elements.length, Math.floor((frame - delai) / pas) + 1));
  const capacite = Math.floor(zoneListe / HAUTEUR_ELEMENT);
  const depassement = Math.max(0, visibles - capacite);
  const versDecalage = depassement * HAUTEUR_ELEMENT;
  const avant = Math.max(0, visibles - 1 - capacite) * HAUTEUR_ELEMENT;
  const debutDernier = delai + (visibles - 1) * pas;
  const decalage = interpolate(frame, [debutDernier, debutDernier + 10], [avant, versDecalage], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: p.fond ?? "linear-gradient(160deg,#1b1b2f,#0b0b12)", fontFamily: POLICE, color: couleur }}>
      {p.imageFond ? <Img src={media(p.imageFond)} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.45 }} /> : null}
      {p.musique ? <Audio src={media(p.musique)} volume={p.volumeMusique ?? 1} /> : null}
      <AbsoluteFill style={{ paddingTop: ZONES_SURES.haut + 20, paddingLeft: ZONES_SURES.gauche + 30, paddingRight: ZONES_SURES.droite + 20 }}>
        <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1.1, opacity: titre, transform: `translateY(${(1 - titre) * -30}px)` }}>{p.titre}</div>
        <div style={{ width: 160 * titre, height: 10, background: accent, borderRadius: 5, margin: "28px 0 40px" }} />
        <div style={{ height: zoneListe, overflow: "hidden" }}>
          <div style={{ transform: `translateY(${-decalage}px)` }}>
            {p.elements.map((e, i) => {
              const f = frame - delai - i * pas;
              const s = spring({ frame: f, fps, config: { damping: 14 } });
              return (
                <div key={i} style={{ height: HAUTEUR_ELEMENT, display: "flex", alignItems: "center", gap: 28, opacity: f < 0 ? 0 : s, transform: `translateX(${(1 - s) * 80}px)` }}>
                  {p.numeroter !== false ? <div style={{ minWidth: 86, height: 86, borderRadius: 43, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, fontWeight: 900 }}>{i + 1}</div> : null}
                  <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.15 }}>{e}</div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const dureeListeDefile = (p: PropsListeDefile) =>
  (p.delaiTitre ?? 1.2) + p.elements.length * (p.secondesParElement ?? 1.6) + (p.pause ?? 2);
