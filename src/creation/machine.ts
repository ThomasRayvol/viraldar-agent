// ma_machine (18/11/2026) : ce qu'il y a sur l'ordinateur de l'utilisateur pour fabriquer, et ce qui manque.
// Né d'une séance où un utilisateur a lancé un montage et l'analyse de posts concurrents sans que personne lui ait dit
// que Whisper et Remotion manquaient. L'outil REGARDE seulement : il n'installe rien (arbitré par le propriétaire le
// 18/11/2026 : aucun installeur ni paquet à maintenir, aucune responsabilité Remotion). Il donne, pour ce qui manque,
// à quoi ça sert, ce qu'on perd sans, et les commandes à taper soi-même pour son système. L'agent l'appelle avant une
// tâche qui en dépend, explique, et laisse l'utilisateur choisir et installer.
import { existsSync } from "node:fs";
import type { Contexte, Module } from "../contexte.ts";
import { candidatsNavigateur } from "./apercu.ts";
import { installationFfmpeg, projetRemotion, trouverFfmpeg } from "./montage.ts";
import { trouverWhisper, trouverYtDlp } from "./analyse.ts";
import { languesTesseract, trouverTesseract } from "./diaporama.ts";
import { resumeVisionneuses } from "./revue.ts";

type Os = "darwin" | "win32" | "linux";
const OS: Os = process.platform === "darwin" || process.platform === "win32" ? process.platform : "linux";
const NOM_OS: Record<Os, string> = { darwin: "macOS", win32: "Windows", linux: "Linux" };

interface Programme {
  nom: string;
  sert: string;
  sans: string;
  installer: Partial<Record<Os, string>> | string;
  trouver: () => Promise<string | null>;
}

const PROGRAMMES: Programme[] = [
  {
    nom: "Chrome (ou Chromium, Edge, Brave)",
    sert: "rendre les carrousels (modèles HTML → images) et leurs aperçus",
    sans: "pas de carrousel",
    installer: {
      darwin: "installer Google Chrome (https://www.google.com/chrome/), ou `brew install --cask google-chrome`",
      win32: "`winget install Google.Chrome` (ou Edge, déjà présent sur Windows)",
      linux: "`sudo apt install chromium` (ou le paquet chromium de sa distribution)",
    },
    trouver: async () => {
      const imposé = process.env.VIRALDAR_CHROMIUM;
      const c = [...(imposé ? [imposé] : []), ...candidatsNavigateur()];
      try { const { chromium } = await import("playwright-core"); c.push(chromium.executablePath()); } catch { /* */ }
      return c.find((x) => existsSync(x)) ?? null;
    },
  },
  {
    nom: "ffmpeg",
    sert: "tout le montage (découpe, assemblage, diaporama, texte et sous-titres, couverture), décortiquer une vidéo modèle, la comparaison modèle | nous",
    sans: "aucune vidéo : ni montage, ni analyse d'un modèle",
    installer: installationFfmpeg(),
    trouver: async () => {
      try { const f = await trouverFfmpeg(); return `${f.ffmpeg} (${f.version}${f.libass ? "" : ", sans libass : pas de texte incrusté"})`; }
      catch { return null; }
    },
  },
  {
    nom: "yt-dlp",
    sert: "récupérer la vidéo d'un modèle par son URL TikTok pour la décortiquer (avec l'accord de l'utilisateur)",
    sans: "l'utilisateur télécharge la vidéo lui-même et la met dans le dossier de travail",
    installer: {
      darwin: "`brew install yt-dlp`",
      win32: "`winget install yt-dlp.yt-dlp`",
      linux: "`pipx install yt-dlp` (les paquets des distributions sont souvent trop vieux pour TikTok)",
    },
    trouver: async () => trouverYtDlp() ?? null,
  },
  {
    nom: "Whisper",
    sert: "transcrire la voix d'une vidéo modèle, horodatée (ce qui est dit, à quel rythme)",
    sans: "pas de transcription : on décortique les plans, pas les paroles (l'utilisateur peut les dicter ou les décrire)",
    installer: {
      darwin: "`brew install pipx && pipx install whisper-ctranslate2` (le modèle, ~500 Mo, se télécharge au premier usage)",
      win32: "Python d'abord (`winget install Python.Python.3.12`), puis `py -m pip install --user pipx` et `py -m pipx install whisper-ctranslate2`",
      linux: "`pipx install whisper-ctranslate2` (le modèle, ~500 Mo, se télécharge au premier usage)",
    },
    trouver: async () => {
      const w = await trouverWhisper();
      return "manque" in w ? null : `${w.exe}${w.modele ? ` (modèle ${w.modele})` : ""}`;
    },
  },
  {
    nom: "tesseract (OCR)",
    sert: "lire le texte de chaque image d'un diaporama (modele_decortiquer avec l'URL d'un post photo), sur cette machine ; avec le pack français pour les accents",
    sans: "pas de texte relevé : l'agent lit les images du diaporama lui-même (elles sont téléchargées et montrées quand même)",
    installer: {
      darwin: "`brew install tesseract tesseract-lang` (tesseract-lang apporte le français)",
      win32: "`winget install UB-Mannheim.TesseractOCR` (cocher la langue française à l'installation)",
      linux: "`sudo apt install tesseract-ocr tesseract-ocr-fra` (ou le paquet tesseract et son pack fra de sa distribution)",
    },
    trouver: async () => {
      const exe = trouverTesseract();
      if (!exe) return null;
      const l = await languesTesseract(exe);
      return `${exe} (langues : ${l.join(", ") || "aucune"}${l.includes("fra") ? "" : " ; le pack français manque : `tesseract-ocr-fra`, `tesseract-lang` ou `tesseract-data-fra` selon le système"})`;
    },
  },
  {
    nom: "Remotion",
    sert: "des animations plus riches que ffmpeg (textes animés, listes qui défilent), dans un projet Remotion à l'utilisateur",
    sans: "le montage passe par ffmpeg, qui couvre les formats courants",
    installer: "viraldar ne l'installe pas et n'en fournit pas la licence (gratuite pour un particulier ou une petite équipe, "
      + "payante au-delà : https://www.remotion.dev/license). S'il a déjà un projet Remotion, il en donne le dossier "
      + "et ajoute la famille d'outils « remotion » dans les réglages de viraldar (ou VIRALDAR_REMOTION) ; sinon, ce n'est pas nécessaire",
    trouver: async () => {
      const p = await projetRemotion();
      return "manque" in p ? null : `${p.dossier} (Remotion ${p.version})`;
    },
  },
];

export const outilsMachine: Module = (serveur, ctx: Contexte) => {
  serveur.registerTool("ma_machine", {
    title: "Ce qu'il y a sur cet ordinateur pour fabriquer",
    description: "Regarde (sans rien installer) les programmes dont dépend la fabrication : Chrome (carrousels), ffmpeg "
      + "(montage, analyse d'une vidéo), yt-dlp (vidéo d'un modèle par son URL), Whisper (transcription), tesseract (texte des "
      + "images d'un diaporama, OCR local), Remotion "
      + "(animations). Pour chacun : présent ou non, à quoi il sert, ce qu'on perd sans, et la commande à taper soi-même "
      + "pour ce système. À appeler AVANT une tâche qui en dépend (décortiquer un modèle, monter, faire un carrousel) : "
      + "explique à l'utilisateur ce qui manque et ce que ça permet, demande-lui ce qu'il veut installer, et ne commence "
      + "qu'après. viraldar n'installe rien : c'est lui qui tape les commandes.",
    annotations: { readOnlyHint: true },
  }, async () => {
    const etats = await Promise.all(PROGRAMMES.map(async (p) => ({ p, ou: await p.trouver().catch(() => null) })));
    const l = [`Système : ${NOM_OS[OS]}. Dossier de travail : ${ctx.dossierTravail}.`, ""];
    for (const { p, ou } of etats) {
      l.push(`${ou ? "✓" : "✗"} ${p.nom} — ${p.sert}.`);
      if (ou) l.push(`  trouvé : ${ou}`);
      else {
        l.push(`  sans lui : ${p.sans}.`);
        l.push(`  pour l'installer : ${typeof p.installer === "string" ? p.installer : p.installer[OS] ?? "voir le site du programme"}.`);
      }
    }
    l.push(`• Revue (revue_ouvrir) — ${resumeVisionneuses()}. Facultatif : sans visionneuse, la revue s'ouvre dans le navigateur ou dans `
      + "la conversation. L'utilisateur peut imposer la sienne (réglages « visionneuse » et « lecteur » : VIRALDAR_VISIONNEUSE, VIRALDAR_LECTEUR).");
    const manquent = etats.filter((e) => !e.ou).map((e) => e.p.nom);
    l.push("");
    if (!manquent.length) l.push("Tout est là.");
    else {
      l.push(`Manquent : ${manquent.join(", ")}. Dis à l'utilisateur, avant de commencer, ce que chacun permet pour SA demande, `
        + "et demande-lui ce qu'il veut installer. Il tape les commandes lui-même (Terminal"
        + (OS === "win32" ? " ou PowerShell" : "") + ") ; viraldar n'installe rien. Après une installation, il faut "
        + "redémarrer Claude pour que le programme soit vu.");
      l.push("Pas de synthèse vocale dans viraldar : la voix off vient de l'utilisateur ou d'un service qu'il choisit.");
    }
    return { content: [{ type: "text" as const, text: l.join("\n") }] };
  });
};
