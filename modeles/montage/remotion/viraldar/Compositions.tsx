// Les compositions viraldar, à déclarer une fois dans le Root du projet Remotion :
//   import { CompositionsViraldar } from "./viraldar/Compositions";
//   … <CompositionsViraldar /> dans le JSX du Root.
// Toutes en 1080×1920 à 30 i/s ; la durée se calcule depuis les props (calculateMetadata).
import React from "react";
import { Composition } from "remotion";
import { FPS, HAUTEUR, LARGEUR, images } from "./commun";
import { TexteSurVideo, dureeTexteSurVideo, type PropsTexteSurVideo } from "./TexteSurVideo";
import { ListeDefile, dureeListeDefile, type PropsListeDefile } from "./ListeDefile";
import { Citation, dureeCitation, type PropsCitation } from "./Citation";

const commun = { width: LARGEUR, height: HAUTEUR, fps: FPS, durationInFrames: 150 };

export const CompositionsViraldar: React.FC = () => (
  <>
    <Composition
      id="ViraldarTexteSurVideo"
      component={TexteSurVideo as React.FC<Record<string, unknown>>}
      {...commun}
      defaultProps={{
        fond: "#16161d",
        textes: [
          { texte: "Personne ne parle de ça 👇", debut: 0, fin: 2.5, position: "haut", boite: true },
          { texte: "3 habitudes qui changent tout", debut: 2.5, fin: 5, position: "centre" },
        ],
      } satisfies PropsTexteSurVideo}
      calculateMetadata={({ props }) => ({ durationInFrames: images(dureeTexteSurVideo(props as PropsTexteSurVideo)) })}
    />
    <Composition
      id="ViraldarListeDefile"
      component={ListeDefile as React.FC<Record<string, unknown>>}
      {...commun}
      defaultProps={{
        titre: "5 petites choses pour aller mieux",
        elements: ["Boire un verre d'eau au réveil", "10 minutes dehors", "Écrire 3 gratitudes", "Couper l'écran à 22 h", "Appeler quelqu'un qu'on aime"],
      } satisfies PropsListeDefile}
      calculateMetadata={({ props }) => ({ durationInFrames: images(dureeListeDefile(props as PropsListeDefile)) })}
    />
    <Composition
      id="ViraldarCitation"
      component={Citation as React.FC<Record<string, unknown>>}
      {...commun}
      defaultProps={{ citation: "Tu n'as pas à tout porter seul·e aujourd'hui.", auteur: "Rappel du soir" } satisfies PropsCitation}
      calculateMetadata={({ props }) => ({ durationInFrames: images(dureeCitation(props as PropsCitation)) })}
    />
  </>
);
