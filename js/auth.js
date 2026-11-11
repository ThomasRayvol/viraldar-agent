// La connexion du MCP à viraldar : une session Supabase à part, gardée dans ~/.config/viraldar/session.json (600).
//
// Le parcours (10/11/2026). La connexion par e-mail est gardée par Turnstile, qu'un MCP ne peut pas passer : c'est
// donc le navigateur qui se connecte, sur la page du site /agent (site/agent.html, site/js/agent.js), et qui rend la
// session au MCP.
//   1. `connexion` ouvre un petit serveur sur 127.0.0.1 (port libre) et tire un `state` aléatoire, puis ouvre
//      https://viraldar.rayvol.net/agent#port=…&state=… (le fragment ne part jamais au serveur du site).
//   2. La page se connecte avec un client Supabase À PART (sessionStorage, autre clé que la page principale) :
//      e-mail + mot de passe + Turnstile, ou Google (PKCE, retour sur /agent). C'est une NOUVELLE session, distincte
//      de celle du navigateur : partager celle du navigateur casserait la rotation des refresh tokens (le premier qui
//      rafraîchit révoquerait l'autre, et Supabase ferme toute la session quand un jeton révoqué revient).
//   3. La page POSTe {state, access_token, refresh_token} à http://127.0.0.1:<port>/session (fetch en text/plain,
//      sans preflight ; à défaut, un formulaire POST en navigation). Jamais de jeton dans une URL.
//   4. Le MCP vérifie l'origine, l'hôte et le state, pose la session, la rafraîchit aussitôt (les jetons passés par
//      le navigateur ne servent plus), l'écrit en 600 et ferme le serveur.
// Ensuite supabase-js rafraîchit la session à la demande ; le fichier est relu à chaque fois, si bien que deux MCP
// (Claude Desktop et Claude Code) qui partagent le fichier voient chacun le dernier jeton.
import { createClient } from "@supabase/supabase-js";
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
// ---------- configuration : publique par nature, surchargeable ----------
// Mêmes noms que la configuration du site (la clé « publishable » est la clé anon, protégée par la RLS).
const SUPABASE_URL = process.env.VIRALDAR_SUPABASE_URL || "https://iarcyvzipvvopcebqpnr.supabase.co";
const SUPABASE_CLE = process.env.VIRALDAR_SUPABASE_ANON_KEY || "sb_publishable_mxq_VfEolNBDqX04B2KthQ_Yc9Q8khj";
const SITE = (process.env.VIRALDAR_SITE_URL || "https://viraldar.rayvol.net").replace(/\/+$/, "");
const FICHIER_SESSION = process.env.VIRALDAR_SESSION
    || join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "viraldar", "session.json");
const DOSSIER_TRAVAIL = process.env.VIRALDAR_DOSSIER || join(homedir(), "viraldar");
const ATTENTE_OUTIL_MS = 120_000; // ce que l'outil `connexion` attend avant de rendre la main
const VIE_SERVEUR_MS = 10 * 60_000; // ce que le serveur local attend la page, au plus
// ---------- la session sur disque (600), relue à chaque lecture ----------
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
    const tmp = `${FICHIER_SESSION}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(contenu), { mode: 0o600 });
    try {
        chmodSync(tmp, 0o600);
    }
    catch { /* Windows */ }
    renameSync(tmp, FICHIER_SESSION);
}
const stockage = {
    getItem: (k) => lireFichier()[k] ?? null,
    setItem: (k, v) => { const c = lireFichier(); c[k] = v; ecrireFichier(c); },
    removeItem: (k) => { const c = lireFichier(); delete c[k]; ecrireFichier(c); },
};
const client = createClient(SUPABASE_URL, SUPABASE_CLE, {
    auth: {
        storage: stockage, storageKey: "viraldar-mcp", persistSession: true,
        // Pas de minuterie : la session se rafraîchit à la demande (getSession, avant chaque requête), en relisant le fichier.
        autoRefreshToken: false, detectSessionInUrl: false,
    },
});
async function sessionCourante() {
    const { data, error } = await client.auth.getSession();
    if (error)
        console.error("viraldar : session illisible :", error.message);
    return data.session;
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
export async function creerContexte() {
    resserrerDroits();
    return {
        supabase: async () => (await sessionCourante()) ? client : null,
        supabaseUrl: SUPABASE_URL,
        dossierTravail: DOSSIER_TRAVAIL,
    };
}
let attente = null;
const ORIGINES = new Set([SITE, ...(process.env.VIRALDAR_ORIGINES_AGENT || "").split(",").map(s => s.trim()).filter(Boolean)]);
const memeState = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
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
    let port = 0;
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
        if (!origine || !ORIGINES.has(origine))
            return cors(403, '{"erreur":"origine refusée"}');
        const formulaire = (req.headers["content-type"] || "").startsWith("application/x-www-form-urlencoded");
        const repondre = (code, ok, message) => formulaire
            ? cors(code, page(ok ? "Agent connecté" : "Connexion refusée", message), "text/html; charset=utf-8")
            : cors(code, JSON.stringify(ok ? { ok, message } : { erreur: message }));
        try {
            const brut = await lireCorps(req);
            const d = formulaire ? Object.fromEntries(new URLSearchParams(brut)) : JSON.parse(brut);
            if (typeof d.state !== "string" || !memeState(d.state, state))
                return repondre(403, false, "Ce lien n'est plus valable : relance la connexion depuis ton agent.");
            if (typeof d.access_token !== "string" || typeof d.refresh_token !== "string")
                return repondre(400, false, "Session incomplète.");
            const pose = await client.auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token });
            if (pose.error || !pose.data.session)
                return repondre(401, false, "Session refusée par viraldar : " + (pose.error?.message || "inconnue"));
            // Une paire neuve, que le navigateur n'a jamais vue.
            const neuve = await client.auth.refreshSession();
            if (neuve.error)
                console.error("viraldar : rafraîchissement après connexion :", neuve.error.message);
            const email = pose.data.session.user.email || pose.data.session.user.id;
            repondre(200, true, `Ton agent est connecté à viraldar (${email}). Tu peux fermer cet onglet.`);
            resoudre(email);
            fermer();
        }
        catch (e) {
            repondre(400, false, "Requête illisible : " + e.message);
        }
    });
    const fermer = () => {
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
    attente = { url, state, fin, serveur, minuterie };
    return attente;
}
// ---------- les outils ----------
const texte = (t) => ({ content: [{ type: "text", text: t }] });
const erreur = (t) => ({ content: [{ type: "text", text: t }], isError: true });
export const outilsAuth = (serveur) => {
    serveur.registerTool("connexion", {
        title: "Se connecter à viraldar",
        description: "Connecte ce MCP au compte viraldar de l'utilisateur. Ouvre une page de viraldar.rayvol.net dans son "
            + "navigateur, où il se connecte (Google, ou e-mail + mot de passe) pour autoriser l'agent ; la page rend la session "
            + "au MCP par 127.0.0.1. L'outil attend jusqu'à 2 minutes ; s'il rend la main avant, l'utilisateur peut finir "
            + "dans le navigateur (le lien reste valable 10 minutes) puis tu rappelles `connexion` ou `qui_suis_je`. "
            + "À appeler quand un autre outil répond « pas connecté ». Ne demande jamais son mot de passe à l'utilisateur.",
        inputSchema: { forcer: z.boolean().optional().describe("Reconnecter même si une session existe déjà (changer de compte).") },
    }, async ({ forcer }) => {
        const s = await sessionCourante();
        if (s && !forcer)
            return texte(`Déjà connecté : ${s.user.email || s.user.id}. (forcer: true pour changer de compte.)`);
        let a;
        try {
            a = await demarrerAttente();
        }
        catch (e) {
            return erreur("Impossible d'ouvrir le serveur local : " + e.message);
        }
        ouvrirNavigateur(a.url);
        const delai = new Promise(ok => setTimeout(() => ok(null), ATTENTE_OUTIL_MS).unref());
        try {
            const email = await Promise.race([a.fin, delai]);
            if (email)
                return texte(`Connecté à viraldar : ${email}.`);
            return texte(`Toujours en attente. Si le navigateur ne s'est pas ouvert, donne ce lien à l'utilisateur :\n${a.url}\n`
                + "Une fois qu'il a autorisé l'agent, appelle `qui_suis_je` (ou `connexion` pour attendre encore).");
        }
        catch (e) {
            return erreur(`La connexion n'a pas abouti (${e.message}) : rappelle \`connexion\`.`);
        }
    });
    serveur.registerTool("deconnexion", {
        title: "Se déconnecter de viraldar",
        description: "Déconnecte ce MCP : révoque sa session chez viraldar (pas celle du navigateur) et efface "
            + "~/.config/viraldar/session.json.",
        inputSchema: {},
    }, async () => {
        const s = await sessionCourante();
        if (s) {
            const { error } = await client.auth.signOut({ scope: "local" });
            if (error)
                console.error("viraldar : déconnexion :", error.message);
        }
        rmSync(FICHIER_SESSION, { force: true });
        return texte(s ? `Déconnecté (${s.user.email || s.user.id}).` : "Aucune session : rien à faire.");
    });
    serveur.registerTool("qui_suis_je", {
        title: "Compte viraldar connecté",
        description: "Dit si ce MCP est connecté à viraldar, et avec quel compte (e-mail, identifiant). Ne coûte rien sur le quota.",
        inputSchema: {},
    }, async () => {
        const s = await sessionCourante();
        if (!s)
            return texte(attente ? `Pas encore connecté : la page d'autorisation attend toujours (${attente.url}).`
                : "Pas connecté : appelle l'outil `connexion`.");
        const u = s.user, m = u.user_metadata || {};
        return texte([`Connecté : ${u.email || "(sans e-mail)"}`, `id : ${u.id}`,
            m.tiktok_username ? `TikTok : @${m.tiktok_username}` : null,
            `session gardée dans ${FICHIER_SESSION}`].filter(Boolean).join("\n"));
    });
};
