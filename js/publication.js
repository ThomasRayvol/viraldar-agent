import { open, stat } from "node:fs/promises";
import { extname } from "node:path";
import { cheminDuTravail } from "./chemins.js";
import { z } from "zod";
const texte = (t) => ({ content: [{ type: "text", text: t }] });
const erreur = (t) => ({ content: [{ type: "text", text: t }], isError: true });
const TYPES = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm" };
const STATUTS = {
    PROCESSING_UPLOAD: "TikTok reçoit encore la vidéo",
    PROCESSING_DOWNLOAD: "TikTok télécharge encore les images",
    SEND_TO_USER_INBOX: "prêt : le brouillon attend dans la boîte de réception TikTok de l'utilisateur (notification dans l'app), à finir et publier là",
    PUBLISH_COMPLETE: "publié (ou finalisé dans l'app)",
    FAILED: "échec",
};
export const outilsPublication = (serveur, ctx) => {
    async function tiktok(corps) {
        const c = await ctx.supabase();
        if (!c)
            throw new Error(ctx.pasConnecte());
        // invoke pose Authorization (jeton de session) et apikey, comme fonctionTiktok dans site/js/commun.js.
        const { data, error } = await c.functions.invoke("tiktok", { body: corps });
        if (!error)
            return data;
        let r = {};
        try {
            r = await error.context.json();
        }
        catch { /* corps illisible */ }
        throw new Error((r.erreur || error.message) + (r.reconnecter
            ? " — le compte TikTok doit être relié à nouveau sur viraldar.rayvol.net (Mon produit → Mon TikTok)." : ""));
    }
    async function compte(choix) {
        const { comptes } = await tiktok({ action: "comptes" });
        if (!comptes?.length)
            throw new Error("Aucun compte TikTok relié : l'utilisateur doit relier le sien sur viraldar.rayvol.net (Continuer avec TikTok).");
        if (!choix) {
            if (comptes.length === 1)
                return comptes[0];
            throw new Error(`Plusieurs comptes TikTok reliés : précise \`compte\` (${comptes.map(x => "@" + x.username).join(", ")}).`);
        }
        const c = choix.replace(/^@/, "");
        const t = comptes.find(x => x.open_id === c || x.username.toLowerCase() === c.toLowerCase());
        if (!t)
            throw new Error(`Compte inconnu : ${choix}. Reliés : ${comptes.map(x => "@" + x.username).join(", ")}.`);
        return t;
    }
    const outil = (fn) => async (a) => {
        try {
            return await fn(a);
        }
        catch (e) {
            return erreur(ctx.expliquer(e.message));
        }
    };
    const champCompte = z.string().optional().describe("@username ou open_id du compte TikTok (facultatif s'il n'y en a qu'un ; voir `comptes_tiktok`).");
    serveur.registerTool("comptes_tiktok", {
        title: "Comptes TikTok reliés",
        description: "Les comptes TikTok que l'utilisateur a reliés à viraldar (@username, open_id, droits accordés). "
            + "Un brouillon part vers l'un d'eux ; il faut le droit `video.upload`.",
        inputSchema: {},
    }, outil(async () => {
        const { comptes } = await tiktok({ action: "comptes" });
        if (!comptes?.length)
            return texte("Aucun compte TikTok relié : à faire sur viraldar.rayvol.net (Continuer avec TikTok).");
        return texte(comptes.map(x => `@${x.username}${x.display_name ? ` (${x.display_name})` : ""} · open_id ${x.open_id} · droits : ${x.scopes || "?"}`).join("\n"));
    }));
    serveur.registerTool("envoyer_brouillon_video", {
        title: "Envoyer une vidéo en brouillon TikTok",
        description: "Envoie un fichier vidéo local (mp4, mov ou webm, 4 Go au plus) dans les brouillons TikTok de "
            + "l'utilisateur : il reçoit une notification dans l'app TikTok et finit la publication lui-même (texte, son, "
            + "visibilité). Rien n'est publié directement. Rend un publish_id à suivre avec `statut_brouillon`.",
        inputSchema: {
            fichier: z.string().describe("Chemin de la vidéo, dans le dossier de travail (sortie de montage_*)."),
            compte: champCompte,
        },
    }, outil(async ({ fichier, compte: choix }) => {
        // Ce fichier quitte la machine : seulement depuis le dossier de travail (une injection de prompt ne doit pas
        // pouvoir envoyer une vidéo privée de l'utilisateur, même dans ses propres brouillons).
        const chemin = await cheminDuTravail(fichier, ctx.dossierTravail, Object.keys(TYPES));
        const type = TYPES[extname(chemin).toLowerCase()];
        const s = await stat(chemin);
        if (s.size > 4 * 1024 ** 3)
            throw new Error("Vidéo trop lourde : 4 Go au plus.");
        const t = await compte(choix);
        const init = await tiktok({ action: "brouillon_video_init", open_id: t.open_id, taille_octets: s.size });
        const { publish_id, upload_url, morceau_octets: m, nb_morceaux: n } = init;
        if (!upload_url || !m || !n)
            throw new Error("Réponse inattendue de la fonction tiktok : " + JSON.stringify(init));
        // La vidéo ne part que vers TikTok, en https, quoi que rende la fonction.
        const dest = new URL(upload_url);
        if (dest.protocol !== "https:" || !/(^|\.)tiktokapis\.com$/.test(dest.hostname))
            throw new Error(`Adresse d'envoi inattendue (${dest.hostname}) : envoi annulé.`);
        const f = await open(chemin, "r");
        try {
            for (let i = 0; i < n; i++) {
                const debut = i * m, fin = i === n - 1 ? s.size - 1 : debut + m - 1; // le dernier morceau absorbe le reste
                const morceau = Buffer.alloc(fin - debut + 1);
                await f.read(morceau, 0, morceau.length, debut);
                let rep = null;
                for (let essai = 0; essai < 3; essai++) {
                    rep = await fetch(upload_url, { method: "PUT", body: morceau,
                        headers: { "Content-Type": type, "Content-Range": `bytes ${debut}-${fin}/${s.size}` } }).catch(() => null);
                    if (rep && rep.status < 500)
                        break;
                    await new Promise(r => setTimeout(r, 2000 * (essai + 1)));
                }
                if (!rep)
                    throw new Error(`Morceau ${i + 1}/${n} : TikTok injoignable.`);
                const attendu = i === n - 1 ? [201, 200] : [206, 200, 201];
                if (!attendu.includes(rep.status)) {
                    const raison = rep.status === 403 ? "l'adresse d'envoi a expiré, recommence"
                        : rep.status === 416 ? "plage refusée (envoi désynchronisé), recommence" : await rep.text().catch(() => "");
                    throw new Error(`Morceau ${i + 1}/${n} refusé par TikTok (HTTP ${rep.status}) : ${raison}`);
                }
            }
        }
        finally {
            await f.close();
        }
        return texte(`Vidéo envoyée vers @${t.username} (${(s.size / 1e6).toFixed(1)} Mo, ${n} morceau${n > 1 ? "x" : ""}). `
            + `publish_id : ${publish_id}. TikTok la traite : vérifie avec \`statut_brouillon\` ; une fois prête, l'utilisateur `
            + "la retrouve dans les notifications de son app TikTok pour la finir.");
    }));
    serveur.registerTool("envoyer_brouillon_photos", {
        title: "Envoyer un carrousel en brouillon TikTok",
        description: "Envoie un carrousel de photos dans les brouillons TikTok de l'utilisateur (il le finit dans l'app). "
            + "Les images doivent DÉJÀ être en ligne à des URL publiques que TikTok va télécharger (JPEG ou WebP, 35 au plus, "
            + "dans l'ordre ; TikTok n'accepte que des domaines vérifiés par l'app viraldar). Cet outil n'héberge pas les "
            + "fichiers locaux : un carrousel fabriqué en local doit d'abord être mis en ligne par un autre moyen.",
        inputSchema: {
            urls: z.array(z.string().url()).min(1).max(35).describe("URL publiques des images, dans l'ordre du carrousel."),
            titre: z.string().max(90).optional(),
            description: z.string().max(4000).optional().describe("Texte du post (hashtags compris)."),
            compte: champCompte,
        },
    }, outil(async ({ urls, titre, description, compte: choix }) => {
        const t = await compte(choix);
        const { publish_id } = await tiktok({ action: "brouillon_photos", open_id: t.open_id, urls, titre, description });
        return texte(`Carrousel de ${urls.length} images envoyé vers @${t.username}. publish_id : ${publish_id}. `
            + "Vérifie avec `statut_brouillon` (TikTok télécharge les images).");
    }));
    serveur.registerTool("statut_brouillon", {
        title: "Où en est un brouillon TikTok",
        description: "L'état d'un envoi (publish_id rendu par `envoyer_brouillon_video` ou `envoyer_brouillon_photos`) : "
            + "en cours, prêt dans la boîte de réception TikTok de l'utilisateur, ou échec avec sa raison.",
        inputSchema: { publish_id: z.string(), compte: champCompte },
    }, outil(async ({ publish_id, compte: choix }) => {
        const t = await compte(choix);
        const { statut, raison } = await tiktok({ action: "brouillon_statut", open_id: t.open_id, publish_id });
        return texte(`${statut}${STATUTS[statut] ? ` — ${STATUTS[statut]}` : ""}${raison ? ` (raison : ${raison})` : ""}`);
    }));
};
