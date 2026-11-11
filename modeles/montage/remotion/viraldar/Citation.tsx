// Une citation qui s'écrit mot à mot, puis son auteur en fondu, sur fond uni, dégradé ou image.
import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { POLICE, media, zonesSures } from "./commun";

export type PropsCitation = {
  citation: string;
  auteur?: string;
  /** Mots par seconde de l'écriture. */
  motsParSeconde?: number;
  /** Secondes gardées après l'auteur. */
  pause?: number;
  fond?: string;
  imageFond?: string;
  couleur?: string;
  accent?: string;
  taille?: number;
  musique?: string;
  volumeMusique?: number;
  /** Zone sûre : « description » (défaut), « sans_description », « pub ». */
  zone?: string;
};

export const Citation: React.FC<PropsCitation> = (p) => {
  const ZONES_SURES = zonesSures(p.zone);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mots = p.citation.split(/\s+/).filter(Boolean);
  const parMot = fps / (p.motsParSeconde ?? 3);
  const finEcriture = 10 + mots.length * parMot;
  const auteur = interpolate(frame, [finEcriture + 6, finEcriture + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const guillemet = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const couleur = p.couleur ?? "#fff";
  const accent = p.accent ?? "#f5c542";
  return (
    <AbsoluteFill style={{ background: p.fond ?? "linear-gradient(180deg,#232526,#414345)", fontFamily: POLICE, color: couleur }}>
      {p.imageFond ? <Img src={media(p.imageFond)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(.55)" }} /> : null}
      {p.musique ? <Audio src={media(p.musique)} volume={p.volumeMusique ?? 1} /> : null}
      <AbsoluteFill
        style={{
          paddingTop: ZONES_SURES.haut + 20, paddingBottom: ZONES_SURES.bas + 20,
          paddingLeft: ZONES_SURES.gauche + 20, paddingRight: ZONES_SURES.droite + 20,
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 220, lineHeight: 0.6, color: accent, opacity: guillemet, fontFamily: "Georgia, serif" }}>“</div>
        <div style={{ fontSize: p.taille ?? 70, fontWeight: 700, lineHeight: 1.3 }}>
          {mots.map((m, i) => {
            const o = interpolate(frame, [10 + i * parMot, 10 + i * parMot + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <span key={i} style={{ opacity: o, display: "inline-block", transform: `translateY(${(1 - o) * 14}px)`, marginRight: "0.28em" }}>{m}</span>
            );
          })}
        </div>
        {p.auteur ? (
          <div style={{ marginTop: 48, fontSize: 46, fontWeight: 500, opacity: auteur, color: accent }}>— {p.auteur}</div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const dureeCitation = (p: PropsCitation) =>
  (10 + p.citation.split(/\s+/).filter(Boolean).length * (30 / (p.motsParSeconde ?? 3)) + 24) / 30 + (p.pause ?? 2.5);
