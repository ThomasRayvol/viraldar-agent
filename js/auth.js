// La connexion du MCP à viraldar : une session Supabase à part, gardée dans ~/.config/viraldar/session.json (600).
//
// Le parcours (10/11/2026). La connexion par e-mail est gardée par Turnstile, qu'un MCP ne peut pas passer : c'est
// donc le navigateur qui se connecte, sur la page du site /agent (site/agent.html, site/js/agent.js), et qui rend la
// session au MCP.
//   1. `connexion` ouvre un petit serveur sur 127.0.0.1 (port libre) et tire un `state` aléatoire, essaie d'ouvrir
//      https://viraldar.rayvol.net/agent#port=…&state=… (le fragment ne part jamais au serveur du site) dans le
//      navigateur par défaut et rend AUSSITÔT le lien à l'agent (0.2.2), pour que l'utilisateur l'ouvre dans le
//      navigateur où il est connecté s'il préfère. `connexion` avec `attendre: true` attend ensuite la session.
//   2. La page se connecte avec un client Supabase À PART (sessionStorage, autre clé que la page principale) :
//      e-mail + mot de passe + Turnstile, ou Google (PKCE, retour sur /agent). C'est une NOUVELLE session, distincte
//      de celle du navigateur : partager celle du navigateur casserait la rotation des refresh tokens (le premier qui
//      rafraîchit révoquerait l'autre, et Supabase ferme toute la session quand un jeton révoqué revient).
//   3. La page POSTe {state, access_token, refresh_token} à http://127.0.0.1:<port>/session (fetch en text/plain,
//      sans preflight ; à défaut, un formulaire POST en navigation). Jamais de jeton dans une URL.
//   4. Le MCP vérifie l'hôte, l'origine et le state (voir origineAcceptee), pose la session, la rafraîchit aussitôt (les jetons passés par
//      le navigateur ne servent plus), l'écrit en 600 et ferme le serveur.
// Ensuite la session se rafraîchit à la demande, sous un verrou de fichier (voir « le rafraîchissement ») ; le fichier
// est relu à chaque fois, si bien que plusieurs MCP (Claude Desktop, plusieurs Claude Code) qui le partagent voient
// chacun le dernier jeton.
import { createClient, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { sousRacine } from "./racine.js";
import { proposerLecture } from "./chemins.js";
// ---------- configuration : publique par nature, surchargeable ----------
// Mêmes noms que la configuration du site (la clé « publishable » est la clé anon, protégée par la RLS).
const SUPABASE_URL = process.env.VIRALDAR_SUPABASE_URL || "https://iarcyvzipvvopcebqpnr.supabase.co";
const SUPABASE_CLE = process.env.VIRALDAR_SUPABASE_ANON_KEY || "sb_publishable_mxq_VfEolNBDqX04B2KthQ_Yc9Q8khj";
const SITE = (process.env.VIRALDAR_SITE_URL || "https://viraldar.rayvol.net").replace(/\/+$/, "");
const FICHIER_SESSION = process.env.VIRALDAR_SESSION
    || join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "viraldar", "session.json");
const DOSSIER_TRAVAIL = process.env.VIRALDAR_DOSSIER || join(homedir(), "viraldar");
// Ce que `connexion` (attendre: true) attend avant de rendre la main : 1 minute (2 avant le 12/11/2026), pour que
// l'appel ne paraisse jamais bloqué ; l'agent le rappelle tant que l'utilisateur n'a pas autorisé.
const ATTENTE_OUTIL_MS = 60_000;
const VIE_SERVEUR_MS = 10 * 60_000; // ce que le serveur local attend la page, au plus
const ESSAIS_MAX = 20; // states faux tolérés avant de fermer le serveur (il faut alors relancer)
// ---------- la session sur disque (600), relue à chaque lecture ----------
const CLE = "viraldar-mcp"; // la session, telle que supabase-js la range
const CLE_PERDUE = "viraldar-mcp-perdue"; // le motif, quand un processus a constaté la fin de la session
function lireFichier() {
    try {
        return JSON.parse(readFileSync(FICHIER_SESSION, "utf8"));
    }
    catch {
        return {};
    }
}
function ecrireFichier(contenu) {
    if (!Object.keys(contenu).length) {
        rmSync(FICHIER_SESSION, { force: true });
        return;
    }
    mkdirSync(dirname(FICHIER_SESSION), { recursive: true, mode: 0o700 });
    // Écriture atomique (un fichier à part, puis rename) : un autre processus ne lit jamais un fichier à moitié écrit.
    const tmp = `${FICHIER_SESSION}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    writeFileSync(tmp, JSON.stringify(contenu), { mode: 0o600 });
    try {
        chmodSync(tmp, 0o600);
    }
    catch { /* Windows */ }
    renameSync(tmp, FICHIER_SESSION);
}
const stockage = {
    getItem: (k) => lireFichier()[k] ?? null,
    setItem: (k, v) => { const c = lireFichier(); c[k] = v; if (k === CLE)
        delete c[CLE_PERDUE]; ecrireFichier(c); },
    removeItem: (k) => { const c = lireFichier(); delete c[k]; ecrireFichier(c); },
};
// ---------- le produit actif (multi-produits, 15/11/2026) ----------
// Un compte viraldar a plusieurs produits (une app, un SaaS…) : la fiche, la stratégie, les mots-clés, les posts gardés,
// les idées et les plans dépendent du produit. Le produit actif part dans l'en-tête `x-viraldar-produit` de chaque
// requête à la base (la fonction `produit_courant()` le lit, s'il appartient bien au compte ; sans lui, le premier
// produit du compte). D'où vient-il, du plus fort au plus faible :
//   1. le choix fait dans ce processus (`choisir_produit`) ;
//   2. VIRALDAR_PRODUIT (nom ou id), pour qu'un dossier de travail travaille toujours sur le même produit ;
//   3. le dernier choix gardé dans session.json (avec le compte qui l'a fait : un autre compte ne le reprend pas).
// Plusieurs MCP partagent le fichier : le choix d'un processus ne change pas les autres tant qu'ils ont le leur.
const CLE_PRODUIT = "viraldar-produit"; // {"user": "<user_id>", "id": "<produit_id>"}
const PRODUIT_ENV = (process.env.VIRALDAR_PRODUIT || "").trim();
let produitProcessus = null;
let produitEnv = null; // VIRALDAR_PRODUIT résolu pour ce compte
/** Le compte de la session gardée (le `sub` du jeton d'accès), sans appel réseau. */
function userStocke() {
    const s = stockee();
    if (!s)
        return null;
    try {
        return JSON.parse(Buffer.from(s.access_token.split(".")[1], "base64url").toString("utf8")).sub ?? null;
    }
    catch {
        return null;
    }
}
function produitGarde() {
    const u = userStocke();
    if (!u)
        return null;
    if (produitProcessus?.user === u)
        return produitProcessus.id;
    if (produitEnv?.user === u && produitEnv.id)
        return produitEnv.id;
    try {
        const g = JSON.parse(lireFichier()[CLE_PRODUIT] ?? "null");
        return g && g.user === u && typeof g.id === "string" ? g.id : null;
    }
    catch {
        return null;
    }
}
/** fetch de supabase-js, avec le produit actif (pas sur Auth, qui n'en a que faire). */
const fetchProduit = (entree, init) => {
    const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
    const id = url.includes("/auth/v1/") ? null : produitGarde();
    if (!id)
        return fetch(entree, init);
    const h = new Headers(init?.headers ?? (entree instanceof Request ? entree.headers : undefined));
    h.set("x-viraldar-produit", id);
    return fetch(entree, { ...init, headers: h });
};
const client = createClient(SUPABASE_URL, SUPABASE_CLE, {
    global: { fetch: fetchProduit },
    auth: {
        storage: stockage, storageKey: CLE, persistSession: true,
        // Pas de minuterie : la session se rafraîchit à la demande (sessionCourante, avant chaque outil), en relisant le fichier.
        autoRefreshToken: false, detectSessionInUrl: false,
    },
});
// ---------- le rafraîchissement, coordonné entre processus ----------
// Le jeton d'accès vit 30 minutes et le refresh token tourne à chaque usage (rotation). Plusieurs MCP partagent le
// fichier (une session Claude Code par dossier, Claude Desktop) : le 12/11/2026, quatre processus démarrés à la même
// seconde rafraîchissaient le même refresh token. D'où :
//   - un verrou de fichier (session.json.verrou, créé en exclusif) autour du refresh : un seul processus rafraîchit,
//     les autres attendent puis relisent le fichier, où ils trouvent la paire neuve ;
//   - le refresh anticipé, 5 minutes avant l'expiration (supabase-js n'anticipe que de 90 s) : une requête ne part
//     pas avec un jeton qui expire en route ;
//   - un échec réseau (réveil de la machine, Wi-Fi) n'est pas une session perdue : le fichier est gardé et l'outil dit
//     de réessayer, au lieu d'un « pas connecté » qui envoyait l'agent vers `connexion` ;
//   - un refus définitif n'efface la session que si le fichier porte encore le refresh token refusé (un autre
//     processus a pu écrire une session neuve entre-temps), et laisse le motif dans le fichier, pour que les autres
//     processus disent « reconnecte-toi » plutôt que « pas connecté ».
// Ce qui a coupé la session le 12/11/2026 venait du site : « Se déconnecter » appelait signOut() en portée globale,
// qui supprime aussi les sessions des agents (journaux d'Auth : logout global à 16:13 UTC, puis « Refresh Token Not
// Found » au refresh suivant de l'agent) ; corrigé dans site/js/connexion.js (portée « local »).
const ANTICIPATION_MS = 5 * 60_000;
const MARGE_SUPABASE_MS = 90_000; // EXPIRY_MARGIN_MS de supabase-js : en deçà, getSession rafraîchit lui-même
const VERROU = FICHIER_SESSION + ".verrou";
const VERROU_PERIME_MS = 20_000; // un verrou plus vieux vient d'un processus mort en route
const VERROU_ATTENTE_MS = 15_000; // au-delà, on rafraîchit sans verrou plutôt que de bloquer l'outil
function stockee() {
    try {
        const s = JSON.parse(lireFichier()[CLE] ?? "null");
        return s && typeof s.refresh_token === "string" && typeof s.access_token === "string" ? s : null;
    }
    catch {
        return null;
    }
}
const resteMs = (s) => (s.expires_at ?? Infinity) * 1000 - Date.now();
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function avecVerrou(fn) {
    mkdirSync(dirname(VERROU), { recursive: true, mode: 0o700 });
    const moi = `${process.pid}.${randomBytes(6).toString("hex")}`, debut = Date.now();
    let tenu = false;
    while (!tenu) {
        try {
            writeFileSync(VERROU, moi, { flag: "wx", mode: 0o600 });
            tenu = true;
        }
        catch (e) {
            if (e.code !== "EEXIST")
                break; // dossier en lecture seule… : sans verrou
            try {
                if (Date.now() - statSync(VERROU).mtimeMs > VERROU_PERIME_MS) {
                    rmSync(VERROU, { force: true });
                    continue;
                }
            }
            catch {
                continue;
            } // libéré entre-temps
            if (Date.now() - debut > VERROU_ATTENTE_MS)
                break;
            await pause(50 + Math.random() * 100);
        }
    }
    try {
        return await fn();
    }
    finally {
        if (tenu)
            try {
                if (readFileSync(VERROU, "utf8") === moi)
                    rmSync(VERROU, { force: true });
            }
            catch { /* déjà parti */ }
    }
}
// ---------- la session perdue (révoquée depuis viraldar → Agentique, ou expirée) ----------
// Quand le refresh échoue pour de bon, on garde le motif (en mémoire et dans le fichier) pour que les outils disent
// « reconnecte-toi » plutôt qu'un « pas connecté » muet. Une seule fois : aucun outil ne relance la connexion de
// lui-même, c'est l'agent qui appelle `connexion` (et l'utilisateur qui autorise).
let perdue = null;
let reseau = null; // le dernier échec réseau, tant qu'aucune lecture n'a réussi depuis
const MSG_PERDUE = "La session de ton agent chez viraldar a pris fin (révoquée dans viraldar → Agentique, ou "
    + "expirée). Appelle l'outil `connexion` une fois : l'utilisateur réautorise l'agent dans son navigateur. Ne "
    + "réessaie pas l'outil en boucle avant.";
const MSG_PAS_CONNECTE = "Pas connecté à viraldar : appelle l'outil `connexion`, puis recommence.";
const msgReseau = (m) => `viraldar est injoignable pour l'instant (réseau : ${m}). La session est gardée : `
    + "réessaie l'outil dans une minute, sans appeler `connexion`.";
/** La session est finie : on l'oublie, sauf si le fichier porte déjà une autre session (écrite par un autre
 *  processus, ou une nouvelle connexion) que celle dont le refresh token a été refusé. */
function marquerPerdue(motif, refreshRefuse) {
    const s = stockee();
    if (s && s.refresh_token !== refreshRefuse)
        return;
    const c = lireFichier();
    delete c[CLE];
    c[CLE_PERDUE] = motif;
    ecrireFichier(c);
    perdue = motif;
    declaree = null;
}
function traiterEchec(error, refreshUtilise) {
    console.error("viraldar : session :", error.message);
    if (isAuthRetryableFetchError(error)) {
        reseau = error.message;
        return;
    }
    // La paire a été remplacée par un autre processus pendant notre refresh : rien de perdu.
    if (error.name === "AuthRefreshDiscardedError")
        return;
    // Refus définitif (session supprimée côté viraldar, jeton révoqué, compte supprimé).
    marquerPerdue(error.message, refreshUtilise);
}
async function lireSession() {
    const s = stockee();
    if (!s) {
        perdue = perdue ?? lireFichier()[CLE_PERDUE] ?? null;
        return null;
    }
    if (resteMs(s) < ANTICIPATION_MS) {
        await avecVerrou(async () => {
            const t = stockee(); // relu sous le verrou : un autre processus a pu rafraîchir pendant l'attente
            if (!t || resteMs(t) >= ANTICIPATION_MS)
                return;
            // Sous la marge de supabase-js, getSession rafraîchit lui-même ; au-dessus, on le lui demande.
            const { error } = resteMs(t) < MARGE_SUPABASE_MS ? await client.auth.getSession() : await client.auth.refreshSession();
            if (error)
                traiterEchec(error, t.refresh_token);
        });
    }
    const avant = stockee();
    if (!avant) {
        perdue = perdue ?? lireFichier()[CLE_PERDUE] ?? null;
        return null;
    }
    const { data, error } = await client.auth.getSession();
    if (error)
        traiterEchec(error, avant.refresh_token);
    if (data.session) {
        reseau = null;
        perdue = null;
    }
    return data.session;
}
// Une lecture à la fois par processus : des outils lancés ensemble partagent la même.
let enCours = null;
function sessionCourante() {
    if (!enCours)
        enCours = lireSession().finally(() => { enCours = null; });
    return enCours;
}
/** Ce que disent les outils sans session. */
function messageSansSession() {
    if (perdue)
        return MSG_PERDUE;
    if (reseau && stockee())
        return msgReseau(reseau);
    return MSG_PAS_CONNECTE;
}
/** Où les outils lisent, dit à la connexion : le réglage de lecture se propose dès le départ, jamais après coup. */
function etatLecture() {
    const v = (process.env.VIRALDAR_LECTURE || "").trim();
    if (/^(partout|\*)$/i.test(v))
        return `Dossier de travail : ${DOSSIER_TRAVAIL}. Lecture de fichiers élargie par l'utilisateur à tout le disque (hors dossiers cachés).`;
    if (v)
        return `Dossier de travail : ${DOSSIER_TRAVAIL}. Lecture de fichiers élargie par l'utilisateur à : ${v}.`;
    return `Dossier de travail : ${DOSSIER_TRAVAIL} ; les outils ne lisent que ce dossier (lecture stricte). Demande à `
        + `l'utilisateur où sont ses médias, polices ou sa banque de contenus ; s'ils sont ailleurs : ${proposerLecture(DOSSIER_TRAVAIL)}`;
}
/** Une RPC a refusé la session : on demande à viraldar (getUser) avant de l'oublier, jamais sur la seule foi du
 *  message. Un jeton d'accès expiré (horloge de la machine en retard) se renouvelle, il ne fait rien perdre. */
async function verifierRefus(motif) {
    const s = stockee();
    if (!s)
        return;
    if (/JWT expired/i.test(motif)) {
        await avecVerrou(async () => {
            const t = stockee();
            if (t?.refresh_token !== s.refresh_token)
                return; // déjà renouvelé ailleurs
            const { error } = await client.auth.refreshSession();
            if (error)
                traiterEchec(error, s.refresh_token);
        });
        return;
    }
    const { error } = await client.auth.getUser();
    if (error && !isAuthRetryableFetchError(error))
        marquerPerdue(`${motif} (${error.message})`, s.refresh_token);
}
/** Une erreur renvoyée par une RPC ou une fonction : dit-elle que la session n'est plus valable ? */
function sessionRefusee(message) {
    if (message.startsWith(MSG_PERDUE))
        return false; // déjà expliquée
    return /session r[ée]voqu[ée]e|session requise|session_id claim|session_not_found|auth session missing|JWT expired|invalid JWT|PGRST30[123]|refresh token/i.test(message);
}
// ---------- la déclaration de l'agent (viraldar → Agentique) ----------
// Une ligne par session d'agent dans agent_connexions, que l'utilisateur voit et révoque. Déclarée à la connexion,
// et à chaque reprise (démarrage du MCP avec une session gardée) : declarer_agent met alors à jour vue_le.
const VERSION_MCP = (() => {
    try {
        return JSON.parse(readFileSync(sousRacine("package.json"), "utf8")).version;
    }
    catch {
        return "?";
    }
})();
let nomClient = () => undefined;
let declaree = null; // le session_id déjà déclaré par ce processus
/** index.ts donne le nom du client MCP (Claude Code, Claude Desktop…) une fois l'initialisation faite. */
export function nommerClient(f) { nomClient = f; }
function idSession(s) {
    try {
        const charge = JSON.parse(Buffer.from(s.access_token.split(".")[1], "base64url").toString("utf8"));
        return typeof charge.session_id === "string" ? charge.session_id : null;
    }
    catch {
        return null;
    }
}
/** Déclare la session à viraldar si ce processus ne l'a pas encore fait. Jamais bloquant pour l'outil appelant. */
export async function declarerAgent(forcer = false) {
    const s = await sessionCourante();
    if (!s)
        return;
    const id = idSession(s);
    if (!id || (!forcer && declaree === id))
        return;
    const client_ = ["viraldar-mcp " + VERSION_MCP, nomClient()].filter(Boolean).join(" / ").slice(0, 80);
    const { error } = await client.rpc("declarer_agent", { p_client: client_ });
    if (error) {
        console.error("viraldar : declarer_agent :", error.message);
        return;
    }
    declaree = id;
}
/** Le fichier de session donne accès au compte viraldar (et aux brouillons TikTok) : on resserre ses droits à
 *  chaque démarrage, au cas où il aurait été copié ou restauré avec des droits plus larges. */
function resserrerDroits() {
    if (process.platform === "win32")
        return; // le profil Windows est déjà privé
    for (const [p, mode] of [[dirname(FICHIER_SESSION), 0o700], [FICHIER_SESSION, 0o600]]) {
        try {
            if ((statSync(p).mode & 0o077) !== 0)
                chmodSync(p, mode);
        }
        catch { /* absent */ }
    }
}
/** Les produits du compte et l'actif (le même que produit_courant() côté base : l'en-tête s'il est à lui, sinon le
 *  premier par date de création). null sans session. */
async function lireProduits() {
    if (!(await sessionCourante()))
        return null;
    const { data, error } = await client.from("produits").select("id, nom, cree_le").order("cree_le").order("id");
    if (error)
        throw new Error("produits : " + error.message);
    const liste = (data || []);
    if (!liste.length)
        throw new Error("Aucun produit sur ce compte viraldar.");
    const u = userStocke();
    if (PRODUIT_ENV && u && produitEnv?.user !== u) {
        const v = PRODUIT_ENV.toLowerCase();
        const t = liste.find(p => p.id === PRODUIT_ENV) ?? liste.find(p => p.nom.trim().toLowerCase() === v);
        if (!t)
            console.error(`viraldar : VIRALDAR_PRODUIT=${PRODUIT_ENV} ne désigne aucun produit du compte.`);
        produitEnv = { user: u, id: t?.id ?? null };
    }
    const g = produitGarde();
    return { liste, actif: liste.find(p => p.id === g) ?? liste[0] };
}
/** Choisit le produit actif, pour ce processus et comme dernier choix gardé (les MCP qui démarrent le reprennent). */
function choisirProduit(id) {
    const u = userStocke();
    if (!u)
        return;
    produitProcessus = { user: u, id };
    stockage.setItem(CLE_PRODUIT, JSON.stringify({ user: u, id }));
}
export async function creerContexte() {
    resserrerDroits();
    return {
        supabase: async () => {
            if (!(await sessionCourante()))
                return null;
            await declarerAgent().catch((e) => console.error("viraldar : declarer_agent :", e.message));
            return client;
        },
        pasConnecte: messageSansSession,
        expliquer: (message) => {
            if (!sessionRefusee(message))
                return message;
            // Vérifiée en arrière-plan : la session n'est oubliée que si viraldar confirme qu'elle est finie.
            verifierRefus(message).catch((e) => console.error("viraldar : vérification de session :", e.message));
            if (/JWT expired/i.test(message))
                return `Le jeton d'accès était expiré (${message}) : il se renouvelle, réessaie l'outil une fois.`;
            return MSG_PERDUE + ` (${message})`;
        },
        produits: lireProduits,
        choisirProduit,
        produitId: produitGarde,
        supabaseUrl: SUPABASE_URL,
        dossierTravail: DOSSIER_TRAVAIL,
    };
}
let attente = null;
const ORIGINES = new Set([SITE, ...(process.env.VIRALDAR_ORIGINES_AGENT || "").split(",").map(s => s.trim()).filter(Boolean)]);
const memeState = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
// L'origine « null » (12/11/2026, 0.2.2). Ce que reçoit ce serveur, relevé dans Chrome 155 :
//   - le fetch de /agent arrive avec Origin https://viraldar.rayvol.net, mais Chrome demande d'abord la permission
//     d'accès au réseau local (Local Network Access) et Brave bloque localhost d'office pour la plupart des sites ;
//   - le formulaire de secours (navigation POST, que cette permission ne bloque pas) arrivait avec Origin « null »
//     et sans Referer, parce que /agent avait <meta name="referrer" content="no-referrer"> : la spécification Fetch
//     sérialise alors en « null » l'origine d'une requête non-CORS. D'où « origine refusée » dès que le fetch échouait.
// La page pose maintenant la politique « origin » juste avant le formulaire, qui porte alors l'origine du site. On
// accepte en plus « null », sur ce seul chemin (POST /session, corps de formulaire, Sec-Fetch-Mode navigate s'il est
// là), pour les navigateurs ou extensions qui masquent encore l'origine. La requête n'y passe qu'avec le state : 256
// bits tirés pour cette connexion, donnés seulement dans le fragment du lien (jamais envoyé à un serveur), comparé en
// temps constant, valable 10 minutes, à usage unique (`termine`, puis le serveur ferme) et ESSAIS_MAX faux au plus.
// Une page tierce ne connaît ni le port ni le state ; l'origine reste une défense en plus pour le fetch (CORS : seul
// le site lit la réponse). Une origine ABSENTE reste refusée : tout navigateur actuel en envoie une sur un POST qui
// change de site, son absence désigne un client hors navigateur. L'hôte (127.0.0.1:<port>) reste contrôlé.
function origineAcceptee(req, formulaire) {
    const o = req.headers.origin;
    if (o && ORIGINES.has(o))
        return true;
    const mode = req.headers["sec-fetch-mode"];
    return o === "null" && formulaire && (mode === undefined || mode === "navigate");
}
function lireCorps(req) {
    return new Promise((ok, ko) => {
        let n = 0;
        const morceaux = [];
        req.on("data", (m) => { n += m.length; if (n > 64 * 1024) {
            ko(new Error("corps trop long"));
            req.destroy();
        }
        else
            morceaux.push(m); });
        req.on("end", () => ok(Buffer.concat(morceaux).toString("utf8")));
        req.on("error", ko);
    });
}
const html = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const page = (titre, texte) => `<!doctype html><html lang="fr"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${titre} – viraldar</title>
<body style="font:16px/1.5 system-ui,sans-serif;background:#0b0d12;color:#e8ecf3;display:grid;place-items:center;min-height:100vh;margin:0">
<main style="max-width:420px;padding:24px"><h1 style="font-size:20px">${html(titre)}</h1><p>${html(texte)}</p></main></body></html>`;
/** Essaie d'ouvrir le lien dans le navigateur par défaut ; on ne sait pas si cela a marché, d'où le lien rendu à
 *  l'agent dans tous les cas. */
function ouvrirNavigateur(url) {
    const [cmd, args] = process.platform === "darwin" ? ["open", [url]]
        // Windows : sans cmd.exe (dont les métacaractères de l'URL seraient interprétés).
        : process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
            : ["xdg-open", [url]];
    try {
        const p = spawn(cmd, args, { detached: true, stdio: "ignore" });
        p.on("error", () => { });
        p.unref();
    }
    catch { /* l'URL est rendue à l'agent de toute façon */ }
}
async function demarrerAttente() {
    if (attente)
        return attente;
    const state = randomBytes(32).toString("base64url");
    let resoudre, rejeter;
    const fin = new Promise((ok, ko) => { resoudre = ok; rejeter = ko; });
    fin.catch(() => { });
    let port = 0, essais = 0, termine = false, ferme = false;
    const serveur = createServer(async (req, res) => {
        const origine = req.headers.origin;
        const cors = (code, corps = "", type = "application/json") => {
            const h = { "Content-Type": type, "Cache-Control": "no-store", Vary: "Origin" };
            if (origine && ORIGINES.has(origine))
                Object.assign(h, {
                    "Access-Control-Allow-Origin": origine, "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "content-type",
                    "Access-Control-Allow-Private-Network": "true", // l'ancien preflight PNA de Chrome ; sans effet ailleurs
                });
            res.writeHead(code, h);
            res.end(corps);
        };
        // Contre le DNS rebinding : seul 127.0.0.1:<port> est servi.
        if (req.headers.host !== `127.0.0.1:${port}`)
            return cors(421, '{"erreur":"hôte inattendu"}');
        if (req.url !== "/session")
            return cors(404, '{"erreur":"introuvable"}');
        if (req.method === "OPTIONS")
            return cors(204);
        if (req.method !== "POST")
            return cors(405, '{"erreur":"POST seulement"}');
        const formulaire = (req.headers["content-type"] || "").startsWith("application/x-www-form-urlencoded");
        const repondre = (code, ok, message) => formulaire
            ? cors(code, page(ok ? "Agent connecté" : "Connexion refusée", 
            // La page /agent ajoute elle-même cette phrase ; le formulaire de repli n'affiche que ce texte-ci.
            ok ? message + " Pour couper cette connexion plus tard : viraldar → Agentique → Révoquer." : message), "text/html; charset=utf-8")
            : cors(code, JSON.stringify(ok ? { ok, message } : { erreur: message }));
        if (!origineAcceptee(req, formulaire))
            return repondre(403, false, "Origine refusée : ouvre le lien donné par ton agent et autorise-le depuis cette page.");
        if (termine || ferme)
            return repondre(409, false, "Ce lien a déjà servi ou n'est plus valable : relance la connexion depuis ton agent s'il le faut.");
        try {
            const brut = await lireCorps(req);
            const d = formulaire ? Object.fromEntries(new URLSearchParams(brut)) : JSON.parse(brut);
            if (typeof d.state !== "string" || !memeState(d.state, state)) {
                if (++essais >= ESSAIS_MAX) {
                    rejeter(new Error("trop d'essais avec un lien faux"));
                    fermer();
                }
                return repondre(403, false, "Ce lien n'est plus valable : relance la connexion depuis ton agent.");
            }
            if (typeof d.access_token !== "string" || typeof d.refresh_token !== "string")
                return repondre(400, false, "Session incomplète.");
            termine = true; // usage unique : une seconde requête (le formulaire après un fetch lent) est refusée
            const pose = await client.auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token });
            if (pose.error || !pose.data.session) {
                termine = false;
                return repondre(401, false, "Session refusée par viraldar : " + (pose.error?.message || "inconnue"));
            }
            // Une paire neuve, que le navigateur n'a jamais vue.
            const neuve = await client.auth.refreshSession();
            if (neuve.error)
                console.error("viraldar : rafraîchissement après connexion :", neuve.error.message);
            const email = pose.data.session.user.email || pose.data.session.user.id;
            perdue = null;
            reseau = null;
            await declarerAgent(true).catch((e) => console.error("viraldar : declarer_agent :", e.message));
            repondre(200, true, `Ton agent est connecté à viraldar (${email}). Tu peux fermer cet onglet.`);
            resoudre(email);
            fermer();
        }
        catch (e) {
            termine = false;
            repondre(400, false, "Requête illisible : " + e.message);
        }
    });
    const fermer = () => {
        ferme = true; // y compris pour une requête arrivée sur une connexion encore ouverte (keep-alive)
        if (attente?.serveur === serveur) {
            clearTimeout(attente.minuterie);
            attente = null;
        }
        serveur.close();
    };
    await new Promise((ok, ko) => { serveur.once("error", ko); serveur.listen(0, "127.0.0.1", () => ok()); });
    port = serveur.address().port;
    const minuterie = setTimeout(() => { rejeter(new Error("délai dépassé")); fermer(); }, VIE_SERVEUR_MS);
    minuterie.unref();
    const url = `${SITE}/agent#port=${port}&state=${state}`;
    attente = { url, state, fin, serveur, minuterie, ouvert: false };
    return attente;
}
// ---------- les outils ----------
const texte = (t) => ({ content: [{ type: "text", text: t }] });
const erreur = (t) => ({ content: [{ type: "text", text: t }], isError: true });
export const outilsAuth = (serveur) => {
    serveur.registerTool("connexion", {
        title: "Se connecter à viraldar",
        // En deux temps (0.2.2) : le lien d'abord, tout de suite, puis l'attente. Avant, l'outil attendait 2 minutes avant
        // de rendre le lien, ouvert par xdg-open dans le navigateur par défaut, qui n'est pas toujours celui où
        // l'utilisateur est connecté. Un seul appel ne peut pas rendre un texte puis continuer : le protocole MCP rend un
        // résultat par appel (les notifications de progression ne sont pas montrées partout).
        description: "Connecte ce MCP au compte viraldar de l'utilisateur, en deux temps. 1) `connexion` rend tout de suite "
            + "un lien viraldar.rayvol.net/agent (valable 10 minutes) et essaie de l'ouvrir dans le navigateur par défaut : "
            + "montre ce lien à l'utilisateur, il peut l'ouvrir dans le navigateur où il est connecté à viraldar, puis il "
            + "autorise l'agent (Google, ou e-mail + mot de passe). 2) Appelle aussitôt `connexion` avec `attendre: true` : "
            + "l'outil attend jusqu'à 1 minute que la session arrive (rappelle-le tant que l'utilisateur n'a pas fini). "
            + "À appeler quand un autre outil répond « pas connecté » ou « session finie » (pas pour « injoignable » : "
            + "c'est le réseau, la session est gardée). Ne demande jamais son mot de passe à l'utilisateur.",
        inputSchema: {
            attendre: z.boolean().optional().describe("Attendre (1 min au plus) l'autorisation, avec le lien déjà donné."),
            forcer: z.boolean().optional().describe("Reconnecter même si une session existe déjà (changer de compte)."),
        },
    }, async ({ attendre, forcer }) => {
        const s = await sessionCourante();
        if (s && !forcer && !attente)
            return texte(`Déjà connecté : ${s.user.email || s.user.id}. (forcer: true pour changer de compte.)\n${etatLecture()}`);
        // Une session gardée que le réseau empêche de renouveler n'est pas perdue : pas de nouveau lien pour si peu.
        if (!s && !forcer && !attente && reseau && stockee())
            return erreur(msgReseau(reseau));
        // Attendre sans lien en cours n'aurait aucun sens : on donne alors d'abord le lien.
        if (!attente)
            attendre = false;
        let a;
        try {
            a = await demarrerAttente();
        }
        catch (e) {
            return erreur("Impossible d'ouvrir le serveur local : " + e.message);
        }
        const lien = `Lien d'autorisation (valable 10 minutes, une seule fois) :\n${a.url}\n`;
        if (!attendre) {
            const premier = !a.ouvert;
            if (premier) {
                a.ouvert = true;
                ouvrirNavigateur(a.url);
            }
            return texte(lien + (premier ? "J'ai essayé de l'ouvrir dans le navigateur par défaut. " : "")
                + "Montre ce lien à l'utilisateur : il peut l'ouvrir dans le navigateur où il est connecté à viraldar, puis "
                + "autoriser l'agent. Appelle ensuite `connexion` avec `attendre: true`.");
        }
        const delai = new Promise(ok => setTimeout(() => ok(null), ATTENTE_OUTIL_MS).unref());
        try {
            const email = await Promise.race([a.fin, delai]);
            if (email)
                return texte(`Connecté à viraldar : ${email}.\n${etatLecture()}`);
            return texte(`Toujours en attente de l'autorisation. ${lien}`
                + "Rappelle `connexion` avec `attendre: true` quand l'utilisateur dit avoir autorisé (ou `qui_suis_je`).");
        }
        catch (e) {
            return erreur(`La connexion n'a pas abouti (${e.message}) : rappelle \`connexion\` pour un nouveau lien.`);
        }
    });
    serveur.registerTool("deconnexion", {
        title: "Se déconnecter de viraldar",
        description: "Déconnecte ce MCP : ferme sa session chez viraldar (pas celle du navigateur ; elle apparaît alors "
            + "inactive dans viraldar → Agentique) et efface ~/.config/viraldar/session.json.",
        inputSchema: {},
    }, async () => {
        const s = await sessionCourante();
        // signOut « local » : Supabase supprime cette session-ci (et ses refresh tokens), les autres restent ouvertes.
        if (s) {
            const { error } = await client.auth.signOut({ scope: "local" });
            if (error)
                console.error("viraldar : déconnexion :", error.message);
        }
        rmSync(FICHIER_SESSION, { force: true });
        declaree = null;
        return texte(s ? `Déconnecté (${s.user.email || s.user.id}).` : "Aucune session : rien à faire.");
    });
    serveur.registerTool("qui_suis_je", {
        title: "Compte viraldar connecté",
        description: "Dit si ce MCP est connecté à viraldar, avec quel compte (e-mail, identifiant), et sur quel produit "
            + "il travaille (le produit actif). Ne coûte rien sur le quota.",
        inputSchema: {},
    }, async () => {
        const s = await sessionCourante();
        if (!s)
            return texte(attente ? `Pas encore connecté : la page d'autorisation attend toujours (${attente.url}).`
                : messageSansSession());
        const u = s.user, m = u.user_metadata || {};
        let produit = null;
        try {
            const P = await lireProduits();
            if (P)
                produit = `Produit actif : ${P.actif.nom}` + (P.liste.length > 1
                    ? ` (${P.liste.length} produits : ${P.liste.map(p => p.nom).join(", ")} ; \`choisir_produit\` pour changer)` : "");
        }
        catch (e) {
            produit = `Produit actif : inconnu (${e.message})`;
        }
        return texte([`Connecté : ${u.email || "(sans e-mail)"}`, `id : ${u.id}`, produit,
            m.tiktok_username ? `TikTok : @${m.tiktok_username}` : null,
            `session gardée dans ${FICHIER_SESSION} (renouvelée seule ; elle ne prend fin que révoquée dans viraldar → Agentique, `
                + "ou par `deconnexion`)", etatLecture()].filter(Boolean).join("\n"));
    });
};
