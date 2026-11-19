// relever_mes_posts (19/11/2026, stratégie v2 étape 4 ; arbitré par le propriétaire le 18/11/2026 : « l'agent de
// l'utilisateur peut remplir la boucle et faire les relevés lui-même sur le TikTok du user, avec yt-dlp »).
// Sur la machine de l'utilisateur : un appel `yt-dlp --flat-playlist -J` par compte (son catalogue public, comme
// src/catalogues.py chez viraldar), SEULEMENT pour les comptes qu'il a déclarés dans viraldar pour le produit actif
// (ses comptes de plan, son @ d'accueil, ses comptes TikTok reliés À CE PRODUIT) — jamais un autre @ : ce n'est pas un
// outil pour relever des concurrents (arbitré le 18/11/2026 : un concurrent absent de la base, c'est viraldar qui le relève).
// Les posts sont rapprochés des créneaux publiés par leur URL (ou, sans URL, par le compte et la date de publication,
// s'il n'y a qu'un candidat ; l'URL est alors posée).
// L'historique (19/11/2026, retour d'une vraie session : 184 posts lus, 0 gardé faute de créneau) : TOUS les posts lus vont dans `mes_posts`
// (RPC mes_posts_relever, qui revérifie que chaque compte est déclaré pour le produit), avec leur relevé dans
// `resultats`. Ceux sans créneau forment son historique : ils donnent la médiane du compte dès le premier relevé, et leur
// angle se propose avec `mes_posts` / `classer_mes_posts`. La légende de SES posts est gardée (500 caractères, pour
// proposer l'angle) ; ce relevé ne rend que des identifiants et des compteurs, et le support (19/11/2026).
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contexte, Module } from "../contexte.ts";
import { erreur, texte } from "../rendu.ts";
import { executer } from "./montage.ts";
import { trouverYtDlp } from "./analyse.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ligne = Record<string, any>;
const PSEUDO = /^[a-z0-9._]{2,24}$/;
const idVideo = (url: string | null) => url?.match(/\/(?:video|photo)\/(\d{8,25})/)?.[1] ?? null;
const FENETRE_H = 36;   // sans URL, un post rapproché d'un créneau publié à ± 36 h de sa date de publication
const LOT = 300;        // posts par appel de mes_posts_relever (la RPC en refuse davantage)
// Le support (19/11/2026, arbitré : il se relève chez l'utilisateur, jamais chez viraldar) : le catalogue ne distingue
// pas un diaporama d'une vidéo ; `yt-dlp -j` post par post, oui (un diaporama n'a que de l'audio, vcodec « none » ; une
// vidéo a un flux h264/h265). ~1,1 s par post, une seule fois par post (ceux qui ont déjà leur support sont sautés).
const SUPPORTS_DEFAUT = 40;

/** diaporama | video d'après `yt-dlp -j`, ou null si la lecture échoue. */
export function supportDe(j: Ligne): "diaporama" | "video" | null {
  const fs: Ligne[] = Array.isArray(j?.formats) ? j.formats : [];
  if (!fs.length && !j?.vcodec) return null;
  const video = fs.some(f => f.vcodec && f.vcodec !== "none") || (!!j.vcodec && j.vcodec !== "none");
  return video ? "video" : "diaporama";
}

export const outilsReleve: Module = (serveur, ctx: Contexte) => {
  async function sb(): Promise<SupabaseClient> {
    const c = await ctx.supabase();
    if (!c) throw new Error(ctx.pasConnecte());
    return c;
  }

  /** Les comptes de l'utilisateur pour le produit actif, et eux seuls. `plan_comptes` et `accueil` sont filtrés par
   *  produit dans la base (RLS) ; `comptes_tiktok` NON (la page les lit tous pour les ranger par produit) : sans le
   *  filtre `produit_id`, le relevé d'un produit lisait aussi les comptes reliés aux autres (bug vu le 19/11/2026). */
  async function sesComptes(c: SupabaseClient, produit: string | null): Promise<Set<string>> {
    const ct = c.from("comptes_tiktok").select("username");
    const [pc, ac, cr] = await Promise.all([
      c.from("plan_comptes").select("pseudo, reseau"),
      c.from("accueil").select("compte").maybeSingle(),
      produit ? ct.eq("produit_id", produit) : ct,
    ]);
    const s = new Set<string>();
    (pc.data || []).filter((x: Ligne) => (x.reseau || "tiktok") === "tiktok").forEach((x: Ligne) => s.add(String(x.pseudo).toLowerCase()));
    if (ac.data?.compte) s.add(String(ac.data.compte).replace(/^@/, "").toLowerCase());
    (cr.data || []).forEach((x: Ligne) => x.username && s.add(String(x.username).toLowerCase()));
    return new Set([...s].filter(p => PSEUDO.test(p)));
  }

  serveur.registerTool("relever_mes_posts", {
    title: "Relever mes posts publiés (et mon historique)",
    description: "Lit sur TikTok (yt-dlp, sur cette machine) les vues, likes, commentaires, partages et enregistrements des posts "
      + "publiés par l'utilisateur, SEULEMENT sur ses propres comptes déclarés dans viraldar pour le produit (comptes de son "
      + "planning, son @ d'accueil, comptes reliés à ce produit) ; jamais un autre compte. Rapproche chaque post d'un créneau "
      + "« publié » du planning (par son lien, sinon par le compte et la date) et enregistre TOUS les posts lus : ceux sans "
      + "créneau forment son historique (posts d'avant viraldar ou hors planning), qui donne la médiane de chaque compte dès "
      + "le premier relevé. Ensuite, propose l'angle de ces posts (`mes_posts`, puis `classer_mes_posts` une fois validé par "
      + "l'utilisateur). C'est la boucle de mesure (`bilan`). La première fois, relève tout le catalogue (`posts: 200`) ; puis à "
      + "8 h, 48 h et 7 jours après une publication (`bilan` dit les relevés dus). yt-dlp doit être installé (`ma_machine`) ; "
      + "sinon, les chiffres de l'utilisateur et `noter_resultats`.",
    inputSchema: {
      compte: z.string().max(31).optional().describe("Un seul de ses comptes (@pseudo) ; absent = tous ses comptes déclarés."),
      posts: z.number().int().min(5).max(200).optional().describe("Les N posts les plus récents de chaque compte (60 par défaut ; 200 pour tout l'historique)."),
      produit: z.string().max(80).optional().describe("Le produit (nom ou id) dont relever les comptes ; absent = le produit actif de ce "
        + "module. Le connecteur viraldar garde son propre produit actif : donne-le ici s'il diffère."),
      supports: z.number().int().min(0).max(200).optional().describe(`Relever aussi le support (diaporama ou vidéo) de N posts qui ne l'ont pas encore, les plus vus d'abord (~1 s par post, une seule fois par post ; ${SUPPORTS_DEFAUT} par défaut, 0 pour s'en passer).`),
    },
  }, async (a: { compte?: string; posts?: number; produit?: string; supports?: number }) => {
    try {
      const c = await sb();
      // Le module création (0.6.0) n'a plus mes_produits / choisir_produit par défaut : le produit se donne ici.
      const P = await ctx.produits();
      if (a.produit && P) {
        const v = a.produit.trim().toLowerCase();
        const t = P.liste.find((x) => x.id === a.produit!.trim() || x.nom.trim().toLowerCase() === v);
        if (!t) return erreur(`Produit introuvable : ${a.produit} (produits : ${P.liste.map((x) => x.nom).join(", ")}).`);
        if (t.id !== P.actif.id) ctx.choisirProduit(t.id);
      }
      const actif = (await ctx.produits())?.actif ?? null;
      const yt = trouverYtDlp();
      if (!yt) return erreur("yt-dlp n'est pas installé sur cette machine : `ma_machine` donne la commande à taper. En attendant, "
        + "demande ses chiffres à l'utilisateur et enregistre-les avec `noter_resultats`.");
      const siens = await sesComptes(c, actif?.id ?? null);
      const voulu = a.compte?.replace(/^@/, "").trim().toLowerCase();
      if (voulu && !siens.has(voulu)) return erreur(`@${voulu} n'est pas un compte déclaré de l'utilisateur pour ce produit `
        + `(${[...siens].map(x => "@" + x).join(", ") || "aucun"}). Ce relevé ne lit que ses propres comptes ; un compte à lui `
        + "s'ajoute dans son planning (Planning → Modifier le plan) ou dans l'accueil.");
      const comptes = voulu ? [voulu] : [...siens];
      if (!comptes.length) return erreur("Aucun compte TikTok déclaré pour ce produit (planning, accueil ou compte relié).");
      // les créneaux publiés (ou avec un lien) de ces comptes
      const { data: cps } = await c.from("plan_comptes").select("id, pseudo");
      const pseudoDe = new Map((cps || []).map((k: Ligne) => [k.id, String(k.pseudo).toLowerCase()]));
      const { data: crs, error: ec } = await c.from("plan_creneaux").select("id, compte_id, statut, tiktok_url, publie_le, statut_le")
        .or("statut.eq.publie,tiktok_url.not.is.null");
      if (ec) throw new Error(ec.message);
      const creneaux: Ligne[] = (crs || []).map((x: Ligne) => ({ ...x, compte: pseudoDe.get(x.compte_id), video: idVideo(x.tiktok_url) }));
      // les créneaux « prêts » dont l'heure est passée : peut-être publiés sans avoir été marqués
      const { data: prets } = await c.from("plan_creneaux").select("compte_id, prevu_a").eq("statut", "pret")
        .lt("prevu_a", new Date().toISOString());
      const lignes: string[] = [], liens: Ligne[] = [], lus: Ligne[] = [], aMarquer: string[] = [];
      let surCreneau = 0;
      for (const p of comptes) {
        let entrees: Ligne[] = [];
        try {
          const { stdout } = await executer(yt, ["--flat-playlist", "-J", "--no-warnings", "--playlist-end", String(a.posts ?? 60),
            `https://www.tiktok.com/@${p}`], { nom: "yt-dlp", delaiMs: 3 * 60_000 });
          entrees = JSON.parse(stdout).entries || [];
        } catch (e) {
          const m = (e as Error).message;
          lignes.push(/does not have any videos/i.test(m) ? `@${p} : aucun post public sur ce compte.`
            : `@${p} : non relevé (${m.split("\n")[0]}).`);
          continue;
        }
        const parId = new Map(entrees.map(e => [String(e.id), e]));
        const creneauDe = new Map<string, string>();   // id de la vidéo → créneau
        for (const x of creneaux.filter(x => x.compte === p)) {
          let e = x.video ? parId.get(x.video) : undefined;
          if (!e && !x.video) {
            const t = Date.parse(x.publie_le || x.statut_le || "");
            const proches = isNaN(t) ? [] : entrees.filter(v => v.timestamp && !creneauDe.has(String(v.id))
              && Math.abs(v.timestamp * 1000 - t) <= FENETRE_H * 3600_000);
            if (proches.length === 1) { e = proches[0]; liens.push({ id: x.id, tiktok_url: `https://www.tiktok.com/@${p}/video/${e!.id}` }); }
          }
          if (e) creneauDe.set(String(e.id), x.id);
        }
        for (const e of entrees) {
          const id = String(e.id);
          if (!/^\d{8,25}$/.test(id) || !e.timestamp) continue;
          lus.push({ compte: p, video_id: id, url: `https://www.tiktok.com/@${p}/video/${id}`,
            publie_le: new Date(e.timestamp * 1000).toISOString(), duree: e.duration ?? null,
            legende: typeof e.description === "string" ? e.description.slice(0, 500) : null,
            vues: e.view_count ?? null, likes: e.like_count ?? null, commentaires: e.comment_count ?? null,
            partages: e.repost_count ?? null, enregistrements: e.save_count ?? null, creneau: creneauDe.get(id) ?? null });
          if (!creneauDe.has(id) && (prets || []).some((k: Ligne) => pseudoDe.get(k.compte_id) === p
            && Math.abs(Date.parse(k.prevu_a) - e.timestamp * 1000) <= FENETRE_H * 3600_000)) aMarquer.push(`https://www.tiktok.com/@${p}/video/${id}`);
        }
        surCreneau += creneauDe.size;
        lignes.push(`@${p} : ${entrees.length} posts lus, dont ${creneauDe.size} sur un créneau publié.`);
      }
      if (liens.length) {
        const { error } = await c.rpc("plan_maj_creneaux", { p: liens });
        if (error) lignes.push(`Liens non posés : ${error.message}`);
      }
      // Le support des posts qui ne l'ont pas encore (les plus vus d'abord : ce sont eux qu'on lit en premier).
      const nSup = a.supports ?? SUPPORTS_DEFAUT;
      let supLus = 0, supRestants = 0;
      if (nSup > 0 && lus.length) {
        const { data: deja } = await c.from("mes_posts").select("video_id, support").not("support", "is", null).limit(5000);
        const connus = new Set((deja || []).map((x: Ligne) => String(x.video_id)));
        const manquants = lus.filter(x => !connus.has(x.video_id)).sort((x, y) => (y.vues ?? 0) - (x.vues ?? 0));
        supRestants = Math.max(0, manquants.length - nSup);
        for (const x of manquants.slice(0, nSup)) {
          try {
            const { stdout } = await executer(yt, ["-j", "--no-warnings", "--skip-download", x.url], { nom: "yt-dlp", delaiMs: 60_000 });
            const sp = supportDe(JSON.parse(stdout));
            if (sp) { x.support = sp; supLus++; }
          } catch { /* privé, supprimé, limité : le support reste inconnu, il sera retenté au prochain relevé */ }
        }
      }
      // Tous les posts lus, par lots : créneaux et historique (la RPC ne garde que les comptes déclarés du produit).
      const total = { nouveaux: 0, releves: 0 };
      for (let i = 0; i < lus.length; i += LOT) {
        const { data, error } = await c.rpc("mes_posts_relever", { p_posts: lus.slice(i, i + LOT) });
        if (error) throw new Error("Relevés non enregistrés : " + error.message);
        total.nouveaux += data?.nouveaux || 0; total.releves += data?.releves || 0;
        if (data?.refuses?.length) lignes.push(`Comptes refusés par viraldar (non déclarés pour ce produit) : ${data.refuses.map((x: string) => "@" + x).join(", ")}.`);
      }
      if (lus.length) lignes.push("", `${lus.length} post(s) lu(s) : ${total.releves} relevé(s) enregistré(s) (${surCreneau} sur un créneau publié`
        + `${liens.length ? `, ${liens.length} lien(s) TikTok posé(s) d'après la date` : ""}) ; ${total.nouveaux} post(s) nouveau(x) dans son historique. `
        + "Relire un post met à jour ses chiffres, sans le dédoubler."
        + (supLus || supRestants ? ` Support (diaporama / vidéo) relevé pour ${supLus} post(s)${supRestants ? `, ${supRestants} encore sans support (relance avec \`supports\`)` : ""}.` : ""));
      if (aMarquer.length) lignes.push(`${aMarquer.length} post(s) publié(s) près de l'heure d'un créneau encore « prêt » : si ce sont ces créneaux, `
        + `demande-le à l'utilisateur puis passe-les à « publié » avec leur lien (\`maj_creneaux\`) : ${aMarquer.slice(0, 6).join(", ")}${aMarquer.length > 6 ? "…" : ""}.`);
      if (lus.length) lignes.push("Ensuite : `bilan` (verdicts, historique, médiane de chaque compte, engagement), puis `mes_posts` "
        + "(filtre a_lire) pour LIRE ses posts ici, sur sa machine — couverture ou planche (`modele_decortiquer`), légende, chiffres — "
        + "et proposer série, déclencheur, sujet soudé, variables et angle (`lire_mes_posts`, validés par l'utilisateur).");
      return texte((actif ? `Produit : ${actif.nom}.\n` : "") + lignes.join("\n"));
    } catch (e) { return erreur(ctx.expliquer((e as Error).message)); }
  });
};
