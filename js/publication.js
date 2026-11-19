import { open, readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
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
// Les raisons d'échec les plus courantes (fail_reason de TikTok), dites clairement ; les autres telles quelles.
const RAISONS = {
    picture_size_check_failed: "image refusée : dimensions hors des limites de TikTok (1080 × 1920 conseillé)",
    file_format_check_failed: "format refusé (JPEG ou WebP pour les images, MP4/MOV/WebM pour une vidéo)",
    photo_pull_failed: "TikTok n'a pas pu télécharger les images",
    video_pull_failed: "TikTok n'a pas pu télécharger la vidéo",
    auth_removed: "l'utilisateur a retiré l'accès de viraldar à ce compte TikTok",
    spam_risk_too_many_posts: "trop d'envois sur 24 h pour ce compte",
    publish_cancelled: "envoi annulé",
};
const etatLisible = (statut, raison) => `${statut}${STATUTS[statut] ? ` — ${STATUTS[statut]}` : ""}`
    + (raison ? ` (raison : ${RAISONS[raison] ? `${RAISONS[raison]} — ${raison}` : raison})` : "");
const TYPES_PHOTO = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const PHOTOS_MAX = 35, PHOTO_MAX_OCTETS = 20 * 1024 * 1024;
const SUIVI_PAUSE_MS = 4000, SUIVI_MAX_MS = 90_000; // statut : 30 appels par minute et par jeton chez TikTok
/** Les premiers octets disent le vrai type (une extension se renomme). */
async function signatureImage(chemin, type) {
    const f = await open(chemin, "r");
    try {
        const b = Buffer.alloc(12);
        await f.read(b, 0, 12, 0);
        return type === "image/jpeg" ? b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
            : b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP";
    }
    finally {
        await f.close();
    }
}
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
    /** Les comptes reliés, et ceux du produit actif (tous si la fonction ne dit pas encore le produit de chacun). */
    async function lesComptes() {
        const { comptes } = await tiktok({ action: "comptes" });
        const tous = comptes || [];
        let produit = null;
        try {
            produit = (await ctx.produits())?.actif ?? null;
        }
        catch { /* base pas encore multi-produits */ }
        const range = tous.some(x => x.produit_id);
        return { tous, produit, duProduit: produit && range ? tous.filter(x => x.produit_id === produit.id) : tous };
    }
    async function compte(choix) {
        const { tous: comptes, duProduit, produit } = await lesComptes();
        if (!comptes?.length)
            throw new Error("Aucun compte TikTok relié : l'utilisateur doit relier le sien sur viraldar.rayvol.net (Continuer avec TikTok).");
        if (!choix) {
            if (duProduit.length === 1)
                return duProduit[0];
            if (!duProduit.length)
                throw new Error(`Aucun compte TikTok relié au produit ${produit?.nom ?? "actif"} : précise \`compte\` `
                    + `(reliés : ${comptes.map(x => "@" + x.username).join(", ")}), ou range un compte dans ce produit sur viraldar.rayvol.net (Mon produit).`);
            throw new Error(`Plusieurs comptes TikTok pour ce produit : précise \`compte\` (${duProduit.map(x => "@" + x.username).join(", ")}).`);
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
    const champCompte = z.string().optional().describe("@username ou open_id du compte TikTok (facultatif si le produit actif n'en a qu'un ; voir `comptes_tiktok`).");
    serveur.registerTool("comptes_tiktok", {
        title: "Comptes TikTok reliés",
        description: "Les comptes TikTok que l'utilisateur a reliés à viraldar (@username, open_id, droits accordés), ceux "
            + "du produit actif d'abord (chaque compte est rangé dans un produit). Un brouillon part vers l'un d'eux ; il faut "
            + "le droit `video.upload`. `tous: true` montre aussi ceux des autres produits.",
        inputSchema: { tous: z.boolean().optional().describe("Aussi les comptes rangés dans les autres produits.") },
    }, outil(async ({ tous: voirTous }) => {
        const { tous, duProduit, produit } = await lesComptes();
        if (!tous.length)
            return texte("Aucun compte TikTok relié : à faire sur viraldar.rayvol.net (Continuer avec TikTok).");
        const ligne = (x) => `@${x.username}${x.display_name ? ` (${x.display_name})` : ""} · open_id ${x.open_id} · droits : ${x.scopes || "?"}`;
        const autres = tous.filter(x => !duProduit.includes(x));
        const l = [produit ? `Produit actif : ${produit.nom}` : null,
            ...(duProduit.length ? duProduit.map(ligne) : ["(aucun compte TikTok rangé dans ce produit)"])];
        if (autres.length)
            l.push(voirTous ? "Autres produits :" : `+ ${autres.length} compte(s) d'autres produits (\`tous: true\`).`, ...(voirTous ? autres.map(ligne) : []));
        return texte(l.filter(Boolean).join("\n"));
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
        description: "Envoie un carrousel de photos dans les brouillons TikTok de l'utilisateur (il le finit dans l'app : "
            + "son, visibilité, publication). Donne `fichiers` : les images locales du dossier de travail, dans l'ordre "
            + "(JPEG ou WebP, 35 au plus, 20 Mo chacune ; TikTok refuse le PNG : rends le carrousel avec `sortie: \"jpeg\"`). "
            + "Elles passent quelques secondes en transit sur le stockage de viraldar, le temps que TikTok les télécharge, "
            + "puis sont effacées. Rend un publish_id à suivre avec `statut_brouillon`. (`urls` : seulement des images déjà en "
            + "ligne sur un domaine vérifié par l'app viraldar chez TikTok.)",
        inputSchema: {
            fichiers: z.array(z.string()).min(1).max(PHOTOS_MAX).optional()
                .describe("Chemins des images, dans l'ordre du carrousel (ex. carrousels/<nom>/01.jpg…)."),
            urls: z.array(z.string().url()).min(1).max(PHOTOS_MAX).optional().describe("À la place de `fichiers`, rarement utile."),
            titre: z.string().max(90).optional().describe("Titre du post (90 caractères au plus)."),
            description: z.string().max(4000).optional().describe("Texte du post (hashtags compris)."),
            compte: champCompte,
        },
    }, outil(async ({ fichiers, urls, titre, description, compte: choix }) => {
        if (!!fichiers === !!urls)
            throw new Error("Donne `fichiers` (les images locales) ou `urls`, pas les deux.");
        if (!fichiers) {
            const t = await compte(choix);
            const { publish_id } = await tiktok({ action: "brouillon_photos", open_id: t.open_id, urls, titre, description });
            return texte(`Carrousel de ${urls.length} images envoyé vers @${t.username}. publish_id : ${publish_id}. `
                + "Vérifie avec `statut_brouillon` (TikTok télécharge les images).");
        }
        // Ces fichiers quittent la machine : seulement du dossier de travail, et seulement des images (signature lue).
        const images = [];
        for (const f of fichiers) {
            const ext = extname(f).toLowerCase();
            if (ext === ".png")
                throw new Error(`${f} : TikTok refuse le PNG. Rends le carrousel avec \`sortie: "jpeg"\` (carrousel_rendre).`);
            const chemin = await cheminDuTravail(f, ctx.dossierTravail, Object.keys(TYPES_PHOTO), `Rends le carrousel avec carrousel_rendre (sortie dans ${join(ctx.dossierTravail, "carrousels")}), ou demande à l'utilisateur d'y copier ses images.`);
            const type = TYPES_PHOTO[extname(chemin).toLowerCase()];
            if (!(await signatureImage(chemin, type)))
                throw new Error(`${f} : ce n'est pas une image ${type === "image/webp" ? "WebP" : "JPEG"}.`);
            const taille = (await stat(chemin)).size;
            if (taille > PHOTO_MAX_OCTETS)
                throw new Error(`${f} : plus de 20 Mo, TikTok la refusera.`);
            images.push({ chemin, type, taille });
        }
        const t = await compte(choix);
        const tr = await tiktok({ action: "transit_photos", open_id: t.open_id,
            photos: images.map(({ type, taille }) => ({ type, taille })) });
        if (!tr?.lot || tr.envois?.length !== images.length)
            throw new Error("Réponse inattendue de la fonction tiktok (transit).");
        let garder = false; // vrai seulement si TikTok n'a pas fini de télécharger : on laisse alors le filet de 24 h
        try {
            await Promise.all(images.map(async (im, k) => {
                const { envoi, entetes } = tr.envois[k];
                const dest = new URL(envoi); // les images ne partent que vers le stockage R2 de viraldar, en https
                if (dest.protocol !== "https:" || !dest.hostname.endsWith(".r2.cloudflarestorage.com"))
                    throw new Error("Adresse d'envoi inattendue : rien n'a été envoyé.");
                const corps = await readFile(im.chemin);
                let rep = null;
                for (let essai = 0; essai < 3; essai++) {
                    rep = await fetch(envoi, { method: "PUT", body: corps, headers: entetes }).catch(() => null);
                    if (rep && rep.status < 500)
                        break;
                    await new Promise(r => setTimeout(r, 2000 * (essai + 1)));
                }
                if (!rep?.ok)
                    throw new Error(`Image ${k + 1} : envoi refusé (HTTP ${rep?.status ?? "injoignable"}).`);
            }));
            const { publish_id } = await tiktok({ action: "brouillon_photos", open_id: t.open_id,
                urls: tr.envois.map(e => e.url), titre, description });
            // TikTok tire les images en quelques secondes d'ordinaire ; on attend qu'il ait fini avant de vider le lot.
            let statut = "PROCESSING_DOWNLOAD", raison;
            const debut = Date.now();
            while (statut === "PROCESSING_DOWNLOAD" && Date.now() - debut < SUIVI_MAX_MS) {
                await new Promise(r => setTimeout(r, SUIVI_PAUSE_MS));
                ({ statut, raison } = await tiktok({ action: "brouillon_statut", open_id: t.open_id, publish_id }));
            }
            garder = statut === "PROCESSING_DOWNLOAD";
            const etat = etatLisible(statut, raison);
            return texte(`Carrousel de ${images.length} images envoyé vers @${t.username}. publish_id : ${publish_id}. État : ${etat}. `
                + (garder ? "TikTok télécharge encore : les images restent en transit 24 h au plus, puis sont effacées ; vérifie plus tard avec `statut_brouillon`."
                    : statut === "FAILED" ? "Images effacées du transit."
                        : "Images effacées du transit. Si ce n'est pas encore dans la boîte de réception TikTok, `statut_brouillon` le dira (parfois plusieurs minutes)."));
        }
        finally {
            if (!garder)
                await tiktok({ action: "transit_vider", lot: tr.lot }).catch(() => { });
        }
    }));
    serveur.registerTool("statut_brouillon", {
        title: "Où en est un brouillon TikTok",
        description: "L'état d'un envoi (publish_id rendu par `envoyer_brouillon_video` ou `envoyer_brouillon_photos`) : "
            + "en cours, prêt dans la boîte de réception TikTok de l'utilisateur, ou échec avec sa raison.",
        inputSchema: { publish_id: z.string(), compte: champCompte },
    }, outil(async ({ publish_id, compte: choix }) => {
        const t = await compte(choix);
        const { statut, raison } = await tiktok({ action: "brouillon_statut", open_id: t.open_id, publish_id });
        return texte(etatLisible(statut, raison));
    }));
};
