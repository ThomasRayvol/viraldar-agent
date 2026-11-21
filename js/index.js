#!/usr/bin/env node
// Le MCP local de viraldar (stdio). Un module par chantier, chacun dans son fichier :
//   auth.ts        connexion à viraldar, session gardée en local       (fournit le Contexte)
//   base.ts        chercher dans la base viraldar (posts_page, quotas) — jamais de recherche TikTok
//   plan.ts        son travail : stratégie, planning (créneaux à produire, statuts), idées de la Bibliothèque
//   rendu.ts       le rendu commun (nombres, URL d'un post, marquage ⟦ ⟧ des textes d'inconnus)
//   publication.ts brouillons TikTok (fonction Supabase `tiktok`)
//   creation/carrousel.ts  carrousels HTML -> PNG (Chromium headless)
//   creation/montage.ts    montage ffmpeg, Remotion si l'utilisateur l'a
//   creation/analyse.ts    voir un modèle (modele_decortiquer) et s'y comparer (montage_comparaison), famille montage
//   creation/revue.ts      la revue du lot : planche avec la lecture, dossier revue/<jour>/, revue_ouvrir, famille montage
//   methode.ts     la méthode (le skill) servie en prompt, ressources et outil
//
// Familles d'outils (VIRALDAR_OUTILS, séparées par des virgules ; « tout » pour toutes) : chaque outil chargé pèse
// sur le contexte de l'agent à chaque conversation. Par défaut (0.6.0, 19/11/2026) : carrousel, montage — le module
// création ; la base, la stratégie et le planning passent par le connecteur distant (connecteur/). La famille `base`
// (base.ts, plan.ts, strategie.ts) reste à la demande (`base,carrousel,montage`) pour qui n'a que le MCP local ; un
// réglage déjà posé à `base,…` la garde. `relever_mes_posts` et `ma_machine` viennent avec la fabrication.
// `publication` attend la validation de l'app TikTok (seuls les testeurs s'en servent) ; `remotion` ne sert qu'à qui a
// un projet Remotion.
// La connexion et la méthode sont toujours là.
import "./env.js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { creerContexte, declarerAgent, nommerClient, outilsAuth } from "./auth.js";
import { outilsBase } from "./base.js";
import { outilsPlan } from "./plan.js";
import { outilsStrategie } from "./strategie.js";
import { outilsPublication } from "./publication.js";
import { outilsCarrousel } from "./creation/carrousel.js";
import { outilsMontage } from "./creation/montage.js";
import { outilsAnalyse } from "./creation/analyse.js";
import { outilsRevue } from "./creation/revue.js";
import { servirMethode } from "./methode.js";
import { avecPremiereFois, outilBienvenue } from "./bienvenue.js";
import { outilsMachine } from "./creation/machine.js";
import { outilsReleve } from "./creation/releve.js";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONSIGNES_COMMUNES } from "./consignes.js";
import { sousRacine } from "./racine.js";
const VERSION = JSON.parse(readFileSync(sousRacine("package.json"), "utf8")).version;
const FAMILLES = ["base", "carrousel", "montage", "publication", "remotion"];
// 0.6.0 (19/11/2026) : le MCP local devient le module création. La base, la stratégie et le planning viennent du
// connecteur distant (https://mcp.viraldar.rayvol.net/mcp) ; `base` reste à la demande pour qui n'a que le local.
const PAR_DEFAUT = ["carrousel", "montage"];
const demande = (process.env.VIRALDAR_OUTILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const actives = new Set(demande.includes("tout") ? FAMILLES : demande.length ? demande : PAR_DEFAUT);
const inconnues = [...actives].filter((f) => !FAMILLES.includes(f));
if (inconnues.length)
    console.error(`viraldar : familles inconnues dans VIRALDAR_OUTILS : ${inconnues.join(", ")} (connues : ${FAMILLES.join(", ")}, tout).`);
const AVEC_BASE = actives.has("base");
const INSTRUCTIONS = [
    AVEC_BASE
        ? "viraldar : une base de posts TikTok viraux (déjà relevés ; aucun outil ne cherche sur TikTok) et des outils pour créer sur la machine de l'utilisateur."
        : "viraldar création : les outils qui fabriquent sur la machine de l'utilisateur (carrousels, montages, analyse d'une vidéo modèle, relevé de ses propres posts). "
            + "La base de posts viraux, les mots-clés, la stratégie, le planning et les idées viennent du connecteur viraldar (https://mcp.viraldar.rayvol.net/mcp, "
            + "ajouté dans Claude) : si ses outils (`chercher_posts`, `ma_strategie`, `mon_planning`…) manquent, propose-lui de l'ajouter (viraldar → Agentique).",
    ...(AVEC_BASE ? CONSIGNES_COMMUNES : CONSIGNES_COMMUNES.filter((c) => !c.startsWith("Quota"))),
    AVEC_BASE
        ? "Sans session, les outils de la base répondent « pas connecté » : appelle `connexion`, montre le lien rendu à l'utilisateur (il autorise dans son navigateur ; ne demande jamais son mot de passe), puis `connexion` avec `attendre: true`."
        : "`connexion` ne sert qu'aux outils qui lisent ou écrivent son compte viraldar (`relever_mes_posts`, brouillons TikTok) : appelle-la seulement quand l'un d'eux répond « pas connecté », montre le lien rendu (il autorise dans son navigateur ; ne demande jamais son mot de passe), puis `connexion` avec `attendre: true`.",
    "Avant une première fabrication (carrousel, montage, analyse d'une vidéo modèle), appelle `ma_machine` : explique ce qui manque et ce que ça permet, laisse l'utilisateur installer ce qu'il veut (il tape les commandes lui-même), puis commence.",
    "Les outils ne lisent que les médias du dossier de travail (sauf si l'utilisateur a élargi la lecture lui-même) : si un fichier est refusé, propose-lui de l'y copier ou d'élargir lui-même la lecture (réglage « lecture », le message d'erreur dit comment) ; ne modifie jamais ce réglage à sa place.",
].join("\n");
const serveur = new McpServer({ name: "viraldar", version: VERSION }, { instructions: INSTRUCTIONS });
const ctx = await creerContexte();
// viraldar → Agentique : la connexion se nomme d'après le client MCP (Claude Code, Claude Desktop…), et une session
// gardée se redéclare à chaque démarrage (vue_le), sans bloquer ni rien dire si elle n'existe pas.
nommerClient(() => {
    const c = serveur.server.getClientVersion();
    return c ? [c.name, c.version].filter(Boolean).join(" ") : undefined;
});
serveur.server.oninitialized = () => {
    declarerAgent().catch((e) => console.error("viraldar : declarer_agent :", e.message));
};
// La présentation au premier usage (bienvenue.ts) : une fois par client MCP sur cette machine, notée dans
// ~/.config/viraldar/bienvenue.json.
const FICHIER_BIENVENUE = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "viraldar", "bienvenue.json");
const lireBienvenue = () => { try {
    return JSON.parse(readFileSync(FICHIER_BIENVENUE, "utf8"));
}
catch {
    return {};
} };
const nomDuClient = () => serveur.server.getClientVersion()?.name || "client MCP";
const accueillant = avecPremiereFois(serveur, async () => !!lireBienvenue()[nomDuClient()], async () => {
    mkdirSync(join(FICHIER_BIENVENUE, ".."), { recursive: true, mode: 0o700 });
    writeFileSync(FICHIER_BIENVENUE, JSON.stringify({ ...lireBienvenue(), [nomDuClient()]: new Date().toISOString() }, null, 2));
});
/** N'enregistre que les outils dont le nom passe le filtre (Remotion vit dans le module montage). */
const seulement = (garder) => new Proxy(accueillant, {
    get(cible, cle, recepteur) {
        if (cle === "registerTool")
            return (nom, ...reste) => garder(nom) ? cible.registerTool.call(cible, nom, ...reste) : undefined;
        const v = Reflect.get(cible, cle, recepteur);
        return typeof v === "function" ? v.bind(cible) : v;
    },
});
const charger = [
    [null, outilsAuth],
    ["base", outilsBase],
    ["base", outilsPlan],
    ["base", outilsStrategie],
    ["publication", outilsPublication],
    ["carrousel", outilsCarrousel],
    ["montage", outilsMontage, (n) => !n.startsWith("remotion_")],
    ["montage", outilsAnalyse],
    ["montage", outilsRevue],
    ["remotion", outilsMontage, (n) => n.startsWith("remotion_")],
];
for (const [famille, m, garder] of charger) {
    if (famille && !actives.has(famille))
        continue;
    m(garder ? seulement(garder) : accueillant, ctx);
}
const creation = actives.has("carrousel") || actives.has("montage");
if (creation)
    outilsMachine(accueillant, ctx);
// relever_mes_posts : la boucle de mesure sur ses propres comptes (yt-dlp, cette machine, session viraldar) ; avec la
// fabrication (0.6.0 : le connecteur ne peut pas lancer yt-dlp) ou avec la base.
if (creation || AVEC_BASE)
    outilsReleve(accueillant, ctx);
outilBienvenue(accueillant, { base: AVEC_BASE, creation: creation ? "oui" : "non" });
servirMethode(serveur);
// Alléger tools/list : le `$schema` de chaque schéma et `execution` n'apprennent rien au modèle.
const transport = new StdioServerTransport();
const envoyer = transport.send.bind(transport);
transport.send = (m, ...r) => {
    const outils = m.result?.tools;
    if (Array.isArray(outils))
        for (const o of outils) {
            delete o.execution;
            for (const s of [o.inputSchema, o.outputSchema])
                if (s)
                    delete s.$schema;
        }
    return envoyer(m, ...r);
};
await serveur.connect(transport);
