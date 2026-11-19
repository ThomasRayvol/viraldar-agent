// La stratégie v2 (19/11/2026 ; proposition arbitrée le 18/11/2026,
// /mnt/Storage/viraldar/reference/design-2026-11/strategie/proposition-v2.md) : l'agent la modifie avec l'utilisateur.
//   modifier_ma_strategie  objectif (critère de conversion, cible, échéance, mesure), rythme, à éviter, note
//                          (RPC strategie_ecrire, auteur « agent » ; la version d'avant est gardée)
//   ecrire_angle           créer ou modifier un angle (RPC angle_ecrire, cree_par « agent »)
//   noter_resultats        les chiffres d'un post publié à une date (table resultats ; saisis par l'utilisateur ou lus
//                          par lui dans TikTok) — le relevé automatique, sur sa machine : relever_mes_posts (creation/releve.ts)
//   noter_execution        la note d'exécution (1 à 5) et son commentaire, fixés par l'utilisateur
//   noter_conversions      ses conversions d'une période, avec son critère, éventuellement par compte (table conversions)
//   bilan                  RPC strategie_bilan : verdict de chaque post, lecture de chaque angle (croisée avec
//                          l'exécution), conversions, relevés dus — seuils arbitrés le 19/11/2026
// La lecture est `ma_strategie` (plan.ts). Mêmes règles que la page (site/js/strategie.js) : la session de
// l'utilisateur, son produit actif, du texte seulement. Famille « base » (connecteur distant et MCP local).
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Contexte, Module } from "./contexte.ts";
import { PRODUIT_ACTIF, erreur, externe, texte } from "./rendu.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ligne = Record<string, any>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const court = (id: string) => String(id).slice(0, 8);
const STATUTS = ["a_tester", "en_test", "gagnant", "abandonne"] as const;
const LIB_STATUT: Record<string, string> = { a_tester: "à tester", en_test: "en test", gagnant: "gagnant", abandonne: "abandonné" };
const nul = (n: number) => z.string().max(n).nullable().optional();
const liste = (n: number, m: number) => z.array(z.string().min(1).max(m)).max(n).optional();

export const outilsStrategie: Module = (serveur, ctx: Contexte) => {
  async function sb(): Promise<SupabaseClient> {
    const c = await ctx.supabase();
    if (!c) throw new Error(ctx.pasConnecte());
    return c;
  }
  const outil = <A,>(fn: (a: A, c: SupabaseClient) => Promise<ReturnType<typeof texte>>) => async (a: A) => {
    try { return await fn(a, await sb()); } catch (e) { return erreur(ctx.expliquer((e as Error).message)); }
  };
  /** Une référence d'angle (8 caractères ou plus de son id, `ma_strategie`) → l'id complet, parmi les angles du produit. */
  async function angle(c: SupabaseClient, ref: string): Promise<string> {
    const r = ref.trim().toLowerCase();
    if (UUID.test(r)) return r;
    if (!/^[0-9a-f]{6,}$/.test(r)) throw new Error(`« ${ref} » n'est pas une référence d'angle (les 8 caractères donnés par \`ma_strategie\`).`);
    const { data, error } = await c.from("angles").select("id");
    if (error) throw new Error(error.message);
    const t = (data || []).map((x: Ligne) => x.id as string).filter(id => id.startsWith(r));
    if (!t.length) throw new Error(`Angle introuvable : ${ref}. Relis \`ma_strategie\`.`);
    if (t.length > 1) throw new Error(`Référence ambiguë : ${ref}. Donne l'id complet.`);
    return t[0];
  }

  serveur.registerTool("modifier_ma_strategie", {
    title: "Modifier ma stratégie",
    description: PRODUIT_ACTIF + "Modifie la stratégie de l'utilisateur, SEULEMENT avec son accord sur ce qui change : l'objectif (critère "
      + "de conversion qu'IL choisit — téléchargements, inscriptions, ventes, abonnements ou le sien —, cible chiffrée, "
      + "échéance, comment il le mesure), le rythme (posts par jour et par compte, comptes, précisions), ce qu'il faut "
      + "éviter. Seules les clés données changent (un objectif donné se fusionne avec l'actuel) ; la version d'avant est "
      + "gardée (page Stratégie → Les versions). Les angles : `ecrire_angle`.",
    inputSchema: {
      objectif: z.object({
        critere: nul(80).describe("Son critère de conversion : telechargements, inscriptions, ventes, abonnements, ou le sien en clair."),
        cible: z.number().int().min(0).nullable().optional().describe("La cible chiffrée du critère."),
        echeance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe("AAAA-MM-JJ."),
        mesure: nul(400).describe("Comment il le mesure (App Store Connect, Stripe, code promo, un lien par compte…)."),
      }).optional(),
      rythme: z.object({
        posts_jour: z.number().int().min(1).max(5).optional().describe("Posts par jour et par compte (5 au plus, la limite de TikTok)."),
        comptes: z.number().int().min(1).max(20).optional(),
        detail: nul(600),
      }).optional(),
      a_eviter: liste(12, 300).describe("La liste entière de ce qu'il faut éviter (remplace l'actuelle)."),
      note: nul(600).describe("Une note sur la stratégie (montrée à l'utilisateur)."),
      pourquoi: z.string().max(300).optional().describe("Pourquoi ce changement, en une phrase : gardé avec la version d'avant."),
    },
  }, outil<{ objectif?: Ligne; rythme?: Ligne; a_eviter?: string[]; note?: string | null; pourquoi?: string }>(async (a, c) => {
    const blocs: Ligne = {};
    if (a.objectif || a.rythme) {
      const { data, error } = await c.from("strategies").select("strategie").maybeSingle();
      if (error) throw new Error(error.message);
      const s = data?.strategie || {};
      if (a.objectif) blocs.objectif = { ...(s.objectif || {}), ...a.objectif };
      if (a.rythme) blocs.rythme = { ...(s.rythme || {}), ...a.rythme };
    }
    if (a.a_eviter) blocs.a_eviter = a.a_eviter.map(x => x.trim()).filter(Boolean);
    if (a.note !== undefined) blocs.note = a.note?.trim() || null;
    if (!Object.keys(blocs).length) throw new Error("Rien à changer : donne objectif, rythme, a_eviter ou note.");
    const { error } = await c.rpc("strategie_ecrire", { p_blocs: blocs, p_auteur: "agent", p_note: a.pourquoi?.trim() || null });
    if (error) throw new Error("Pas enregistrée : " + error.message);
    return texte(`Stratégie modifiée (${Object.keys(blocs).join(", ")}). La version d'avant est gardée : l'utilisateur peut y revenir `
      + "depuis la page Stratégie (Les versions).");
  }));

  serveur.registerTool("ecrire_angle", {
    title: "Créer ou modifier un angle de la stratégie",
    description: PRODUIT_ACTIF + "Un angle marketing de la stratégie : pour qui, la douleur (dans les mots du client), la promesse, les "
      + "preuves (avis, chiffres, démonstration), des accroches, l'hypothèse qu'on teste, les formats, la part visée des "
      + "posts, le statut (a_tester, en_test, gagnant, abandonne). Sans `angle` : en crée un ; avec : modifie celui-ci "
      + "(seules les clés données changent ; null efface). SEULEMENT avec l'accord de l'utilisateur. Ne passe un angle à "
      + "« abandonne » que sur des posts bien exécutés (note d'exécution 4 ou 5) qui n'ont pas marché ; à « gagnant » "
      + "quand ses posts mûrs le montrent (`bilan`). La version d'avant est gardée. Un angle est large (une cible et sa "
      + "douleur) ; une idée de post concrète (« la routine du soir en 3 étapes, l'app à la fin ») n'est pas un angle : "
      + "elle va dans `ecrire_idee` avec `angle` (arbitré le 18/11/2026). Les accroches sont des phrases d'ouverture.",
    inputSchema: {
      angle: z.string().max(36).optional().describe("Référence (`ma_strategie`) ou id complet ; absent = nouvel angle."),
      nom: z.string().min(1).max(120).optional().describe("Obligatoire pour un nouvel angle."),
      pour_qui: nul(500), douleur: nul(500), promesse: nul(500), hypothese: nul(600),
      preuves: liste(10, 300).describe("La liste entière (remplace l'actuelle)."),
      accroches: liste(10, 200).describe("La liste entière (remplace l'actuelle)."),
      formats: z.array(z.enum(["diaporama", "video"])).max(2).optional(),
      part_visee: z.number().int().min(0).max(100).nullable().optional().describe("Part visée des posts, en %."),
      statut: z.enum(STATUTS).optional(),
    },
  }, outil<Ligne>(async (a, c) => {
    const p: Ligne = {};
    for (const k of ["nom", "pour_qui", "douleur", "promesse", "hypothese", "preuves", "accroches", "formats", "part_visee", "statut"])
      if (a[k] !== undefined) p[k] = typeof a[k] === "string" ? a[k].trim() || null : a[k];
    if (a.angle) p.id = await angle(c, a.angle);
    else if (!p.nom) throw new Error("Un nouvel angle demande un `nom`.");
    if (Object.keys(p).length === (p.id ? 1 : 0)) throw new Error("Rien à changer.");
    const { data: id, error } = await c.rpc("angle_ecrire", { p });
    if (error) throw new Error("Pas enregistré : " + error.message);
    const { data: x } = await c.from("angles").select("nom, statut, part_visee").eq("id", id).maybeSingle();
    return texte(`${a.angle ? "Angle modifié" : "Angle créé"} : « ${externe(x?.nom ?? p.nom)} » (angle ${court(id)}) — ${LIB_STATUT[x?.statut] || x?.statut || "à tester"}`
      + `${x?.part_visee != null ? `, part visée ${x.part_visee} %` : ""}. Pour le servir dans le planning : \`maj_creneaux\` avec \`angle: "${court(id)}"\`.`);
  }));

  // ---------- la mesure (étape 4, 19/11/2026) ----------
  /** Une référence de créneau (8 caractères, `mon_planning` / `bilan`) → l'id complet, parmi ses créneaux. */
  async function creneau(c: SupabaseClient, ref: string): Promise<string> {
    const r = ref.trim().toLowerCase();
    if (UUID.test(r)) return r;
    if (!/^[0-9a-f]{6,}$/.test(r)) throw new Error(`« ${ref} » n'est pas une référence de créneau (les 8 caractères donnés par \`mon_planning\` ou \`bilan\`).`);
    // les créneaux publiés (ou qui ont un lien) : ceux qu'on mesure
    const { data, error } = await c.from("plan_creneaux").select("id").or("statut.eq.publie,tiktok_url.not.is.null");
    if (error) throw new Error(error.message);
    const t = (data || []).map((x: Ligne) => x.id as string).filter(id => id.startsWith(r));
    if (t.length !== 1) throw new Error(t.length ? `Référence ambiguë : ${ref}. Donne l'id complet.` : `Créneau publié introuvable : ${ref}. Relis \`bilan\` (un créneau se mesure une fois « publié », avec son lien).`);
    return t[0];
  }
  const entier = (n: unknown) => n == null ? "—" : Number(n).toLocaleString("fr-FR");
  const fois = (x: unknown) => x == null ? "—" : `×${Number(x).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}`;
  const VERDICT: Record<string, string> = { a_relever: "à relever", sans_repere: "sans repère (moins de 5 posts mûrs sur le compte)", gagnant: "GAGNANT",
    trop_jeune: "trop jeune (moins de 48 h)", au_dessus: "au-dessus", en_dessous: "en dessous", norme: "dans la norme" };
  const LECTURE: Record<string, string> = { trop_tot: "trop tôt (moins de 3 posts mûrs)", porte: "IL PORTE : ses posts font nettement mieux que d'habitude",
    n_attire_pas: "il n'attire pas : même bien exécutés, ses posts restent sous la médiane", non_concluant: "non concluant : les posts qui ratent ont une exécution faible — refaire l'exécution avant de juger l'angle",
    a_suivre: "à suivre : rien de net" };
  const PALIER: Record<string, string> = { "250": "~250 : personne ne s'arrête (accroche, qualité)", "700": "~700 : un début d'intérêt, pas assez pour être poussé",
    "1k": "1 000-1 200 : même cas, exécution un peu plus propre", "5k": "~5 000 : l'accroche commence à intéresser", "7k": "~7 000 : accroche intéressante, exécution à combler",
    "10k": "10 000-20 000 : bonne qualité, itérer dessus", "100k": "100 000 et plus : accroche forte, bien exécuté, itérer" };

  serveur.registerTool("noter_resultats", {
    title: "Noter les chiffres d'un post publié",
    description: PRODUIT_ACTIF + "Enregistre un relevé d'un post publié (un créneau « publié » du planning) : vues, et si on les a likes, "
      + "commentaires, partages, enregistrements, à la date du relevé (maintenant par défaut). À faire à 8 h, 48 h et 7 jours "
      + "(`bilan` dit lesquels sont dus). Les chiffres viennent de l'utilisateur ou de son TikTok ; sur sa machine, "
      + "`relever_mes_posts` les lit lui-même sur ses comptes. Ne jamais inventer un chiffre.",
    inputSchema: {
      creneau: z.string().max(36).describe("Référence du créneau publié (`bilan`, `mon_planning`) ou id complet."),
      vues: z.number().int().min(0),
      likes: z.number().int().min(0).optional(), commentaires: z.number().int().min(0).optional(),
      partages: z.number().int().min(0).optional(), enregistrements: z.number().int().min(0).optional(),
      le: z.string().datetime({ offset: true }).optional().describe("Date et heure du relevé (ISO 8601) ; maintenant par défaut."),
    },
  }, outil<Ligne>(async (a, c) => {
    const id = await creneau(c, a.creneau);
    const { error } = await c.from("resultats").insert({ creneau_id: id, vues: a.vues, likes: a.likes ?? null, commentaires: a.commentaires ?? null,
      partages: a.partages ?? null, enregistrements: a.enregistrements ?? null, source: "agent", ...(a.le ? { releve_le: a.le } : {}) });
    if (error) throw new Error("Pas enregistré : " + error.message);
    return texte(`Relevé enregistré pour le créneau ${court(id)} : ${entier(a.vues)} vues. \`bilan\` donne son verdict.`);
  }));

  serveur.registerTool("noter_execution", {
    title: "Noter l'exécution d'un post publié",
    description: PRODUIT_ACTIF + "La note d'exécution d'un post publié, de 1 à 5, et un court commentaire (« voix trop lente, accroche "
      + "illisible »). Elle dit si un post a raté parce que la copie n'était pas au niveau du modèle : sans elle, on conclurait "
      + "à tort qu'un angle n'attire pas. Propose une note d'après la comparaison modèle | nous (`montage_comparaison`) si "
      + "tu l'as, mais c'est L'UTILISATEUR qui la fixe : n'enregistre que la note qu'il a donnée ou validée.",
    inputSchema: {
      creneau: z.string().max(36).describe("Référence du créneau publié ou id complet."),
      note: z.number().int().min(1).max(5),
      commentaire: nul(500),
    },
  }, outil<{ creneau: string; note: number; commentaire?: string | null }>(async (a, c) => {
    const id = await creneau(c, a.creneau);
    const e: Ligne = { id, execution_note: a.note };
    if (a.commentaire !== undefined) e.execution_commentaire = a.commentaire?.trim() || null;
    const { data, error } = await c.rpc("plan_maj_creneaux", { p: [e] });
    if (error) throw new Error("Pas enregistrée : " + error.message);
    if (!data) throw new Error(`Créneau introuvable : ${a.creneau}.`);
    return texte(`Note d'exécution ${a.note}/5 enregistrée pour le créneau ${court(id)}.`);
  }));

  serveur.registerTool("noter_conversions", {
    title: "Noter des conversions",
    description: PRODUIT_ACTIF + "Les conversions que l'utilisateur DÉCLARE sur une période (du, au), avec SON critère (téléchargements, "
      + "achats, inscriptions… ; celui de sa stratégie par défaut) ; avec `compte`, celles d'un compte (lien en bio avec jeton "
      + "de campagne App Store, UTM Google Play, code promo) : la conversion par compte devient celle de son angle. Ne jamais "
      + "estimer ni inventer : seulement ses chiffres.",
    inputSchema: {
      du: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), au: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      valeur: z.number().min(0),
      critere: z.string().max(80).optional(),
      compte: z.string().max(31).optional().describe("@pseudo du compte, si la conversion lui est attribuée."),
      note: z.string().max(300).optional(),
    },
  }, outil<{ du: string; au: string; valeur: number; critere?: string; compte?: string; note?: string }>(async (a, c) => {
    let critere = a.critere?.trim();
    if (!critere) { const { data } = await c.from("strategies").select("strategie").maybeSingle(); critere = data?.strategie?.objectif?.critere || undefined; }
    const { error } = await c.from("conversions").insert({ debut: a.du, fin: a.au, valeur: a.valeur, critere: critere || null,
      compte: a.compte?.replace(/^@/, "").trim() || null, source: "agent", note: a.note?.trim() || null });
    if (error) throw new Error("Pas enregistrées : " + error.message);
    const lib: Record<string, string> = { telechargements: "téléchargements", inscriptions: "inscriptions", ventes: "ventes", abonnements: "abonnements" };
    return texte(`Conversions enregistrées : ${entier(a.valeur)}${critere ? ` ${lib[critere] || critere}` : ""} du ${a.du} au ${a.au}${a.compte ? ` pour @${a.compte.replace(/^@/, "")}` : ""}.`);
  }));

  serveur.registerTool("bilan", {
    title: "Le bilan de la stratégie",
    description: PRODUIT_ACTIF + "Ce que donnent ses posts publiés : pour chaque post, son dernier relevé, son indice (vues ÷ médiane des "
      + "posts mûrs du même compte, avec n), son verdict, son palier de vues et sa note d'exécution ; pour chaque angle, sa "
      + "lecture CROISÉE avec l'exécution (il porte / il n'attire pas / non concluant car mal exécuté / trop tôt) ; les "
      + "conversions déclarées ; les relevés dus. Les seuils sont proposés, pas encore arbitrés : dis-le. Ne passe un angle à "
      + "« abandonne » que sur des posts bien exécutés, et toujours avec l'accord de l'utilisateur (`ecrire_angle`).",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, outil<Record<string, never>>(async (_a, c) => {
    const { data: b, error } = await c.rpc("strategie_bilan");
    if (error) throw new Error(error.message);
    const S = b.seuils, l: string[] = [];
    l.push(`Seuils (${S.statut}) : gagnant ${fois(S.gagnant)}, au-dessus ${fois(S.au_dessus)}, en dessous < ${fois(S.en_dessous)} la médiane des posts mûrs (${S.mur_h} h et plus) du compte ; `
      + `pas d'indice sous ${S.sans_repere_n} posts mûrs ; un angle se juge sur ${S.angle_n} posts mûrs au moins.`, "");
    const noms = new Map<string, string>((b.angles || []).map((x: Ligne) => [x.angle, x.nom]));
    l.push(`Angles :`);
    for (const x of b.angles || []) l.push(`  « ${externe(x.nom)} » (angle ${court(x.angle)}, statut ${LIB_STATUT[x.statut] || x.statut}) — ${LECTURE[x.lecture] || x.lecture}`
      + `\n     ${entier(x.publies)} publiés, ${entier(x.murs)} mûrs ; indice médian ${fois(x.indice_med)} (n = ${entier(x.n_indice)}) ; bien exécutés : indice médian ${fois(x.indice_med_bien)} (n = ${entier(x.n_bien)}) ; `
      + `${entier(x.gagnants)} gagnants, ${entier(x.au_dessus)} au-dessus, ${entier(x.en_dessous)} en dessous ; exécution : ${entier(x.bien_executes)} bonnes (4-5), ${entier(x.mal_executes)} faibles (1-2)`);
    const posts = b.posts || [];
    l.push("", posts.length ? `Posts publiés (${posts.length}, du plus récent) :` : "Aucun post publié : un créneau passe à « publié » quand l'utilisateur l'a publié (`maj_creneaux`, avec son `lien`).");
    for (const p of posts.slice(0, 40)) l.push(`  créneau ${court(p.creneau)} · @${p.compte} · ${String(p.publie_le || "").slice(0, 10)}${p.titre ? ` · « ${externe(p.titre).slice(0, 80)} »` : ""}`
      + ` · angle ${p.angle ? `« ${externe(noms.get(p.angle) || "?")} »` : "—"}`
      + `\n     ${p.vues != null ? `${entier(p.vues)} vues (relevé à ${entier(p.age_h)} h) · ${VERDICT[p.verdict] || p.verdict}${p.indice != null ? ` ${fois(p.indice)} la médiane du compte (${entier(Math.round(p.mediane_compte))} vues, n = ${p.n_mediane})` : ""} · palier ${PALIER[p.palier] || "—"}` : "pas encore relevé"}`
      + ` · exécution ${p.execution_note ? `${p.execution_note}/5${p.execution_commentaire ? ` (${externe(p.execution_commentaire)})` : ""}` : "PAS NOTÉE (à demander à l'utilisateur : `noter_execution`)"}`
      + `${p.url ? "" : " · sans lien TikTok (`maj_creneaux` avec `lien`)"}`);
    const cv = b.conversions || {};
    l.push("", cv.n ? `Conversions déclarées : ${entier(cv.total)} (${(cv.criteres || []).join(", ") || "critère non précisé"}) sur ${cv.n} période(s), du ${cv.debut} au ${cv.fin}`
      + (Object.keys(cv.par_compte || {}).filter(Boolean).length ? ` ; par compte : ${Object.entries(cv.par_compte).filter(([k]) => k).map(([k, v]) => `@${k} ${entier(v)}`).join(", ")}` : "")
      + ". TikTok ne relie pas une conversion à un post : sans compte, elles se lisent en regard des angles publiés sur la période."
      : "Aucune conversion déclarée : demande-lui ses chiffres (son critère : téléchargements, achats…) et `noter_conversions`.");
    const dus = b.releves_dus || [];
    if (dus.length) l.push("", `Relevés dus (${dus.length}) : ${dus.slice(0, 20).map((d: Ligne) => `créneau ${court(d.creneau)} @${d.compte} (${d.quand})`).join(", ")}. `
      + "Sur sa machine : `relever_mes_posts` ; sinon, ses chiffres et `noter_resultats`.");
    l.push("", "Paliers de vues (repère d'expérience, pas une règle) : sous 10 000 vues, c'est l'accroche et l'exécution qui manquent ; au-dessus, la qualité est là et l'écart tient surtout à l'algorithme (`methode`, references/lire-les-stats).");
    return texte(l.join("\n"));
  }));
};
