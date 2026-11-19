// relever_mes_posts (19/11/2026, stratégie v2 étape 4 ; arbitré par le propriétaire le 18/11/2026 : « l'agent de
// l'utilisateur peut remplir la boucle et faire les relevés lui-même sur le TikTok du user, avec yt-dlp »).
// Sur la machine de l'utilisateur : un appel `yt-dlp --flat-playlist -J` par compte (son catalogue public, comme
// src/catalogues.py chez viraldar), SEULEMENT pour les comptes qu'il a déclarés dans viraldar pour le produit actif
// (ses comptes de plan, son @ d'accueil, ses comptes TikTok reliés) — jamais un autre @ : ce n'est pas un outil pour
// relever des concurrents (arbitré le 18/11/2026 : un concurrent absent de la base, c'est viraldar qui le relève).
// Les posts sont rapprochés des créneaux publiés par leur URL (ou, sans URL, par le compte et la date de publication,
// s'il n'y a qu'un candidat ; l'URL est alors posée) et chaque relevé va dans `resultats` (source « releve »).
// Aucun texte de post n'est gardé ni rendu : seulement des identifiants et des compteurs.
import { z } from "zod";
import { erreur, texte } from "../rendu.js";
import { executer } from "./montage.js";
import { trouverYtDlp } from "./analyse.js";
const PSEUDO = /^[a-z0-9._]{2,24}$/;
const idVideo = (url) => url?.match(/\/(?:video|photo)\/(\d{8,25})/)?.[1] ?? null;
const FENETRE_H = 36; // sans URL, un post rapproché d'un créneau publié à ± 36 h de sa date de publication
export const outilsReleve = (serveur, ctx) => {
    async function sb() {
        const c = await ctx.supabase();
        if (!c)
            throw new Error(ctx.pasConnecte());
        return c;
    }
    /** Les comptes de l'utilisateur pour le produit actif, et eux seuls. */
    async function sesComptes(c) {
        const [pc, ac, ct] = await Promise.all([
            c.from("plan_comptes").select("pseudo, reseau"),
            c.from("accueil").select("compte").maybeSingle(),
            c.from("comptes_tiktok").select("username"),
        ]);
        const s = new Set();
        (pc.data || []).filter((x) => (x.reseau || "tiktok") === "tiktok").forEach((x) => s.add(String(x.pseudo).toLowerCase()));
        if (ac.data?.compte)
            s.add(String(ac.data.compte).replace(/^@/, "").toLowerCase());
        (ct.data || []).forEach((x) => x.username && s.add(String(x.username).toLowerCase()));
        return new Set([...s].filter(p => PSEUDO.test(p)));
    }
    serveur.registerTool("relever_mes_posts", {
        title: "Relever les vues de mes posts publiés",
        description: "Lit sur TikTok (yt-dlp, sur cette machine) les vues, likes, commentaires et partages des posts publiés par "
            + "l'utilisateur, SEULEMENT sur ses propres comptes déclarés dans viraldar pour le produit actif (comptes de son planning, "
            + "son @ d'accueil, comptes reliés) ; jamais un autre compte. Rapproche chaque post d'un créneau « publié » du planning "
            + "(par son lien, sinon par le compte et la date) et enregistre le relevé : c'est la boucle de mesure (`bilan`). À "
            + "lancer à 8 h, 48 h et 7 jours après une publication (`bilan` dit les relevés dus). yt-dlp doit être installé "
            + "(`ma_machine`) ; sinon, les chiffres de l'utilisateur et `noter_resultats`.",
        inputSchema: {
            compte: z.string().max(31).optional().describe("Un seul de ses comptes (@pseudo) ; absent = tous ses comptes déclarés."),
            posts: z.number().int().min(5).max(200).optional().describe("Les N posts les plus récents de chaque compte (60 par défaut)."),
            produit: z.string().max(80).optional().describe("Le produit (nom ou id) dont relever les comptes ; absent = le produit actif de ce "
                + "module. Le connecteur viraldar garde son propre produit actif : donne-le ici s'il diffère."),
        },
    }, async (a) => {
        try {
            const c = await sb();
            // Le module création (0.6.0) n'a plus mes_produits / choisir_produit par défaut : le produit se donne ici.
            const P = await ctx.produits();
            if (a.produit && P) {
                const v = a.produit.trim().toLowerCase();
                const t = P.liste.find((x) => x.id === a.produit.trim() || x.nom.trim().toLowerCase() === v);
                if (!t)
                    return erreur(`Produit introuvable : ${a.produit} (produits : ${P.liste.map((x) => x.nom).join(", ")}).`);
                if (t.id !== P.actif.id)
                    ctx.choisirProduit(t.id);
            }
            const yt = trouverYtDlp();
            if (!yt)
                return erreur("yt-dlp n'est pas installé sur cette machine : `ma_machine` donne la commande à taper. En attendant, "
                    + "demande ses chiffres à l'utilisateur et enregistre-les avec `noter_resultats`.");
            const siens = await sesComptes(c);
            const voulu = a.compte?.replace(/^@/, "").trim().toLowerCase();
            if (voulu && !siens.has(voulu))
                return erreur(`@${voulu} n'est pas un compte déclaré de l'utilisateur pour ce produit `
                    + `(${[...siens].map(x => "@" + x).join(", ") || "aucun"}). Ce relevé ne lit que ses propres comptes ; un compte à lui `
                    + "s'ajoute dans son planning (Planning → Modifier le plan) ou dans l'accueil.");
            const comptes = voulu ? [voulu] : [...siens];
            if (!comptes.length)
                return erreur("Aucun compte TikTok déclaré pour ce produit (planning, accueil ou compte relié).");
            // les créneaux publiés (ou avec un lien) de ces comptes
            const { data: cps } = await c.from("plan_comptes").select("id, pseudo");
            const pseudoDe = new Map((cps || []).map((k) => [k.id, String(k.pseudo).toLowerCase()]));
            const { data: crs, error: ec } = await c.from("plan_creneaux").select("id, compte_id, statut, tiktok_url, publie_le, statut_le")
                .or("statut.eq.publie,tiktok_url.not.is.null");
            if (ec)
                throw new Error(ec.message);
            const creneaux = (crs || []).map((x) => ({ ...x, compte: pseudoDe.get(x.compte_id), video: idVideo(x.tiktok_url) }));
            const lignes = [], releves = [], liens = [];
            for (const p of comptes) {
                let entrees = [];
                try {
                    const { stdout } = await executer(yt, ["--flat-playlist", "-J", "--no-warnings", "--playlist-end", String(a.posts ?? 60),
                        `https://www.tiktok.com/@${p}`], { nom: "yt-dlp", delaiMs: 3 * 60_000 });
                    entrees = JSON.parse(stdout).entries || [];
                }
                catch (e) {
                    lignes.push(`@${p} : non relevé (${e.message.split("\n")[0]}).`);
                    continue;
                }
                const parId = new Map(entrees.map(e => [String(e.id), e]));
                const pris = new Set();
                let n = 0;
                for (const x of creneaux.filter(x => x.compte === p)) {
                    let e = x.video ? parId.get(x.video) : undefined;
                    if (!e && !x.video) {
                        const t = Date.parse(x.publie_le || x.statut_le || "");
                        const proches = isNaN(t) ? [] : entrees.filter(v => v.timestamp && !pris.has(String(v.id))
                            && Math.abs(v.timestamp * 1000 - t) <= FENETRE_H * 3600_000);
                        if (proches.length === 1) {
                            e = proches[0];
                            liens.push({ id: x.id, tiktok_url: `https://www.tiktok.com/@${p}/video/${e.id}` });
                        }
                    }
                    if (!e || e.view_count == null)
                        continue;
                    pris.add(String(e.id));
                    n++;
                    releves.push({ creneau_id: x.id, vues: e.view_count, likes: e.like_count ?? null, commentaires: e.comment_count ?? null,
                        partages: e.repost_count ?? null, source: "releve" });
                }
                lignes.push(`@${p} : ${entrees.length} posts lus, ${n} créneau(x) publié(s) relevé(s).`);
            }
            if (liens.length) {
                const { error } = await c.rpc("plan_maj_creneaux", { p: liens });
                if (error)
                    lignes.push(`Liens non posés : ${error.message}`);
            }
            if (releves.length) {
                const { error } = await c.from("resultats").insert(releves);
                if (error)
                    throw new Error("Relevés non enregistrés : " + error.message);
            }
            lignes.push("", releves.length ? `${releves.length} relevé(s) enregistré(s)${liens.length ? `, ${liens.length} lien(s) TikTok posé(s) d'après la date` : ""}. \`bilan\` donne les verdicts.`
                : "Aucun créneau publié à relever : un créneau se mesure une fois passé à « publié » (`maj_creneaux`, avec son `lien`).");
            const actif = (await ctx.produits().catch(() => null))?.actif;
            return texte((actif ? `Produit : ${actif.nom}.\n` : "") + lignes.join("\n"));
        }
        catch (e) {
            return erreur(ctx.expliquer(e.message));
        }
    });
};
