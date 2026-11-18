// Chercher dans la base viraldar, avec la session de l'utilisateur : les mêmes appels que la page (site/js/*.js),
// donc les mêmes quotas (posts_page : 600 posts distincts par jour, 30 appels par minute). Jamais de recherche TikTok :
// ce qui n'est pas dans la base n'existe pas pour l'agent (une recherche vide est notée dans `recherches`, comme sur
// le site, et dit au propriétaire quoi aller relever).
// Réponses en texte compact, pensées pour un agent : l'URL TikTok de chaque post et les chiffres qui comptent ; toute
// médiane avec son n. Rien n'est écrit en local : les posts vus pendant la session restent en mémoire (pour `post`).
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Contexte, Module } from "./contexte.ts";
import { DONNEES, PRODUIT_ACTIF, erreur, externe, nb, pct, sig, texte, urlPost, type Post } from "./rendu.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Infos = { exporte_le: string; regles: any; etiquettes: Record<string, any>; langues: Record<string, number>; suggestions: Record<string, string[]> };

// ---------- utilitaires (les mêmes règles que site/js/commun.js) ----------
// `plier` : comme dans la page et src/exporter.py, qui plie le texte des posts ; les deux doivent coïncider.
const plier = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’'\-‐–—_]/g, " ");
const GENERIQUES = /^(fyp|foryou|for you|xyz|viral|goviral|trending|tiktok|pourtoi|parati|explore|repost)/;

/** Un id de post, ou une URL TikTok (…/@compte/video/123…). */
function lireRef(ref: string): { id: string; compte?: string } {
  const m = ref.match(/@([^/?#]+)\/(?:video|photo)\/(\d+)/);
  if (m) return { id: m[2], compte: decodeURIComponent(m[1]) };
  const d = ref.match(/(\d{8,})/);
  return { id: d ? d[1] : ref.trim() };
}

export const outilsBase: Module = (serveur, ctx: Contexte) => {
  // ---------- état de la session MCP (mémoire seulement) ----------
  const parId = new Map<string, Post>();
  let infos: { v: Infos; le: number } | null = null;
  let favoris: Map<string, { statut: string; reprendre: string | null }> | null = null;
  // Les posts triés dépendent du produit actif (multi-produits, 15/11/2026) : le cache et les listes repartent de zéro
  // quand il change (choisir_produit ici, ou un autre MCP qui a gardé un autre choix dans session.json).
  let favorisProduit: string | null = null;
  let quota: { servis: number; max: number } | null = null;
  // Les listes de recommandés chargées : les posts triés depuis en sortent côté serveur, la page suivante commence
  // d'autant plus tôt (p_filtres.retires, comme Découvrir).
  const listes = new Map<string, { ids: Set<string>; retires: number }>();

  async function sb(): Promise<SupabaseClient> {
    const c = await ctx.supabase();
    if (!c) throw new Error(ctx.pasConnecte());
    return c;
  }
  async function lireInfos(c: SupabaseClient): Promise<Infos> {
    if (infos && Date.now() - infos.le < 3600_000) return infos.v;
    const { data, error } = await c.rpc("posts_infos");
    if (error) throw new Error("posts_infos : " + error.message);
    if (!data) throw new Error("La base n'est pas encore en ligne : réessaie plus tard.");
    infos = { v: data, le: Date.now() };
    return data;
  }
  async function lireFavoris(c: SupabaseClient) {
    if (favoris && favorisProduit === ctx.produitId()) return favoris;
    if (favoris) listes.clear();
    favorisProduit = ctx.produitId();
    const { data, error } = await c.from("favoris").select("post_id, statut, reprendre");
    if (error) throw new Error("favoris : " + error.message);
    favoris = new Map((data || []).map((f: any) => [f.post_id, { statut: f.statut === "vu" ? "ecarte" : f.statut, reprendre: f.reprendre }]));
    return favoris;
  }
  async function page(c: SupabaseClient, args: Record<string, unknown>) {
    const { data, error } = await c.rpc("posts_page", args);
    if (error) throw new Error("posts_page : " + error.message);
    (data.posts as Post[]).forEach(p => parId.set(p.id, p));
    if (data.quota_jour != null && data.servis_aujourdhui != null) quota = { servis: data.servis_aujourdhui, max: data.quota_jour };
    return data as { posts: Post[]; total: number | null; comptes: number | null; page: number; suite: boolean;
      servis_aujourdhui?: number; quota_jour?: number; refus: string | null; message: string | null };
  }
  /** Lance l'outil, transforme les erreurs en message lisible. */
  const outil = <A,>(fn: (a: A, c: SupabaseClient) => Promise<ReturnType<typeof texte>>) => async (a: A) => {
    try { return await fn(a, await sb()); } catch (e) { return erreur(ctx.expliquer((e as Error).message)); }
  };

  // ---------- l'affichage d'un post ----------
  function lignePost(p: Post, I: Infos, detail = false): string {
    const st = favoris?.get(p.id);
    const tete = `• ${urlPost(p)}  @${p.compte}${p.abonnes != null ? ` (${nb(p.abonnes)} abonnés)` : ""}`
      + (st ? (st.statut === "a_reproduire" ? "  ★ gardé" : "  ✕ passé") : "");
    const likes = I.regles?.likes;
    const chiffres = [
      `${nb(p.vues)} vues`,
      p.outlier != null ? `×${sig(p.outlier)} sa médiane (médiane du compte ${nb(Math.round(p.mediane_compte))}, n = ${p.n_compte})` : null,
      p.ratio_abonnes != null ? `×${sig(p.ratio_abonnes)} ses abonnés` : null,
      p.taux_likes != null ? `likes ${pct(p.taux_likes)}${likes != null && p.taux_likes < likes ? " (pub ?)" : ""}` : null,
      p.demande_app ? `📲 ${p.demandes_app}/${p.commentaires_lus} commentaires demandent l'app` : null,
      p.type === "carrousel" ? `carrousel${p.slides ? ` ${p.slides} images` : ""}` : `vidéo${p.duree ? ` ${Math.round(p.duree)} s` : ""}`,
      p.publie ? `publié ${p.publie}${p.age_j != null ? ` (${p.age_j} j au relevé)` : ""}` : null,
      p.langue,
      p.etiquettes?.length ? `thèmes : ${p.etiquettes.join(", ")}` : null,
    ].filter(Boolean).join(" · ");
    const desc = externe(p.description);
    const lignes = [tete, "  " + chiffres, desc ? `  texte : ⟦${detail || desc.length <= 160 ? desc : desc.slice(0, 157) + "…"}⟧` : ""];
    if (detail) {
      lignes.push(`  id ${p.id} · ${nb(p.likes)} likes · ${nb(p.commentaires)} commentaires · ${nb(p.partages)} partages · `
        + `${nb(p.enregistrements)} enregistrements · relevé le ${p.releve}`);
      if (p.son) lignes.push(`  son : ⟦${externe(p.son)}⟧`);
      if (p.mots?.length) lignes.push(`  trouvé par les mots-clés : ${p.mots.join(", ")}`);
      if (p.demandes_app_exemples?.length) lignes.push(`  commentaires qui demandent l'app : ${p.demandes_app_exemples.map((x: string) => `⟦${externe(x)}⟧`).join(" ; ")}`);
      if (st?.reprendre) lignes.push(`  ta note : ${st.reprendre}`);
    }
    return lignes.filter(Boolean).join("\n");
  }
  function rendreListe(r: Awaited<ReturnType<typeof page>>, I: Infos, titre: string, detail = false) {
    const ent = [titre + (r.total != null ? ` — ${r.total} posts${r.comptes != null ? ` de ${r.comptes} comptes` : ""}` : "")
      + ` · page ${r.page}, ${r.posts.length} montrés` + (r.suite ? ` · suite : page ${r.page + 1}` : " · fin de la liste")];
    if (quota) ent.push(`quota du jour : ${quota.servis}/${quota.max} posts distincts vus`);
    if (r.refus) ent.push(`⚠ ${r.message}`);
    if (r.posts.length) ent.push(DONNEES);
    return [ent.join("\n"), ...r.posts.map(p => lignePost(p, I, detail))].join("\n\n");
  }

  // ---------- les filtres communs à la recherche et aux recommandés ----------
  const LANGUES = ["fr", "en", "es", "de", "pt", "autre", "inconnue"] as const;
  const filtres = {
    mots: z.string().max(200).optional().describe("Tous ces mots, chacun comme un début de mot (« app » trouve appli, pas happy), dans le texte, le compte ou les mots-clés (accents ignorés)."),
    mots_cles: z.array(z.string()).max(60).optional().describe("Des mots-clés du vocabulaire viraldar (nos mots-clés de "
      + "recherche et les hashtags répandus : `suggerer_mots_cles`), l'un OU l'autre. Plus précis que les thèmes, et rapide."),
    mes_mots_cles: z.boolean().optional().describe("Ajoute les mots-clés du produit actif (`mes_mots_cles`)."),
    themes: z.array(z.string()).optional().describe("Clés de thèmes (infos_base), l'un OU l'autre. Larges : préfère `mots_cles`."),
    mes_themes: z.boolean().optional().describe("Ajoute les thèmes de l'utilisateur."),
    langues: z.array(z.enum(LANGUES)).optional(),
    vues_min: z.number().int().optional(),
    outlier_min: z.number().optional().describe("vues ÷ médiane du compte, minimum (ex. 5)."),
    publie_depuis_jours: z.number().int().optional(),
    abonnes_max: z.number().int().optional(),
    format: z.enum(["video", "carrousel"]).optional(),
    demande_app: z.boolean().optional().describe("📲 : des commentaires demandent le nom de l'app."),
    likes_ok: z.boolean().optional().describe("Likes ≥ 2 % des vues (sinon souvent de la pub)."),
    page: z.number().int().min(0).optional().describe("0 = première (24 posts) ; chaque post neuf compte dans le quota."),
    detail: z.boolean().optional().describe("Toutes les stats, texte entier."),
  };
  type Filtres = { mots?: string; mots_cles?: string[]; mes_mots_cles?: boolean; themes?: string[]; mes_themes?: boolean; langues?: string[]; vues_min?: number;
    outlier_min?: number; publie_depuis_jours?: number; abonnes_max?: number; format?: "video" | "carrousel";
    demande_app?: boolean; likes_ok?: boolean; page?: number; detail?: boolean };

  async function args(c: SupabaseClient, I: Infos, f: Filtres, mode: "recherche" | "recommandes") {
    let et = [...(f.themes || [])];
    if (f.mes_themes) {
      const { data, error } = await c.from("ma_selection").select("etiquettes").maybeSingle();
      if (error) throw new Error("ma_selection : " + error.message);
      if (!data?.etiquettes?.length) throw new Error("Mes thèmes est vide : choisis des thèmes avec `modifier_mes_themes`, ou passe `themes`.");
      et.push(...data.etiquettes);
    }
    const inconnues = et.filter(k => !I.etiquettes[k]);
    if (inconnues.length) throw new Error(`Thèmes inconnus : ${inconnues.join(", ")}. Les clés valables sont dans \`infos_base\`.`);
    et = [...new Set(et)].sort();
    return {
      p_mode: mode, p_etiquettes: et, p_langues: f.langues || [],
      p_termes: [...new Set((f.mots_cles || []).map(m => m.trim()).filter(Boolean))], p_mes_mots: !!f.mes_mots_cles,
      p_mots: plier(f.mots || "").split(/\s+/).filter(m => m.length > 1),
      p_filtres: { vues: f.vues_min || 0, outlier: f.outlier_min || null, age: f.publie_depuis_jours || null,
        abonnes: f.abonnes_max || null, type: f.format === "carrousel" ? "carrousel" : f.format === "video" ? "vidéo" : null,
        app: !!f.demande_app, likes: !!f.likes_ok } as Record<string, unknown>,
    };
  }

  // ---------- les produits (multi-produits, 15/11/2026) ----------
  // Un compte a un ou plusieurs produits ; la fiche, la stratégie, les thèmes, les posts gardés, les idées, le planning et
  // les comptes TikTok de brouillon sont ceux du produit actif. La base (les posts viraux) est la même pour tous.
  serveur.registerTool("mes_produits", {
    title: "Mes produits",
    description: "Les produits du compte viraldar (une app, un SaaS… : chacun a sa fiche, sa stratégie, ses thèmes, ses "
      + "posts gardés, ses idées, son planning et ses comptes TikTok) et celui sur lequel l'agent travaille (le produit "
      + "actif). À vérifier avant de produire quoi que ce soit pour un produit ; `choisir_produit` pour changer. Hors quota.",
    inputSchema: {},
  }, outil<Record<string, never>>(async () => {
    const P = await ctx.produits();
    if (!P) throw new Error(ctx.pasConnecte());
    return texte([`${P.liste.length} produit${P.liste.length > 1 ? "s" : ""} :`,
      ...P.liste.map(p => `• ${p.nom}${p.id === P.actif.id ? "  ← actif" : ""}  (id ${p.id}, créé le ${String(p.cree_le).slice(0, 10)})`),
      P.liste.length > 1 ? "Changer : `choisir_produit`." : "Un seul produit : rien à choisir (on en ajoute sur viraldar.rayvol.net)."].join("\n"));
  }));
  serveur.registerTool("choisir_produit", {
    title: "Choisir le produit actif",
    description: "Fait d'un produit (par son nom ou son id, voir `mes_produits`) le produit actif : les outils qui suivent "
      + "lisent et écrivent sa fiche, sa stratégie, ses thèmes, ses posts gardés, ses idées et son planning. Le choix est "
      + "gardé pour les prochaines sessions de l'agent. Ne change de produit que si l'utilisateur le demande ou si sa "
      + "demande porte clairement sur un autre produit (dis-le-lui).",
    inputSchema: { produit: z.string().min(1).describe("Nom (sans tenir compte des majuscules) ou id du produit.") },
  }, outil<{ produit: string }>(async ({ produit }) => {
    const P = await ctx.produits();
    if (!P) throw new Error(ctx.pasConnecte());
    const v = produit.trim().toLowerCase();
    const t = P.liste.find(p => p.id === produit.trim()) ?? P.liste.find(p => p.nom.trim().toLowerCase() === v)
      ?? (() => { const m = P.liste.filter(p => p.nom.toLowerCase().includes(v)); return m.length === 1 ? m[0] : undefined; })();
    if (!t) throw new Error(`Produit inconnu : ${produit}. Produits du compte : ${P.liste.map(p => p.nom).join(", ")}.`);
    ctx.choisirProduit(t.id);
    favoris = null; listes.clear();
    return texte(`Produit actif : ${t.nom}.` + (t.id === P.actif.id ? " (C'était déjà lui.)" : ""));
  }));

  // ---------- infos_base ----------
  serveur.registerTool("infos_base", {
    title: "Ce que contient la base viraldar",
    description: "Les thèmes (clés d'étiquettes à passer aux autres outils, avec leur nom et leur nombre de posts), les "
      + "langues, les règles chiffrées (recommandés, critères) et la date du dernier export. Ne coûte rien sur le quota. "
      + "À appeler avant de filtrer par thème. Avec `theme`, donne aussi les mots les plus fréquents de ce thème (idées de mots à chercher).",
    inputSchema: { theme: z.string().optional().describe("Clé d'un thème ('' = toute la base) pour ses mots fréquents.") },
  }, outil<{ theme?: string }>(async ({ theme }, c) => {
    const I = await lireInfos(c);
    const ets = Object.entries(I.etiquettes).sort((a, b) => (b[1].n || 0) - (a[1].n || 0));
    const r = I.regles || {};
    const lignes = [
      `Base exportée le ${I.exporte_le} · ${Object.values(I.langues || {}).reduce((s, n) => s + n, 0)} posts (≥ ${nb(r.vues)} vues, au moins un thème).`,
      `Règles : recommandés = ${JSON.stringify(r.recommandes)} ; critères : ≥ ${nb(r.vues)} vues, publié ≤ ${r.age_j} j, likes ≥ ${r.likes != null ? pct(r.likes) : "?"} des vues.`,
      "Outlier = vues ÷ médiane des posts de plus de 48 h du même compte ; vues ÷ abonnés : abonnés relevés le jour de la recherche (comptés 1 000 au moins).",
      "Quota : 600 posts distincts par jour et 30 appels par minute (posts_page) ; un post revu le même jour ne recompte pas.",
      "",
      `Langues : ${Object.entries(I.langues || {}).map(([k, n]) => `${k} ${n}`).join(", ")}`,
      "",
      `Thèmes (${ets.length}) — clé : nom (posts) :`,
      ...ets.map(([k, e]) => `${k} : ${e.nom} (${e.n ?? "?"})`),
    ];
    if (theme != null) {
      if (theme && !I.etiquettes[theme]) throw new Error(`Thème inconnu : ${theme}.`);
      lignes.push("", `Mots fréquents ${theme ? `de « ${I.etiquettes[theme].nom} »` : "de toute la base"} : ${(I.suggestions?.[theme] || []).join(", ") || "—"}`);
    }
    return texte(lignes.join("\n"));
  }));

  // ---------- chercher_posts ----------
  serveur.registerTool("chercher_posts", {
    title: "Chercher dans la base viraldar",
    description: "Cherche parmi les posts TikTok viraux (≥ 100 k vues) déjà relevés par viraldar — jamais sur TikTok "
      + "lui-même : si rien ne sort, la base n'a pas encore ce sujet (la recherche vide est notée pour le prochain relevé). "
      + "Filtres : mots-clés (`mots_cles`, `mes_mots_cles` : précis et rapides), mots, thèmes, langue, vues, outlier, date, taille du compte, format, 📲. Tri au choix. 24 posts par page, "
      + "chacun avec son URL TikTok, ses vues, son outlier (avec la médiane du compte et son n), vues ÷ abonnés, 📲, "
      + "thèmes, langue, date. Compte dans le quota du jour (600 posts distincts). Pour des idées à reproduire sur de "
      + "petits comptes, préfère `petits_comptes_viraux`.",
    inputSchema: {
      ...filtres,
      tri: z.enum(["score", "vues", "outlier", "ratio_abonnes", "publie", "enregistrements", "partages", "commentaires"]).optional()
        .describe("score = les plus prometteurs (défaut) ; outlier = le plus au-dessus de sa médiane ; ratio_abonnes = vues ÷ abonnés ; publie = les plus récents."),
    },
  }, outil<Filtres & { tri?: string }>(async (f, c) => {
    const I = await lireInfos(c); await lireFavoris(c);
    const a = { ...(await args(c, I, f, "recherche")), p_tri: f.tri || "score", p_page: f.page || 0 };
    const r = await page(c, a);
    // Comme la page : les recherches tapées, avec leur nombre de résultats.
    if (f.mots?.trim() && !f.page && r.total != null)
      await c.from("recherches").insert({ q: f.mots.trim().slice(0, 200), n_resultats: r.total }).then(() => {}, () => {});
    return texte(rendreListe(r, I, "Recherche", f.detail) + (r.total === 0
      ? "\n\nRien dans la base pour cette recherche (notée pour le prochain relevé). Essaie d'autres mots, un thème voisin, ou moins de filtres." : ""));
  }));

  // ---------- petits_comptes_viraux ----------
  serveur.registerTool("petits_comptes_viraux", {
    title: "Petits comptes viraux (recommandés)",
    description: "Les recommandés de viraldar : des posts de comptes ≤ 50 k abonnés qui ont fait ≥ 300 k vues et ≥ 20 × "
      + "leurs abonnés, classés par vues ÷ abonnés, 2 au plus par compte, les 100 premiers — les formats qui marchent "
      + "sans audience, donc les plus reproductibles. Mêmes filtres que `chercher_posts` (mots-clés, `mes_mots_cles`, thèmes, langue, "
      + "mots…). Les posts déjà gardés ou passés par l'utilisateur n'y sont plus. Compte dans le quota du jour.",
    inputSchema: filtres,
  }, outil<Filtres>(async (f, c) => {
    const I = await lireInfos(c); await lireFavoris(c);
    const a = await args(c, I, f, "recommandes");
    const cle = JSON.stringify(a);
    if (!f.page) listes.set(cle, { ids: new Set(), retires: 0 });
    const l = listes.get(cle) || { ids: new Set<string>(), retires: 0 };
    listes.set(cle, l);
    const r = await page(c, { ...a, p_filtres: { ...a.p_filtres, retires: l.retires }, p_page: f.page || 0 });
    r.posts.forEach(p => l.ids.add(p.id));
    return texte(rendreListe(r, I, "Petits comptes viraux", f.detail));
  }));

  // ---------- post ----------
  async function trouver(c: SupabaseClient, ref: string): Promise<Post | null> {
    const { id, compte } = lireRef(ref);
    if (parId.has(id)) return parId.get(id)!;
    // Pas encore vu dans cette session : par son compte (2 pages au plus, dans le quota).
    if (compte) {
      const mots = plier(compte).split(/\s+/).filter(m => m.length > 1);
      for (let p = 0; p < 2 && mots.length; p++) {
        const r = await page(c, { p_mode: "recherche", p_mots: mots, p_tri: "vues", p_page: p });
        if (parId.has(id)) return parId.get(id)!;
        if (!r.suite) break;
      }
    }
    return null;
  }
  serveur.registerTool("post", {
    title: "Détail d'un post",
    description: "Toutes les stats d'un post de la base (likes, partages, enregistrements, son, mots-clés qui l'ont trouvé, "
      + "exemples de commentaires qui demandent l'app, ta note s'il est gardé). Prend un id ou une URL TikTok. Un post déjà "
      + "rendu par un autre outil pendant cette session ne coûte rien ; sinon il faut son URL (avec le @compte) : il est "
      + "cherché parmi les posts de ce compte, dans le quota.",
    inputSchema: { post: z.string().describe("Id du post, ou son URL TikTok.") },
  }, outil<{ post: string }>(async ({ post }, c) => {
    const I = await lireInfos(c); await lireFavoris(c);
    const p = await trouver(c, post);
    if (!p) return erreur("Post introuvable : il n'est pas dans la base, ou n'a pas encore été vu dans cette session — "
      + "donne son URL TikTok complète (avec @compte), ou retrouve-le par `chercher_posts`.");
    return texte(lignePost(p, I, true) + "\n\n" + DONNEES);
  }));

  // ---------- formats_similaires ----------
  serveur.registerTool("formats_similaires", {
    title: "Formats viraux similaires",
    description: "Des posts de la base qui partagent le plus de hashtags avec un post (ou avec une liste de hashtags), "
      + "puis de durée proche (± 50 %), puis le plus haut outlier ; 24 au plus, 2 par compte. Pour décliner un format "
      + "qui marche. Compte dans le quota du jour.",
    inputSchema: {
      post: z.string().optional().describe("Id ou URL d'un post déjà vu : ses hashtags et sa durée servent de modèle."),
      hashtags: z.array(z.string()).optional().describe("Sinon, des hashtags (sans #) ou mots."),
      duree_s: z.number().optional().describe("Durée de référence en secondes (vidéos)."),
      detail: z.boolean().optional(),
    },
  }, outil<{ post?: string; hashtags?: string[]; duree_s?: number; detail?: boolean }>(async ({ post, hashtags, duree_s, detail }, c) => {
    const I = await lireInfos(c); await lireFavoris(c);
    let tags = hashtags || [], duree = duree_s;
    if (post) {
      const p = await trouver(c, post);
      if (!p) throw new Error("Post introuvable dans cette session : passe plutôt ses hashtags.");
      tags = [...tags, ...[...(p.description || "").matchAll(/#([^\s#]+)/g)].map(m => m[1])];
      duree ??= p.duree ?? undefined;
    }
    // Les hashtags passe-partout (#fyp, #viral…) ne disent rien du format : écartés, sinon ils font tout le classement.
    const tp = [...new Set(tags.map(t => plier(t.replace(/^#/, "")).trim())
      .filter(t => t.length >= 3 && !GENERIQUES.test(t)))].slice(0, 12);
    if (!tp.length) throw new Error("Aucun hashtag exploitable (3 lettres au moins) : passe `hashtags`.");
    const r = await page(c, { p_mode: "similaires", p_mots: tp, p_duree: duree || null });
    if (!r.posts.length && !r.refus)
      await c.from("recherches").insert({ q: tp.join(" ").slice(0, 200), n_resultats: 0 }).then(() => {}, () => {});
    return texte(rendreListe(r, I, `Formats similaires à #${tp.join(" #")}${duree ? ` (≈ ${Math.round(duree)} s)` : ""}`, detail));
  }));

  // ---------- Mes mots-clés (18/11/2026 : à la place des thèmes) ----------
  type Terme = { terme: string; n: number; n_recents: number; origine?: string; genre?: string };
  const ligneTerme = (m: Terme) => `${m.terme} — ${m.n} posts dont ${m.n_recents} publiés ≤ 90 jours`
    + (m.origine && m.origine !== "utilisateur" ? ` (proposé : ${m.origine})` : "");
  serveur.registerTool("suggerer_mots_cles", {
    title: "Suggérer des mots-clés",
    description: "Le vocabulaire de la base (nos mots-clés de recherche TikTok et les hashtags répandus) : les termes qui "
      + "commencent par `debut` (accents, espaces et tirets ignorés : « study with me » = #studywithme), les plus fournis "
      + "d'abord, avec leur nombre de posts ; sans `debut`, les plus fournis. Hors quota. Un terme absent n'a pas encore de "
      + "posts : il peut quand même aller dans `modifier_mes_mots_cles` (c'est ce qui dit quoi relever).",
    inputSchema: { debut: z.string().max(80).optional(), n: z.number().int().min(1).max(50).optional() },
  }, outil<{ debut?: string; n?: number }>(async ({ debut, n }, c) => {
    const { data, error } = await c.rpc("mots_suggerer", { p_debut: debut || "", p_n: n || 20 });
    if (error) throw new Error("mots_suggerer : " + error.message);
    const ms = (data || []) as Terme[];
    return texte(ms.length ? ms.map(ligneTerme).join("\n") : `Aucun terme ne commence par « ${debut} » dans la base.`);
  }));
  type Voisin = Terme & { ensemble: number; sur: number; lift: number };
  serveur.registerTool("explorer_mots_cles", {
    title: "Explorer les mots-clés de la base",
    description: "Pour proposer à l'utilisateur les mots-clés les plus cohérents avec son produit et ce qu'il veut produire, "
      + "parmi tout le vocabulaire de la base (nos mots-clés de recherche TikTok et les hashtags répandus, ~7 000 termes). "
      + "Deux recherches, combinables : `contient` (chaque texte donné : les termes qui le contiennent, « focus » → "
      + "focusflight, focusonyourself… ; tire-les de sa fiche, de son produit, de ses concurrents, des formats visés) et "
      + "`voisins_de` / `voisins_de_mes_mots` (les termes qui reviennent le plus sur les mêmes posts — le vocabulaire réel "
      + "de sa niche ; `lift` > 3 : propre à la niche, ≈ 1 : répandu partout ; méfie-toi des homonymes, « pomodoro » "
      + "attire aussi la cuisine italienne). Chaque terme avec ses posts (n) et ceux publiés ≤ 90 jours. Hors quota. "
      + "Méthode : `ma_fiche` → `contient` sur ses mots → `voisins_de` des meilleurs → trie par cohérence avec son produit "
      + "et son public (langue comprise), écarte le hors-sujet, propose une liste courte avec la raison de chacun, puis "
      + "`modifier_mes_mots_cles` seulement avec son accord.",
    inputSchema: {
      contient: z.array(z.string().min(2).max(60)).max(12).optional().describe("Des textes : les termes qui les contiennent."),
      voisins_de: z.array(z.string().max(80)).max(60).optional().describe("Des termes : ceux qui reviennent avec eux sur les mêmes posts."),
      voisins_de_mes_mots: z.boolean().optional().describe("Ajoute à `voisins_de` les mots-clés du produit actif."),
      n: z.number().int().min(5).max(100).optional().describe("Termes par recherche (30 par défaut)."),
    },
  }, outil<{ contient?: string[]; voisins_de?: string[]; voisins_de_mes_mots?: boolean; n?: number }>(
    async ({ contient, voisins_de, voisins_de_mes_mots, n }, c) => {
      const parties: string[] = [];
      for (const x of contient || []) {
        const { data, error } = await c.rpc("mots_chercher", { p_texte: x, p_n: n || 30 });
        if (error) throw new Error("mots_chercher : " + error.message);
        const ms = (data || []) as Terme[];
        parties.push(`Contient « ${x} » :\n` + (ms.map(ligneTerme).join("\n") || "— aucun terme"));
      }
      if ((voisins_de || []).length || voisins_de_mes_mots) {
        const { data, error } = await c.rpc("mots_voisins",
          { p_termes: voisins_de || [], p_mes_mots: !!voisins_de_mes_mots, p_n: n || 30 });
        if (error) throw new Error("mots_voisins : " + error.message);
        const vs = (data || []) as Voisin[];
        const de = [...(voisins_de || []), ...(voisins_de_mes_mots ? ["ses mots-clés"] : [])].join(", ");
        parties.push(vs.length
          ? `Voisins de ${de} (sur les ${vs[0].sur} posts les plus vus de ces termes) :\n`
            + vs.map(v => `${ligneTerme(v)} · avec eux sur ${v.ensemble} posts · lift ${v.lift}`).join("\n")
          : `Voisins de ${de} : aucun (ces termes n'ont pas encore de posts dans la base).`);
      }
      if (!parties.length) throw new Error("Donne `contient`, `voisins_de` ou `voisins_de_mes_mots`.");
      return texte(parties.join("\n\n"));
    }));
  serveur.registerTool("mes_mots_cles", {
    title: "Mes mots-clés",
    description: PRODUIT_ACTIF + "Les mots-clés du produit (« Mes mots-clés » sur le site), chacun avec ses posts dans la base "
      + "(0 = rien encore). Sert de filtre `mes_mots_cles` aux recherches. Hors quota.",
    inputSchema: {},
  }, outil<Record<string, never>>(async (_a, c) => {
    const { data, error } = await c.rpc("mes_mots_cles");
    if (error) throw new Error("mes_mots_cles : " + error.message);
    const ms = (data || []) as Terme[];
    return texte(ms.length ? `Mes mots-clés (${ms.length}) :\n` + ms.map(ligneTerme).join("\n")
      : "Aucun mot-clé pour ce produit : `suggerer_mots_cles` puis `modifier_mes_mots_cles`.");
  }));
  serveur.registerTool("modifier_mes_mots_cles", {
    title: "Modifier Mes mots-clés",
    description: PRODUIT_ACTIF + "Ajoute ou retire des mots-clés du produit, ou les remplace tous (200 au plus). C'est la même "
      + "liste que sur le site : ne la change que si l'utilisateur le demande.",
    inputSchema: {
      ajouter: z.array(z.string().max(80)).max(200).optional(), retirer: z.array(z.string().max(80)).max(200).optional(),
      remplacer: z.array(z.string().max(80)).max(200).optional().describe("La liste complète, à la place de l'actuelle."),
    },
  }, outil<{ ajouter?: string[]; retirer?: string[]; remplacer?: string[] }>(async ({ ajouter, retirer, remplacer }, c) => {
    const { data, error } = await c.rpc("mes_mots_cles_modifier",
      { p_ajouter: ajouter || [], p_retirer: retirer || [], p_remplacer: remplacer ?? null });
    if (error) throw new Error("Pas enregistré : " + error.message);
    const ms = (data || []) as Terme[];
    return texte(`Mes mots-clés (${ms.length}) :\n` + (ms.map(ligneTerme).join("\n") || "—"));
  }));

  // ---------- Mes thèmes ----------
  async function lireSelection(c: SupabaseClient) {
    const { data, error } = await c.from("ma_selection").select("etiquettes, hashtags, suggerees, ecartees").maybeSingle();
    if (error) throw new Error("ma_selection : " + error.message);
    return data || { etiquettes: [], hashtags: [], suggerees: [], ecartees: [] };
  }
  const nomme = (I: Infos, ks: string[]) => ks.map(k => `${k} (${I.etiquettes[k]?.nom || "?"}, ${I.etiquettes[k]?.n ?? "?"} posts)`).join(", ") || "—";
  serveur.registerTool("mes_themes", {
    title: "Mes thèmes",
    description: PRODUIT_ACTIF + "Les thèmes que l'utilisateur a choisis sur viraldar (« Mes thèmes »), ceux que le site lui suggère "
      + "d'après les hashtags de ses vidéos, et ces hashtags. Sert de filtre `mes_themes` aux recherches. Hors quota.",
    inputSchema: {},
  }, outil<Record<string, never>>(async (_a, c) => {
    const I = await lireInfos(c), s = await lireSelection(c);
    const sugg = (s.suggerees || []).filter((k: string) => !s.etiquettes.includes(k) && !(s.ecartees || []).includes(k));
    return texte([`Mes thèmes : ${nomme(I, s.etiquettes || [])}`, `Suggérés : ${nomme(I, sugg)}`,
      `Écartés : ${(s.ecartees || []).join(", ") || "—"}`, `Hashtags de ses vidéos : ${(s.hashtags || []).join(" ") || "—"}`].join("\n"));
  }));
  serveur.registerTool("modifier_mes_themes", {
    title: "Modifier Mes thèmes",
    description: PRODUIT_ACTIF + "Ajoute ou retire des thèmes (clés de `infos_base`) dans « Mes thèmes » de l'utilisateur, ou les "
      + "remplace tous. C'est la même liste que sur le site : ne la change que si l'utilisateur le demande.",
    inputSchema: {
      ajouter: z.array(z.string()).optional(), retirer: z.array(z.string()).optional(),
      remplacer: z.array(z.string()).optional().describe("La liste complète, à la place de l'actuelle."),
    },
  }, outil<{ ajouter?: string[]; retirer?: string[]; remplacer?: string[] }>(async ({ ajouter, retirer, remplacer }, c) => {
    const I = await lireInfos(c), s = await lireSelection(c);
    const inconnues = [...(ajouter || []), ...(remplacer || [])].filter(k => !I.etiquettes[k]);
    if (inconnues.length) throw new Error(`Thèmes inconnus : ${inconnues.join(", ")} (voir \`infos_base\`).`);
    let et: string[] = remplacer ? [...remplacer] : [...(s.etiquettes || [])];
    et = [...new Set([...et, ...(ajouter || [])])].filter(k => !(retirer || []).includes(k));
    // getUser interroge viraldar : une session révoquée y répond « session_id … does not exist » (voir ctx.expliquer).
    const { data: u, error: eu } = await c.auth.getUser();
    if (!u.user) throw new Error(eu?.message || ctx.pasConnecte());
    // Comme enregistrerSelection (site/js/commun.js) : user_id, etiquettes, ecartees ; une ligne par produit (produit_id,
    // posé par la base d'après l'en-tête du produit actif).
    const { error } = await c.from("ma_selection").upsert({ user_id: u.user.id, etiquettes: et, ecartees: s.ecartees || [] }, { onConflict: "produit_id" });
    if (error) throw new Error("Pas enregistré : " + error.message);
    return texte(`Mes thèmes : ${nomme(I, et)}`);
  }));

  // ---------- garder / passer / noter ----------
  serveur.registerTool("trier_post", {
    title: "Garder ou passer un post",
    description: PRODUIT_ACTIF + "Comme les boutons du site : « garder » met le post dans À reproduire (avec une note facultative : ce "
      + "qu'on en reprend — hook, structure, visuel, son), « passer » le sort des recommandés, « retirer » efface le tri. "
      + "Seul un post déjà montré à l'utilisateur ces 2 derniers jours (rendu par un outil de recherche) peut être trié.",
    inputSchema: {
      post: z.string().describe("Id ou URL du post."),
      action: z.enum(["garder", "passer", "retirer"]),
      note: z.string().max(2000).optional().describe("Avec « garder » : ce que l'utilisateur en reprend."),
    },
  }, outil<{ post: string; action: "garder" | "passer" | "retirer"; note?: string }>(async ({ post, action, note }, c) => {
    const F = await lireFavoris(c);
    const { id } = lireRef(post), avant = F.get(id);
    if (action === "retirer") {
      const { error } = await c.from("favoris").delete().eq("post_id", id);
      if (error) throw new Error("Pas enregistré : " + error.message);
      F.delete(id);
    } else {
      const statut = action === "garder" ? "a_reproduire" : "ecarte";
      const reprendre = note?.trim() || avant?.reprendre || null;
      // origine « agent » (13/11/2026) : la Bibliothèque dit d'où vient un post gardé ; la base ne la pose qu'au moment
      // où il devient gardé (un post déjà gardé sur le site le reste « sur le site »).
      const { error } = await c.from("favoris").upsert({ post_id: id, statut, reprendre, ...(action === "garder" ? { origine: "agent" } : {}) },
        { onConflict: "produit_id,post_id" });
      if (error) throw new Error("Pas enregistré : " + error.message);
      F.set(id, { statut, reprendre });
    }
    // Les listes de recommandés : un post trié en sort, la page suivante commence d'autant plus tôt.
    const delta = !avant && action !== "retirer" ? 1 : avant && action === "retirer" ? -1 : 0;
    if (delta) listes.forEach(l => { if (l.ids.has(id)) l.retires = Math.max(0, l.retires + delta); });
    const p = parId.get(id);
    return texte(`${action === "garder" ? "Gardé (À reproduire)" : action === "passer" ? "Passé" : "Tri retiré"} : ${p ? urlPost(p) : id}`
      + (action === "garder" && note ? " — note enregistrée." : ""));
  }));
  serveur.registerTool("noter_post", {
    title: "Noter un post gardé",
    description: PRODUIT_ACTIF + "Écrit (ou efface, avec une note vide) « ce que tu en reprends » sur un post déjà gardé dans À reproduire.",
    inputSchema: { post: z.string(), note: z.string().max(2000) },
  }, outil<{ post: string; note: string }>(async ({ post, note }, c) => {
    const F = await lireFavoris(c), { id } = lireRef(post);
    const v = note.trim() || null;
    const { data, error } = await c.from("favoris").update({ reprendre: v }).eq("post_id", id).select("post_id");
    if (error) throw new Error("Pas enregistrée : " + error.message);
    if (!data?.length) throw new Error("Ce post n'est pas gardé : `trier_post` avec action « garder » d'abord.");
    const f = F.get(id); if (f) f.reprendre = v;
    return texte(v ? "Note enregistrée." : "Note effacée.");
  }));

  // ---------- À reproduire ----------
  // L'origine d'un post gardé (favoris.origine, 13/11/2026) : qui l'a choisi.
  const ORIGINES: Record<string, string> = { site: "sur le site", agent: "par un agent", accueil: "pendant l'accueil",
    import: "importé", inconnue: "avant le suivi de l'origine" };
  serveur.registerTool("a_reproduire", {
    title: "À reproduire (posts gardés)",
    description: PRODUIT_ACTIF + "Tous les posts que l'utilisateur a gardés, du plus récent au plus ancien, avec sa note « ce qu'il en "
      + "reprend » et leur origine (gardé sur le site, par un agent, pendant l'accueil, importé ; avec la date) : le point "
      + "de départ pour créer ses contenus. `origine` n'en garde qu'une (« site » : ceux qu'il a choisis lui-même). "
      + "Hors quota (5 lectures par minute au plus).",
    inputSchema: {
      detail: z.boolean().optional(),
      origine: z.enum(["site", "agent", "accueil", "import", "inconnue"]).optional()
        .describe("Seulement les posts gardés de cette origine (inconnue : gardés avant le 13/11/2026, avant le suivi)."),
    },
  }, outil<{ detail?: boolean; origine?: string }>(async ({ detail, origine }, c) => {
    const I = await lireInfos(c), F = await lireFavoris(c);
    const { data, error } = await c.rpc("mes_gardes");
    if (error) throw new Error("mes_gardes : " + error.message);
    if (data.refus) return erreur(data.message);
    const tous = data.posts as Post[];
    tous.forEach(p => { parId.set(p.id, p); F.set(p.id, { statut: "a_reproduire", reprendre: p.reprendre ?? null }); });
    if (!tous.length) return texte("À reproduire est vide : garde des posts avec `trier_post` (ou sur le site).");
    const de = (p: Post) => p.origine || "inconnue";
    const posts = origine ? tous.filter(p => de(p) === origine) : tous;
    const par = new Map<string, number>();
    tous.forEach(p => par.set(de(p), (par.get(de(p)) || 0) + 1));
    const resume = [...par].map(([o, n]) => `${n} ${ORIGINES[o]}`).join(", ");
    if (!posts.length) return texte(`Aucun post gardé ${ORIGINES[origine!]} (sur ${tous.length} : ${resume}).`);
    return texte([`À reproduire — ${posts.length} posts gardés${origine ? ` ${ORIGINES[origine]} (sur ${tous.length})` : ""} (base du ${data.exporte_le}) · ${resume}\n${DONNEES}`,
      ...posts.map(p => lignePost(p, I, detail) + `\n  gardé le ${String(p.garde_le).slice(0, 10)} ${ORIGINES[de(p)]}`
        + (!detail ? (p.reprendre ? `\n  note : ${p.reprendre}` : "\n  note : —") : ""))].join("\n\n"));
  }));

  // ---------- la fiche produit ----------
  const liste = (xs: unknown) => Array.isArray(xs) && xs.length ? xs.map(x => `  - ${typeof x === "string" ? x : JSON.stringify(x)}`).join("\n") : "  —";
  serveur.registerTool("ma_fiche", {
    title: "Ma fiche produit",
    description: PRODUIT_ACTIF + "Ce que l'utilisateur a dit de lui à l'accueil (objectifs, @TikTok, ce qu'il vend, son lien, qui filme, "
      + "vues visées, ce qui le bloque) et sa fiche produit si elle est rédigée (produit, clients, problèmes, "
      + "positionnement, angles de vidéos). À lire avant de proposer des contenus ; la stratégie de contenu est dans "
      + "`ma_strategie`. Hors quota.",
    inputSchema: {},
  }, outil<Record<string, never>>(async (_a, c) => {
    const { data, error } = await c.from("accueil")
      .select("objectifs, compte, vend, lien, qui_filme, vues_visees, problemes, lecture, lu_le, fiche, fiche_le").maybeSingle();
    if (error) throw new Error("accueil : " + error.message);
    if (!data) return texte("Pas d'accueil rempli : l'utilisateur peut le faire sur viraldar.rayvol.net (menu du compte → Revoir l'accueil).");
    const pg = data.lecture?.page || {};
    const l = [
      "Profil (accueil) :",
      `  objectifs : ${(data.objectifs || []).join(", ") || "—"} · @TikTok : ${data.compte || "—"} · vend : ${data.vend || "—"}`,
      `  lien : ${data.lien || "—"}${pg.nom ? ` (page lue : ⟦${externe(pg.nom)}${pg.genre ? ", " + externe(pg.genre) : ""}⟧)` : ""} · qui filme : ${data.qui_filme || "—"} · vues visées : ${data.vues_visees || "—"}`,
      `  ce qui bloque : ${(data.problemes || []).join(", ") || "—"}`,
    ];
    const f = data.fiche;
    if (!f) l.push("", data.lu_le ? "Fiche produit : en cours de rédaction." : "Fiche produit : pas encore (il faut un lien et un @TikTok dans l'accueil).");
    else {
      l.push("", `Fiche produit (rédigée le ${String(data.fiche_le).slice(0, 10)}) :`,
        `Produit : ${f.produit?.resume || "—"}`, liste(f.produit?.fonctions),
        "Clients :", liste(f.clients), "Problèmes résolus :", liste(f.problemes),
        `Positionnement : ${f.positionnement?.pitch || "—"}`, liste(f.positionnement?.differences),
        "Angles de vidéos :", liste(f.angles));
      // Le reste (une stratégie, ajoutée plus tard), tel quel ; jamais le bloc `recherche`, réservé au propriétaire.
      const connus = new Set(["produit", "clients", "problemes", "positionnement", "angles", "recherche"]);
      for (const [k, v] of Object.entries(f)) if (!connus.has(k)) l.push(`${k[0].toUpperCase() + k.slice(1)} :`,
        typeof v === "string" ? "  " + v : Array.isArray(v) ? liste(v) : "  " + JSON.stringify(v, null, 1).replace(/\n\s*/g, " "));
    }
    return texte(l.join("\n"));
  }));
};
