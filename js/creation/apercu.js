// Le navigateur (Chromium headless via playwright-core) et la planche contact avec les zones sûres tracées.
// Utilitaire partagé par les outils de création (carrousel_apercu, la planche de contrôle de montage_texte), comme
// zones.ts : ce n'est pas un module d'outils.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { dimensionsImage, zonePour } from "./zones.js";
import { typeImage } from "../chemins.js";
function echapper(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function candidatsNavigateur() {
    const c = [process.env.VIRALDAR_CHROMIUM, process.env.CHROME_PATH, process.env.PUPPETEER_EXECUTABLE_PATH];
    const p = process.platform;
    if (p === "win32") {
        const racines = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA];
        for (const r of racines)
            if (r)
                c.push(join(r, "Google", "Chrome", "Application", "chrome.exe"), join(r, "Microsoft", "Edge", "Application", "msedge.exe"), join(r, "Chromium", "Application", "chrome.exe"), join(r, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"));
    }
    else {
        if (p === "darwin") {
            for (const base of ["/Applications", join(homedir(), "Applications")])
                c.push(`${base}/Google Chrome.app/Contents/MacOS/Google Chrome`, `${base}/Chromium.app/Contents/MacOS/Chromium`, `${base}/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`, `${base}/Brave Browser.app/Contents/MacOS/Brave Browser`);
        }
        const noms = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "microsoft-edge", "microsoft-edge-stable", "brave-browser", "brave"];
        for (const dossier of (process.env.PATH ?? "").split(delimiter).filter(Boolean))
            for (const nom of noms)
                c.push(join(dossier, nom));
        c.push("/snap/bin/chromium");
    }
    return c.filter((x) => !!x);
}
const AIDE_NAVIGATEUR = "Aucun Chrome, Chromium ou Edge trouvé pour rendre les images. Installe Google Chrome (https://www.google.com/chrome/), " +
    "ou lance `npx playwright install chromium`, puis relance. Si ton navigateur est ailleurs, donne son chemin dans " +
    "la variable d'environnement VIRALDAR_CHROMIUM (dans la config MCP de ton client : \"env\": {\"VIRALDAR_CHROMIUM\": \"/chemin/vers/chrome\"}).";
export async function lancerNavigateur() {
    const { chromium } = await import("playwright-core");
    const candidats = candidatsNavigateur();
    try {
        candidats.push(chromium.executablePath());
    }
    catch { /* pas de Chromium de Playwright */ }
    const chemin = candidats.find((x) => existsSync(x));
    if (!chemin)
        throw new Error(AIDE_NAVIGATEUR);
    try {
        return await chromium.launch({ executablePath: chemin, headless: true, args: ["--hide-scrollbars", "--font-render-hinting=none"] });
    }
    catch (e) {
        throw new Error(`Le navigateur ${chemin} n'a pas démarré (${e.message.split("\n")[0]}). ${AIDE_NAVIGATEUR}`);
    }
}
export async function nouvellePage(nav, l, h) {
    const page = await nav.newPage({ viewport: { width: l, height: h }, deviceScaleFactor: 1, javaScriptEnabled: true });
    // Aucune requête réseau : tout est déjà dans la page.
    await page.route("**/*", (r) => (r.request().url().startsWith("data:") ? r.continue() : r.abort()));
    return page;
}
/** Planche contact. Avec un cas de zone, chaque vignette porte en rouge ce que l'interface de TikTok recouvre
 *  (hors de la zone sûre, et les parties à éviter), reporté à la taille réelle de l'image : une image 3:4 ou une
 *  image tirée d'une vidéo s'y lisent comme sur le téléphone. */
export async function planche(chemins, cas, sortie) {
    const largeur = 300;
    const colonnes = Math.min(chemins.length, chemins.length <= 4 ? 4 : chemins.length <= 6 ? 3 : 5);
    const pc = (n, total) => `${((n / total) * 100).toFixed(3)}%`;
    const vignettes = await Promise.all(chemins.map(async (p, i) => {
        const octets = await readFile(p);
        const b64 = octets.toString("base64");
        const mime = typeImage(octets.subarray(0, 16)) ?? "image/png";
        const dim = dimensionsImage(octets);
        let zones = "";
        if (cas && dim) {
            const z = zonePour(dim.l, dim.h, cas), { l, h } = dim, q = z.zone;
            const bande = (x0, y0, x1, y1, cls = "") => (x1 - x0 < 0.5 || y1 - y0 < 0.5 ? "" :
                `<i class="${cls}" style="left:${pc(x0, l)};top:${pc(y0, h)};width:${pc(x1 - x0, l)};height:${pc(y1 - y0, h)}"></i>`);
            zones = bande(0, 0, l, q.y0) + bande(0, q.y1, l, h) + bande(0, q.y0, q.x0, q.y1) + bande(q.x1, q.y0, l, q.y1) +
                z.eviter.map((e) => bande(Math.max(e.x0, q.x0), Math.max(e.y0, q.y0), Math.min(e.x1, q.x1), Math.min(e.y1, q.y1), "e")).join("") +
                `<b style="left:${pc(q.x0, l)};top:${pc(q.y0, h)};width:${pc(q.x1 - q.x0, l)};height:${pc(q.y1 - q.y0, h)}"></b>`;
        }
        const ratio = dim ? `${dim.l}/${dim.h}` : "auto";
        return `<figure><div class="v" style="aspect-ratio:${ratio}"><img src="data:${mime};base64,${b64}">${zones}</div><figcaption>${i + 1}${dim ? ` · ${dim.l}×${dim.h}` : ""}</figcaption></figure>`;
    }));
    const titre = cas ? `<header>Zone sûre « ${echapper(cas)} » : en rouge, ce que TikTok recouvre ; le cadre vert est la zone du texte.</header>` : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>
    *{margin:0;padding:0;box-sizing:border-box} body{background:#2b2b30;padding:24px;width:max-content;font:600 20px/1 sans-serif;color:#ddd}
    header{font:500 17px/1.3 sans-serif;margin-bottom:16px;max-width:${colonnes * (largeur + 20)}px}
    main{display:grid;grid-template-columns:repeat(${colonnes},${largeur}px);gap:20px;align-items:start}
    figure{display:flex;flex-direction:column;gap:8px;align-items:center} .v{position:relative;width:${largeur}px;overflow:hidden;border-radius:6px}
    img{display:block;width:100%;height:100%;object-fit:cover}
    i{position:absolute;background:repeating-linear-gradient(135deg,rgba(255,20,60,.62) 0 5px,rgba(255,20,60,.22) 5px 11px)}
    i.e{outline:2px dashed rgba(255,235,240,.95);outline-offset:-2px}
    b{position:absolute;border:2px solid rgba(60,230,120,.95)} figcaption{font-size:16px}
    </style></head><body>${titre}<main>${vignettes.join("")}</main></body></html>`;
    const nav = await lancerNavigateur();
    try {
        const page = await nouvellePage(nav, 400, 300);
        await page.setContent(html, { waitUntil: "load" });
        const taille = await page.evaluate(() => ({ l: document.body.scrollWidth, h: document.body.scrollHeight }));
        await page.setViewportSize({ width: Math.ceil(taille.l), height: Math.ceil(taille.h) });
        const octets = await page.screenshot({ path: sortie, type: "jpeg", quality: 82, fullPage: true });
        return octets.toString("base64");
    }
    finally {
        await nav.close();
    }
}
