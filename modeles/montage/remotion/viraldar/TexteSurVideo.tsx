// Textes animés (entrée en ressort, sortie en fondu) sur une vidéo, une image ou un fond uni.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Audio, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { POLICE, images, media, zonesSures } from "./commun";

export type TexteAnime = {
  texte: string;
  /** En secondes. */
  debut: number;
  fin: number;
  position?: "haut" | "centre" | "bas";
  /** Pavé blanc derrière un texte noir (façon TikTok) plutôt qu'un texte blanc à contour. */
  boite?: boolean;
  taille?: number;
};

export type PropsTexteSurVideo = {
  /** Vidéo de fond (fichier de public/ ou URL). */
  video?: string;
  /** Ou une image de fond. */
  image?: string;
  /** Ou une couleur de fond. */
  fond?: string;
  /** Son de la vidéo de fond coupé (true par défaut si une musique est donnée). */
  muet?: boolean;
  musique?: string;
  volumeMusique?: number;
  textes: TexteAnime[];
  /** Durée totale en s (sinon la fin du dernier texte). */
  duree?: number;
  couleur?: string;
  /** Zone sûre : « description » (défaut), « sans_description », « pub ». */
  zone?: string;
};

const Texte: React.FC<{ t: TexteAnime; couleur: string; dureeImages: number; zone?: string }> = ({ t, couleur, dureeImages, zone }) => {
  const ZONES_SURES = zonesSures(zone);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entree = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });
  const sortie = interpolate(frame, [dureeImages - 6, dureeImages], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const position = t.position ?? "haut";
  const taille = t.taille ?? 72;
  return (
    <AbsoluteFill
      style={{
        paddingTop: ZONES_SURES.haut + 20,
        paddingBottom: ZONES_SURES.bas + 20,
        paddingLeft: ZONES_SURES.gauche + 20,
        paddingRight: ZONES_SURES.droite + 20,
        justifyContent: position === "haut" ? "flex-start" : position === "bas" ? "flex-end" : "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontFamily: POLICE,
          fontWeight: 800,
          fontSize: taille,
          lineHeight: 1.2,
          textAlign: "center",
          whiteSpace: "pre-wrap",
          color: t.boite ? "#000" : couleur,
          background: t.boite ? "#fff" : undefined,
          padding: t.boite ? "0.15em 0.4em" : undefined,
          borderRadius: t.boite ? 18 : undefined,
          boxDecorationBreak: "clone",
          WebkitTextStroke: t.boite ? undefined : `${Math.round(taille / 14)}px #000`,
          paintOrder: "stroke fill",
          textShadow: t.boite ? undefined : "0 4px 12px rgba(0,0,0,.45)",
          opacity: Math.min(entree, sortie),
          transform: `translateY(${(1 - entree) * 40}px) scale(${0.85 + 0.15 * entree})`,
        }}
      >
        {t.texte}
      </div>
    </AbsoluteFill>
  );
};

export const TexteSurVideo: React.FC<PropsTexteSurVideo> = (p) => {
  const { fps } = useVideoConfig();
  const muet = p.muet ?? Boolean(p.musique);
  return (
    <AbsoluteFill style={{ backgroundColor: p.fond ?? "#111" }}>
      {p.video ? <OffthreadVideo src={media(p.video)} muted={muet} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      {!p.video && p.image ? <Img src={media(p.image)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      {p.musique ? <Audio src={media(p.musique)} volume={p.volumeMusique ?? 1} /> : null}
      {p.textes.map((t, i) => {
        const d = images(t.fin - t.debut, fps);
        return (
          <Sequence key={i} from={Math.round(t.debut * fps)} durationInFrames={d} layout="none">
            <Texte t={t} couleur={p.couleur ?? "#fff"} dureeImages={d} zone={p.zone} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const dureeTexteSurVideo = (p: PropsTexteSurVideo) => p.duree ?? Math.max(1, ...p.textes.map((t) => t.fin));
