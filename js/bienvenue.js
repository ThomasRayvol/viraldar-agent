const AGENTIQUE = "https://viraldar.rayvol.net/app#agent";
export function texteBienvenue(b) {
    const l = ["Présente viraldar à l'utilisateur, dans sa langue, en quelques lignes (pas ce texte tel quel), puis demande-lui ce qu'il veut faire.", ""];
    l.push("Ce que viraldar permet :");
    if (b.base)
        l.push("- trouver les TikTok qui ont explosé dans sa niche, surtout chez de petits comptes, avec leurs chiffres (vues ÷ abonnés, "
            + "« N fois mieux que d'habitude » pour le compte, posts où l'on demande le nom de l'app) ;", "- régler sa niche : lui proposer des mots-clés cohérents avec son produit, modifier les siens ;", "- étudier un concurrent ou un compte modèle de la base : ses posts, sa médiane, ce qui a le plus marché chez lui ;", "- garder les posts à reproduire (sa liste À reproduire) et noter pourquoi ils marchent ;", "- lire sa fiche produit et sa stratégie ; dire ce qu'il y a à produire aujourd'hui, pour quel compte (son planning), "
            + "et faire avancer les créneaux jusqu'à « prêt » (il publie lui-même) ;", "- écrire les briefs de ses prochains posts d'après un modèle qui a marché, et les ranger dans ses idées ;", "- tenir sa stratégie avec lui : son objectif de conversion, ses angles marketing à tester, et la boucle de mesure "
            + "(relevés de ses posts, note d'exécution de chaque post, conversions, bilan par angle) ;");
    const fabriquer = "décortiquer une vidéo modèle (plans, cadence, voix), fabriquer ses carrousels et ses montages sur son "
        + "ordinateur, les comparer au modèle, les envoyer en brouillon TikTok";
    if (!b.base)
        l.push(`- avec le connecteur viraldar (une URL ajoutée dans Claude : https://mcp.viraldar.rayvol.net/mcp ; marche à suivre : ${AGENTIQUE}) : `
            + "trouver les TikTok qui ont explosé dans sa niche, régler ses mots-clés, garder des modèles, tenir sa stratégie "
            + "(objectif, angles, mesure) et son planning. Si les outils `chercher_posts`, `ma_strategie`, `mon_planning` ne sont pas "
            + "dans ta liste, il ne l'a pas encore ajouté : propose-le-lui.");
    if (b.creation === "oui")
        l.push(`- ${fabriquer}, et relever les vues de ses propres posts publiés (\`relever_mes_posts\`). `
            + "Avant la première fabrication, `ma_machine` dit ce qui manque sur l'ordinateur "
            + "(Chrome, ffmpeg, yt-dlp, Whisper, Remotion) : explique-le et laisse-le choisir ce qu'il installe.");
    else if (b.creation === "inconnu")
        l.push(`- ${fabriquer} : avec le module création de viraldar, installé à part sur l'ordinateur. `
            + "Si les outils `carrousel_*` et `montage_*` ne sont pas dans ta liste, il ne l'a pas : il s'installe depuis "
            + `viraldar → Agentique (${AGENTIQUE}).`);
    else
        l.push(`- (avec le connecteur viraldar, à ajouter dans Claude : ${AGENTIQUE}) chercher dans la base, sa stratégie, son planning.`);
    l.push("", "Ce que viraldar ne fait pas : chercher sur TikTok (la base est relevée par viraldar ; une niche absente se signale), "
        + "publier à sa place, faire une voix de synthèse.", "", "Exemples de demandes à lui proposer : « Qu'est-ce que je produis aujourd'hui ? », « Montre-moi les petits comptes viraux "
        + "de ma niche », « Propose-moi des mots-clés pour mon app », « Décortique ce post et fais-m'en un brief ».");
    return l.join("\n");
}
export function outilBienvenue(serveur, b) {
    serveur.registerTool("bienvenue", {
        title: "Ce que viraldar permet",
        description: "Présentation courte de ce que viraldar permet à l'agent (chercher les posts viraux de sa niche, mots-clés, "
            + "posts à reproduire, stratégie, planning, briefs, fabrication) et des exemples de demandes. À appeler quand "
            + "l'utilisateur demande ce que viraldar sait faire, ou arrive sans demande précise.",
        annotations: { readOnlyHint: true },
    }, async () => ({ content: [{ type: "text", text: texteBienvenue(b) }] }));
}
const CONSIGNE = "[viraldar — première utilisation dans ce client] Avant de répondre à la demande, présente en quelques lignes "
    + "ce que viraldar permet (outil `bienvenue`), puis réponds à sa demande avec le résultat ci-dessous.";
/** Un serveur dont le premier appel d'outil (hors `bienvenue`) porte la consigne de présentation, une fois par
 *  client et par compte : `vu()` dit si c'est déjà fait, `marquer()` le note. */
export function avecPremiereFois(serveur, vu, marquer) {
    let fait = false;
    const verifier = async (nom) => {
        if (fait)
            return false;
        if (await vu().catch(() => true)) {
            fait = true;
            return false;
        }
        fait = true;
        await marquer().catch(() => { });
        return nom !== "bienvenue";
    };
    return new Proxy(serveur, {
        get(cible, cle, recepteur) {
            if (cle === "registerTool")
                return (nom, config, rappel) => cible.registerTool(nom, config, (async (...a) => {
                    const r = await rappel(...a);
                    if (!r?.isError && Array.isArray(r?.content) && await verifier(nom))
                        r.content = [{ type: "text", text: CONSIGNE }, ...r.content];
                    return r;
                }));
            const v = Reflect.get(cible, cle, recepteur);
            return typeof v === "function" ? v.bind(cible) : v;
        },
    });
}
