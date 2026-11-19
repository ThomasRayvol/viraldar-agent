/// <reference types="node" />  // TypeScript 7 ne charge plus @types/node d'office (types: [] par défaut).
// Chantier « montage » : les outils exécutent, les choix créatifs viennent de l'agent de l'utilisateur.
//
//   ffmpeg (obligatoire pour ces outils, détecté au premier appel ; s'il manque, on dit comment l'installer) :
//     montage_infos           durée, taille, fps, son d'un média, et ce qui l'écarte du format TikTok
//     montage_format_tiktok   au format voulu (9:16 1080×1920 par défaut ; 3:4, 4:5, 1:1, 4:3, 16:9, 2.35:1), recadrage,
//                             fond flouté ou bandes, H.264/AAC
//     montage_decouper        un passage d'une vidéo
//     montage_assembler       plusieurs plans (vidéos ou images) bout à bout : durée exacte par plan (s ou images),
//                             coupe franche par défaut, fondus, mouvement sur les images fixes (Ken Burns), musique ou
//                             voix (le dernier plan peut s'allonger jusqu'à la fin de la piste)
//     montage_diaporama       une vidéo à partir d'images (les PNG d'un carrousel), musique en option
//     montage_texte           accroche(s) dans la zone sûre du cas choisi et sous-titres (SRT ou segments), via libass ;
//                             temps de lecture contrôlé, planche de contrôle (zones tracées) si un Chromium est là
//     montage_couverture      une image de couverture tirée de la vidéo
//   Remotion (seulement si l'utilisateur l'a : ni licence ni installation fournies) :
//     remotion_detecter       trouve son projet, sinon dit à l'agent de lui demander
//     remotion_modeles        copie nos compositions types (mcp/modeles/montage/remotion/) dans son projet
//     remotion_rendre         `remotion render` dans son projet, avec des props JSON
//
//   creation/analyse.ts (même famille) : modele_decortiquer, montage_comparaison.
//
// Formats (12/11/2026) : 9:16 par défaut, et ceux de modeles/zones-sures.json (3:4, 4:5, 1:1, 4:3, 16:9, 2.35:1) ; on
// ne remet plus tout en 9:16 : un modèle en paysage se refait en paysage (paramètre `format`).
// Pixels : toujours yuv420p en plage « tv » (limitée). Une image JPEG arrive en yuvj420p (plage pleine) et le
// format=yuv420p seul garde l'étiquette de plage pleine (ffprobe dit alors yuvj420p) : d'où PIXELS en fin de chaîne.
// Tout ce qui sort va dans `<dossierTravail>/montages/`, sans métadonnées (`-map_metadata -1`, bitexact).
// ffmpeg est toujours appelé sans shell (arguments en tableau) : les espaces dans les chemins passent.
// Les filtres qui lisent un fichier (ass) le lisent dans un dossier temporaire au nom sûr, ffmpeg y étant
// lancé (cwd) : aucun chemin de l'utilisateur n'est jamais échappé dans une chaîne de filtre.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, delimiter, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { sousRacine } from "../racine.js";
import { EXT_MEDIAS, cheminLu, dossierLu, sous } from "../chemins.js";
import { FORMAT_DEFAUT, NOMS_CAS, NOMS_FORMATS, ZONES, descriptionCas, formatProche, tailleVideo, zCas, zFormat, zonePour } from "./zones.js";
// ---------------------------------------------------------------------------------------------
// Le format TikTok (relevé le 10/11/2026) : 9:16, 1080×1920, H.264 + AAC en MP4, 30 i/s recommandé (23 à 60
// acceptés). Les zones sûres viennent de modeles/zones-sures.json (relevés sur de vrais téléphones, par cas : avec
// ou sans description, pub), la même source que les carrousels.
const LARGEUR = 1080;
const FPS_DEFAUT = 30;
/** Fin de chaîne de filtres avant l'encodeur : plage limitée (tv) et yuv420p, quelle que soit la source. */
export const PIXELS = "scale=out_range=tv,format=yuv420p";
/** Marges de la zone sûre d'un cas, en px du repère du texte (1080 de large, hauteur h) : recherche en haut,
 *  description/pseudo/barre en bas, colonne des boutons à droite, avatars « aimé par » (ou colonne de la pub) retranchés. */
const margesVideo = (cas = ZONES.defaut, h = 1920) => zonePour(LARGEUR, h, cas).marges;
/** Règle de lecture (relevée en production, oct. 2026) : un texte posé reste au moins 0,25 s par mot, et 2,5 s. */
const LECTURE = { parMot: 0.25, minimum: 2.5 };
export const EXTENSIONS_IMAGE = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"]);
export const ok = (texte) => ({ content: [{ type: "text", text: texte }] });
export const echec = (texte) => ({ content: [{ type: "text", text: texte }], isError: true });
export class ErreurMontage extends Error {
}
/** Lance un programme sans shell. Rend stdout ; en cas d'échec, une erreur lisible (fin de stderr). */
export function executer(prog, args, options = {}) {
    return new Promise((ok, ko) => {
        const p = spawn(prog, args, { cwd: options.cwd, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
        let stdout = "";
        let stderr = "";
        p.stdout.on("data", (d) => (stdout += d));
        p.stderr.on("data", (d) => {
            stderr += d;
            if (stderr.length > 200_000)
                stderr = stderr.slice(-100_000);
        });
        const minuteur = options.delaiMs
            ? setTimeout(() => {
                p.kill("SIGKILL");
                ko(new ErreurMontage(`${options.nom ?? prog} a dépassé ${Math.round(options.delaiMs / 1000)} s, arrêté.`));
            }, options.delaiMs)
            : undefined;
        p.on("error", (e) => {
            clearTimeout(minuteur);
            ko(e);
        });
        p.on("close", (code) => {
            clearTimeout(minuteur);
            if (code === 0)
                return ok({ stdout, stderr });
            const lignes = stderr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            const utiles = lignes.filter((l) => /error|invalid|no such|not found|unable|cannot|failed|unknown|matches no/i.test(l));
            const extrait = (utiles.length ? utiles : lignes).slice(-8).join("\n");
            const commande = [basename(prog), ...args].map((a) => (/[\s"'()[\];]/.test(a) ? JSON.stringify(a) : a)).join(" ");
            ko(new ErreurMontage(`${options.nom ?? basename(prog)} a échoué (code ${code}) :\n${extrait || "(aucun message)"}\n\nCommande : ${commande}`));
        });
    });
}
export function installationFfmpeg() {
    switch (process.platform) {
        case "darwin":
            return "macOS : `brew install ffmpeg` (Homebrew, https://brew.sh). La formule inclut libass (textes et sous-titres).";
        case "win32":
            return "Windows : `winget install Gyan.FFmpeg` (version « full », avec libass), puis rouvrir l'application pour que le PATH soit relu. Sinon, télécharger une version « full » sur https://www.gyan.dev/ffmpeg/builds/ et donner le chemin de ffmpeg.exe dans la variable VIRALDAR_FFMPEG.";
        default:
            return "Linux : `sudo apt install ffmpeg` (Debian, Ubuntu), `sudo dnf install ffmpeg` (Fedora, dépôt RPM Fusion), `sudo pacman -S ffmpeg` (Arch). ffprobe est livré avec.";
    }
}
let ffmpegTrouve = null;
/** Trouve ffmpeg et ffprobe : VIRALDAR_FFMPEG (chemin de ffmpeg), sinon le PATH. Gardé une fois trouvé. */
export function trouverFfmpeg() {
    ffmpegTrouve ??= (async () => {
        const exe = process.platform === "win32" ? ".exe" : "";
        const imposé = process.env.VIRALDAR_FFMPEG;
        const candidats = imposé
            ? [imposé]
            : [
                ...(process.env.PATH ?? "").split(delimiter).filter(Boolean).map((d) => join(d, `ffmpeg${exe}`)),
                "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg",
            ];
        const ffmpeg = candidats.find((c) => existsSync(c));
        if (!ffmpeg) {
            ffmpegTrouve = null; // on réessaiera après installation
            throw new ErreurMontage(`ffmpeg est introuvable${imposé ? ` (VIRALDAR_FFMPEG=${imposé})` : " dans le PATH"}. Les outils de montage en ont besoin.\n` +
                `Pour l'installer — ${installationFfmpeg()}\nDis-le à l'utilisateur, puis réessaie une fois installé.`);
        }
        const ffprobe = join(dirname(ffmpeg), `ffprobe${extname(ffmpeg)}`);
        if (!existsSync(ffprobe)) {
            ffmpegTrouve = null;
            throw new ErreurMontage(`ffmpeg est là (${ffmpeg}) mais pas ffprobe à côté. ${installationFfmpeg()}`);
        }
        const { stdout } = await executer(ffmpeg, ["-hide_banner", "-version"]);
        const filtres = (await executer(ffmpeg, ["-hide_banner", "-filters"])).stdout;
        return {
            ffmpeg, ffprobe,
            version: stdout.split("\n")[0]?.replace(/^ffmpeg version\s*/, "").split(" ")[0] ?? "?",
            libass: /^\s*\S+\s+ass\s/m.test(filtres),
        };
    })();
    return ffmpegTrouve;
}
/** Le dossier de travail (posé par outilsMontage) : base des chemins relatifs, toujours lisible. */
let dossierTravail = join(homedir(), "viraldar");
export const reglerDossierTravail = (d) => { dossierTravail = d; };
/** Chemin réel d'un média donné par l'agent (~ accepté), contrôlé par chemins.ts : un média seulement (extension),
 *  jamais dans un dossier caché, dans le dossier de travail (ou sous VIRALDAR_LECTURE, si l'utilisateur l'a élargie). */
export async function entree(chemin, extensions = EXT_MEDIAS, quoi = "Média") {
    try {
        return await cheminLu(chemin, { travail: dossierTravail, extensions, quoi });
    }
    catch (e) {
        throw new ErreurMontage(e.message);
    }
}
// Ce qui part dans une chaîne de filtres ffmpeg ou un fichier ASS : jamais de texte libre (injection de filtres :
// `movie=`, `drawtext=textfile=` liraient n'importe quel fichier et l'incrusteraient dans la vidéo).
const zCouleurBandes = z.string().regex(/^(#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?|[a-zA-Z]{3,20})$/, "#RRGGBB ou un nom de couleur");
const zTransition = z.string().regex(/^[a-z]{2,20}$/, "un nom de transition xfade (lettres seulement)");
const zPolice = z.string().regex(/^[^,\r\n{}\\]{1,60}$/, "un nom de famille de police");
/** Un nom de sortie libre dans <dossierTravail>/montages/ : <nom>-<date-heure>.<ext>. */
export async function sortie(ctx, nom, defaut, ext) {
    const dossier = join(ctx.dossierTravail, "montages");
    await mkdir(dossier, { recursive: true });
    const propre = (nom ?? defaut)
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/\.[a-z0-9]{2,4}$/i, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || defaut;
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const horodatage = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    let chemin = join(dossier, `${propre}-${horodatage}.${ext}`);
    for (let i = 2; existsSync(chemin); i++)
        chemin = join(dossier, `${propre}-${horodatage}-${i}.${ext}`);
    return chemin;
}
export async function sonder(fichier) {
    const { ffprobe } = await trouverFfmpeg();
    const { stdout } = await executer(ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", fichier], { nom: "ffprobe" });
    const j = JSON.parse(stdout);
    const v = j.streams?.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
    const a = j.streams?.find((s) => s.codec_type === "audio");
    const fraction = (f) => {
        const [n, d] = (f ?? "0/1").split("/").map(Number);
        return d ? n / d : 0;
    };
    const sonde = {
        duree: Number(j.format?.duration ?? v?.duration ?? 0) || 0,
        conteneur: String(j.format?.format_name ?? "?"),
        octets: Number(j.format?.size ?? 0),
    };
    if (v) {
        const rotation = Number(v.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0);
        const tourne = Math.abs(rotation) % 180 === 90; // ffmpeg applique la rotation : on rend la taille affichée
        sonde.video = {
            codec: v.codec_name, pixfmt: v.pix_fmt, rotation,
            largeur: tourne ? v.height : v.width,
            hauteur: tourne ? v.width : v.height,
            fps: Math.round(fraction(v.avg_frame_rate || v.r_frame_rate) * 100) / 100,
            debitKbps: v.bit_rate ? Math.round(v.bit_rate / 1000) : undefined,
        };
    }
    if (a) {
        sonde.audio = {
            codec: a.codec_name, frequence: Number(a.sample_rate), canaux: a.channels,
            debitKbps: a.bit_rate ? Math.round(a.bit_rate / 1000) : undefined,
        };
    }
    return sonde;
}
export const s2 = (n) => `${Math.round(n * 100) / 100} s`;
export function resume(chemin, s) {
    const lignes = [`Fichier : ${chemin}`, `Durée : ${s.duree ? s2(s.duree) : "image fixe"} · ${(s.octets / 1e6).toFixed(2)} Mo · ${s.conteneur}`];
    if (s.video) {
        const v = s.video;
        lignes.push(`Vidéo : ${v.largeur}×${v.hauteur} (${ratio(v.largeur, v.hauteur)}), ${v.fps} i/s, ${v.codec}/${v.pixfmt}${v.debitKbps ? `, ${v.debitKbps} kb/s` : ""}${v.rotation ? `, rotation ${v.rotation}°` : ""}`);
    }
    else
        lignes.push("Vidéo : aucune");
    lignes.push(s.audio ? `Son : ${s.audio.codec}, ${s.audio.frequence} Hz, ${s.audio.canaux} canal(aux)${s.audio.debitKbps ? `, ${s.audio.debitKbps} kb/s` : ""}` : "Son : aucun");
    return lignes.join("\n");
}
export function ratio(l, h) {
    const r = l / h;
    const proche = formatProche(l, h);
    if (proche)
        return proche;
    const connus = [["9:16", 9 / 16], ["16:9", 16 / 9], ["1:1", 1], ["4:5", 4 / 5], ["3:4", 3 / 4], ["4:3", 4 / 3]];
    const c = connus.find(([, x]) => Math.abs(x - r) / x < 0.02);
    return c ? c[0] : r.toFixed(3);
}
export const attenduPour = (format = FORMAT_DEFAUT) => ({ format, ...tailleVideo(format) });
/** Les écarts d'un média au format TikTok. `attendu` : la taille voulue (9:16 par défaut) ; null : taille non
 *  contrôlée (une composition Remotion de l'utilisateur, dont on ne sait pas la taille voulue). */
function ecartsTiktok(s, attendu = attenduPour()) {
    const e = [];
    if (!s.video)
        return ["pas de piste vidéo"];
    const v = s.video;
    if (attendu && (v.largeur !== attendu.l || v.hauteur !== attendu.h))
        e.push(`taille ${v.largeur}×${v.hauteur} au lieu de ${attendu.l}×${attendu.h} (${attendu.format})`);
    if (v.codec !== "h264")
        e.push(`codec vidéo ${v.codec} au lieu de h264`);
    if (v.pixfmt !== "yuv420p")
        e.push(`pixels ${v.pixfmt} au lieu de yuv420p`);
    if (v.fps && (v.fps < 23 || v.fps > 60))
        e.push(`${v.fps} i/s (TikTok : 23 à 60, 30 recommandé)`);
    if (!s.audio)
        e.push("pas de son (TikTok l'accepte, mais un son tendance aide la portée)");
    else if (s.audio.codec !== "aac")
        e.push(`son ${s.audio.codec} au lieu d'aac`);
    if (s.duree && s.duree < 3)
        e.push("moins de 3 s");
    if (s.duree > 600)
        e.push("plus de 10 min (limite des téléversements)");
    return e;
}
/** Une ligne d'information (pas un défaut) sur un format voulu autre que 9:16. */
function noteFormat(attendu) {
    if (!attendu || attendu.format === FORMAT_DEFAUT)
        return [];
    return [`Format ${attendu.format} voulu : TikTok l'affiche à la largeur de l'écran, avec des bandes en haut et en bas, comme le modèle.`];
}
// ---------------------------------------------------------------------------------------------
// Encodage commun
const QUALITES = { rapide: { preset: "veryfast", crf: "23" }, normale: { preset: "fast", crf: "20" }, haute: { preset: "slow", crf: "18" } };
/** H.264 High yuv420p (plage tv) + AAC 48 kHz stéréo, MP4 « faststart », sans métadonnées ni chapitres. */
export function argsEncodage(qualite = "normale", avecSon = true) {
    const q = QUALITES[qualite];
    return [
        "-c:v", "libx264", "-preset", q.preset, "-crf", q.crf, "-profile:v", "high", "-pix_fmt", "yuv420p", "-color_range", "tv",
        ...(avecSon ? ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"] : ["-an"]),
        "-movflags", "+faststart",
        "-map_metadata", "-1", "-map_chapters", "-1",
        "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact",
    ];
}
export async function ffmpeg(args, cwd) {
    const { ffmpeg } = await trouverFfmpeg();
    await executer(ffmpeg, ["-hide_banner", "-nostdin", "-loglevel", "error", "-y", ...args], { cwd, nom: "ffmpeg", delaiMs: 20 * 60_000 });
}
export async function rendu(chemin, titre, plus = [], attendu = attenduPour()) {
    const s = await sonder(chemin);
    const ecarts = ecartsTiktok(s, attendu);
    return ok([titre, resume(chemin, s), ...plus, ...noteFormat(attendu), ecarts.length ? `À noter : ${ecarts.join(" ; ")}.` : "Conforme au format TikTok."].join("\n"));
}
/** La chaîne de filtres qui met une image (de taille l×h) en W×H (le format voulu) selon le mode. */
function filtreFormat(mode, l, h, couleurBandes = "black", k = 0, W = LARGEUR, H = 1920) {
    if (mode === "auto")
        mode = Math.abs(l / h - W / H) / (W / H) < 0.12 ? "recadrer" : "flou";
    // Le fond flouté se calcule petit (un quart, arrondi au pair) : rapide.
    const w4 = 2 * Math.round(W / 8), h4 = 2 * Math.round(H / 8);
    switch (mode) {
        case "aucun":
            return "scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1";
        case "recadrer":
            return `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
        case "bandes":
            return `scale=${W}:${H}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${couleurBandes},setsar=1`;
        case "flou":
            // Le fond : la même image agrandie, floutée à petite taille (rapide), assombrie un peu.
            return `split=2[fond${k}][avant${k}];[fond${k}]scale=${w4}:${h4}:force_original_aspect_ratio=increase,crop=${w4}:${h4},boxblur=12:3,eq=brightness=-0.06,scale=${W}:${H}[fondf${k}];` +
                `[avant${k}]scale=${W}:${H}:force_original_aspect_ratio=decrease:force_divisible_by=2[avantf${k}];[fondf${k}][avantf${k}]overlay=(W-w)/2:(H-h)/2,setsar=1`;
    }
}
export const MOUVEMENTS = ["aucun", "zoom_avant", "zoom_arriere", "gauche", "droite", "haut", "bas"];
/** Le mouvement de caméra sur une image déjà au format W×H (Ken Burns), sur n images : zoompan sur l'image agrandie
 *  deux fois (moins de saccades à l'arrondi des positions). `amplitude` : 0,12 = 12 % de zoom ou de course. */
function filtreMouvement(m, n, W, H, fps, amplitude = 0.12) {
    if (m === "aucun" || n < 2)
        return "";
    const A = Math.min(0.5, Math.max(0.02, amplitude));
    const p = `(on/${n - 1})`;
    const cx = "iw/2-(iw/zoom/2)", cy = "ih/2-(ih/zoom/2)";
    const [z, x, y] = m === "zoom_avant" ? [`1+${A}*${p}`, cx, cy] :
        m === "zoom_arriere" ? [`${1 + A}-${A}*${p}`, cx, cy] :
            m === "droite" ? [`${1 + A}`, `(iw-iw/zoom)*${p}`, cy] :
                m === "gauche" ? [`${1 + A}`, `(iw-iw/zoom)*(1-${p})`, cy] :
                    m === "bas" ? [`${1 + A}`, cx, `(ih-ih/zoom)*${p}`] :
                        [`${1 + A}`, cx, `(ih-ih/zoom)*(1-${p})`];
    return `,scale=${W * 2}:${H * 2},zoompan=z='${z}':x='${x}':y='${y}':d=1:s=${W}x${H}:fps=${fps},setsar=1`;
}
/** Construit et lance un montage : chaque plan est découpé, mis au format, au même fps et au même son,
 *  puis enchaîné (concat ou xfade), avec une musique mixée par-dessus si demandée. Les durées sont arrondies à
 *  l'image près : une coupe tombe sur une image, sans dérive le long du montage. */
export async function monter(plans, o, chemin) {
    if (!plans.length)
        throw new ErreurMontage("Aucun plan à monter.");
    const args = [];
    const filtres = [];
    const remarques = [];
    const fps = o.fps ?? (o.mode === "aucun" ? undefined : FPS_DEFAUT);
    const { l: W, h: H } = tailleVideo(o.format ?? FORMAT_DEFAUT);
    /** Une durée arrondie à l'image (au moins une image). */
    const aImage = (d) => (fps ? Math.max(1, Math.round(d * fps)) / fps : Math.round(d * 1000) / 1000);
    let tailleCommune;
    // 1. Chaque plan : son fichier, sa nature, sa durée.
    const infos = [];
    for (const [k, p] of plans.entries()) {
        const fichier = await entree(p.fichier);
        const image = EXTENSIONS_IMAGE.has(extname(fichier).toLowerCase());
        const s = await sonder(fichier);
        if (!s.video)
            throw new ErreurMontage(`Plan ${k + 1} (${basename(fichier)}) : aucune image vidéo.`);
        if (p.images !== undefined && !fps)
            throw new ErreurMontage(`Plan ${k + 1} : une durée en images demande un fps (mode autre que « aucun »).`);
        const propre = p.images !== undefined ? p.images / fps : p.duree;
        let d, debut = 0;
        if (image) {
            d = propre ?? o.dureePlan ?? o.dureeImage ?? 3;
        }
        else {
            debut = Math.max(0, p.debut ?? 0);
            const voulue = propre ?? (p.fin === undefined ? o.dureePlan : undefined);
            const fin = Math.min(p.fin ?? (voulue !== undefined ? debut + voulue : s.duree), s.duree || Infinity);
            d = fin - debut;
            if (!(d > 0.03))
                throw new ErreurMontage(`Plan ${k + 1} (${basename(fichier)}) : passage vide (début ${debut} s, fin ${fin} s, durée du fichier ${s2(s.duree)}).`);
        }
        infos.push({ fichier, image, s, debut, d: aImage(d), p });
    }
    const durees = infos.map((i) => i.d);
    // 2. Les fondus (0 = coupe franche, le défaut).
    let f = plans.length > 1 ? o.fondu ?? 0 : 0;
    const plusCourt = Math.min(...durees);
    if (f > plusCourt / 2) {
        const ramene = Math.floor((plusCourt / 2) * 100) / 100;
        remarques.push(`Fondu ramené de ${f} s à ${s2(ramene)} (moitié du plan le plus court).`);
        f = ramene;
    }
    if (f > 0 && fps)
        f = Math.max(1, Math.round(f * fps)) / fps;
    const totalDe = (ds) => Math.round((ds.reduce((x, y) => x + y, 0) - (f > 0 ? f * (ds.length - 1) : 0)) * 1000) / 1000;
    let total = totalDe(durees);
    // 3. La piste (musique ou voix) : décide-t-elle de la durée du montage ?
    let piste;
    if (o.musique) {
        piste = await entree(o.musique.fichier);
        const sm = await sonder(piste);
        if (!sm.audio)
            throw new ErreurMontage(`La piste ${basename(piste)} n'a pas de son.`);
        const dispo = Math.max(0, (sm.duree || 0) - (o.musique.debut ?? 0));
        const pas = fps ? 1 / fps : 0.01;
        if (dispo > total + pas) {
            if (o.dureeSurMusique) {
                const plus = dispo - total;
                const dernier = durees.length - 1;
                durees[dernier] = fps ? Math.ceil((durees[dernier] + plus) * fps - 1e-6) / fps : durees[dernier] + plus;
                infos[dernier].d = durees[dernier];
                total = totalDe(durees);
                remarques.push(`Dernier plan allongé de ${s2(plus)} pour finir avec la piste (${s2(dispo)})${infos[dernier].image ? "" : " : sa dernière image est tenue"}.`);
            }
            else {
                remarques.push(`La piste (${s2(dispo)}) est plus longue que le montage (${s2(total)}${f > 0 ? ` ; les fondus en retirent ${s2(f * (plans.length - 1))}` : ""}) : `
                    + "elle est coupée à la fin. Pour une voix off, `dureeSurMusique: true` allonge le dernier plan jusqu'à la fin de la piste.");
            }
        }
        else if (dispo + pas < total) {
            remarques.push(`La piste (${s2(dispo)}) est plus courte que le montage (${s2(total)}) : silence à la fin.`);
        }
    }
    // 4. Les entrées et les filtres de chaque plan.
    let n = 0; // index des entrées ffmpeg
    for (const [k, { fichier, image, s, debut, d, p }] of infos.entries()) {
        if (image)
            args.push("-loop", "1", "-framerate", String(fps ?? FPS_DEFAUT), "-t", String(d), "-i", fichier);
        else
            args.push(...(debut > 0 ? ["-ss", String(debut)] : []), "-t", String(d), "-i", fichier);
        const iv = n++;
        let ia = iv;
        const volume = p.volume ?? 1;
        if (!s.audio || image || volume === 0) {
            args.push("-f", "lavfi", "-t", String(d), "-i", "anullsrc=r=48000:cl=stereo");
            ia = n++;
        }
        if (o.mode === "aucun") {
            const t = `${s.video.largeur}x${s.video.hauteur}`;
            if (tailleCommune && tailleCommune !== t && plans.length > 1)
                throw new ErreurMontage(`Les plans n'ont pas la même taille (${tailleCommune} et ${t}) : choisis un mode de mise au format (recadrer, flou, bandes).`);
            tailleCommune = t;
        }
        const fmt = filtreFormat(o.mode, s.video.largeur, s.video.hauteur, o.couleurBandes, k, W, H);
        const mouvement = p.mouvement ?? (image ? o.mouvement ?? "aucun" : "aucun");
        const mvt = fps && o.mode !== "aucun" ? filtreMouvement(mouvement, Math.round(d * fps), W, H, fps, o.amplitude) : "";
        // Une vidéo plus courte que son plan (dernier plan allongé) tient sa dernière image.
        const tenue = image ? 2 : Math.ceil(Math.max(0, d - Math.max(0, s.duree - debut))) + 2;
        filtres.push(`[${iv}:v]${fmt}${fps ? `,fps=${fps}` : ""}${mvt},${PIXELS},tpad=stop_mode=clone:stop_duration=${tenue},trim=duration=${d},setpts=PTS-STARTPTS,settb=AVTB[v${k}]`, `[${ia}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${ia === iv ? volume : 1},apad,atrim=duration=${d},asetpts=PTS-STARTPTS[a${k}]`);
    }
    // 5. Enchaînement
    let v = "v0", a = "a0";
    if (plans.length > 1) {
        if (f > 0) {
            let fin = durees[0];
            for (let k = 1; k < plans.length; k++) {
                const off = Math.round((fin - f) * 1000) / 1000;
                filtres.push(`[${v}][v${k}]xfade=transition=${o.transition ?? "fade"}:duration=${f}:offset=${off}[xv${k}]`, `[${a}][a${k}]acrossfade=d=${f}[xa${k}]`);
                v = `xv${k}`;
                a = `xa${k}`;
                fin += durees[k] - f;
            }
        }
        else {
            filtres.push(`${plans.map((_, k) => `[v${k}][a${k}]`).join("")}concat=n=${plans.length}:v=1:a=1[vc][ac]`);
            v = "vc";
            a = "ac";
        }
    }
    // 6. La piste, mixée sur tout le montage.
    if (o.musique && piste) {
        const m = o.musique;
        args.push(...(m.debut ? ["-ss", String(m.debut)] : []), "-i", piste);
        const im = n++;
        // Une voix qui décide de la durée finit d'elle-même : pas de fondu de sortie par défaut.
        const fs = Math.min(m.fonduSortie ?? (o.dureeSurMusique ? 0 : 1.5), total / 2);
        filtres.push(`[${im}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${m.volume ?? 1},apad,atrim=duration=${total},asetpts=PTS-STARTPTS${fs > 0 ? `,afade=t=out:st=${Math.round((total - fs) * 1000) / 1000}:d=${fs}` : ""}[mus]`, `[${a}][mus]amix=inputs=2:duration=first:normalize=0[am]`);
        a = "am";
    }
    await ffmpeg([...args, "-filter_complex", filtres.join(";"), "-map", `[${v}]`, "-map", `[${a}]`, "-t", String(total), ...argsEncodage(o.qualite), chemin]);
    return { duree: total, remarques, durees };
}
// Les polices du plugin (celles des carrousels, OFL, modeles/carrousel/polices/), données d'office à libass. Ce sont des
// polices variables : libass n'en rend que l'instance par défaut, dont la famille porte la graisse (« TikTok Sans
// Light », « Archivo SemiBold ») ; on accepte le nom court.
const DOSSIER_POLICES = fileURLToPath(sousRacine("modeles/carrousel/polices/"));
export const POLICES_FOURNIES = { "TikTok Sans": "TikTok Sans Light", Archivo: "Archivo SemiBold", Lora: "Lora", Caveat: "Caveat" };
const EXT_POLICES = new Set([".ttf", ".otf", ".ttc", ".woff", ".woff2"]);
/** Le nom de famille à donner à libass (nom court d'une police fournie → sa famille réelle). */
function nomPolice(p) {
    const court = p.trim().toLowerCase() === "tiktok" ? "tiktok sans" : p.trim().toLowerCase();
    const trouve = Object.entries(POLICES_FOURNIES).find(([k]) => k.toLowerCase() === court);
    return trouve ? trouve[1] : p.trim();
}
/** Remplit `cible` des polices du plugin et, si donné, de celles d'un dossier de l'utilisateur (contrôlé comme une
 *  lecture par chemins.ts : dossier de travail ou VIRALDAR_LECTURE, jamais un dossier caché). Seuls des fichiers de
 *  police sont copiés (deux niveaux de sous-dossiers, 300 fichiers au plus). */
async function preparerPolices(cible, dossierUtilisateur) {
    await mkdir(cible, { recursive: true });
    let fournies = 0, utilisateur = 0;
    for (const f of await readdir(DOSSIER_POLICES).catch(() => [])) {
        if (!EXT_POLICES.has(extname(f).toLowerCase()))
            continue;
        await copyFile(join(DOSSIER_POLICES, f), join(cible, f));
        fournies++;
    }
    if (dossierUtilisateur) {
        const racine = await dossierLu(dossierUtilisateur, dossierTravail).catch((e) => { throw new ErreurMontage(e.message); });
        const parcourir = async (d, profondeur) => {
            for (const e of await readdir(d, { withFileTypes: true })) {
                if (utilisateur >= 300 || e.name.startsWith("."))
                    continue;
                const p = join(d, e.name);
                if (e.isDirectory() && profondeur < 2)
                    await parcourir(p, profondeur + 1);
                else if (e.isFile() && EXT_POLICES.has(extname(e.name).toLowerCase())) {
                    await copyFile(p, join(cible, `u${utilisateur}-${e.name.replace(/[^a-zA-Z0-9._-]+/g, "-")}`));
                    utilisateur++;
                }
            }
        };
        await parcourir(racine, 0);
    }
    return { fournies, utilisateur };
}
/** "#RRGGBB" ou "#RRGGBBAA" (AA = opacité) → "&HAABBGGRR" d'ASS (où AA = transparence). */
function couleurAss(hex) {
    const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex.trim());
    if (!m)
        throw new ErreurMontage(`Couleur illisible : « ${hex} » (attendu #RRGGBB ou #RRGGBBAA).`);
    const [r, g, b] = [0, 2, 4].map((i) => m[1].slice(i, i + 2).toUpperCase());
    const transparence = (255 - parseInt(m[2] ?? "ff", 16)).toString(16).padStart(2, "0").toUpperCase();
    return `&H${transparence}${b}${g}${r}`;
}
const tempsAss = (t) => {
    const cs = Math.max(0, Math.round(t * 100));
    const h = Math.floor(cs / 360000), mi = Math.floor((cs % 360000) / 6000), s = Math.floor((cs % 6000) / 100);
    return `${h}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
/** Un texte libre → texte ASS : retours à la ligne, accolades et barres obliques neutralisées. Une ligne vide
 *  devient une espace insécable d'ASS (\h) : vide, elle peut perdre sa hauteur (en tête ou en fin de texte, selon la
 *  version de libass). */
const texteAss = (t) => t.replace(/\r/g, "").replace(/\\/g, "\\​").replace(/\{/g, "(").replace(/\}/g, ")")
    .split("\n").map((l) => (l.trim() === "" ? "\\h" : l)).join("\\N");
function lireSrt(contenu) {
    const segs = [];
    const temps = (s) => {
        const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(s);
        return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, "0").slice(0, 3) / 1000 : NaN;
    };
    for (const bloc of contenu.replace(/^﻿/, "").replace(/\r/g, "").split(/\n\s*\n/)) {
        const lignes = bloc.split("\n").filter((l) => l.trim() !== "");
        const i = lignes.findIndex((l) => l.includes("-->"));
        if (i < 0)
            continue;
        const [a, b] = lignes[i].split("-->");
        const texte = lignes.slice(i + 1).join("\n").replace(/<[^>]+>/g, "").trim();
        const debut = temps(a), fin = temps(b);
        if (texte && fin > debut)
            segs.push({ debut, fin, texte });
    }
    return segs;
}
function fichierAss(textes, segments, dureeVideo, st, tailles, posSousTitres, fonduTextes, Z, HAUTEUR) {
    // L'axe et le centre de la zone sûre (pas ceux de l'image) : la colonne de boutons mange la droite.
    const axe = Math.round((LARGEUR + Z.gauche - Z.droite) / 2), milieu = Math.round((Z.haut + HAUTEUR - Z.bas) / 2);
    const prim = couleurAss(st.couleur);
    const fond = couleurAss(st.couleurFond);
    // BorderStyle 1 = contour + ombre ; 3 = boîte opaque (libass la peint avec OutlineColour).
    const bord = st.fond === "boite" ? { style: 3, contour: 14, ombre: 0 } : st.fond === "contour" ? { style: 1, contour: 5, ombre: 2 } : { style: 1, contour: 0, ombre: 0 };
    const style = (nom, taille, align, margeV) => `Style: ${nom},${st.police},${taille},${prim},${prim},${fond},${fond},${st.gras ? -1 : 0},0,0,0,100,100,0,0,${bord.style},${bord.contour},${bord.ombre},${align},${Z.gauche + 20},${Z.droite + 20},${margeV},1`;
    const lignes = [
        "[Script Info]", "ScriptType: v4.00+", `PlayResX: ${LARGEUR}`, `PlayResY: ${HAUTEUR}`, "WrapStyle: 0", "ScaledBorderAndShadow: yes", "YCbCr Matrix: TV.709", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        // 20 px d'air sous la zone, 4 quand la zone touche le bord de l'image (format paysage, déjà entre deux bandes).
        style("Haut", tailles.texte, 8, Z.haut + (Z.haut ? 20 : 4)),
        style("Centre", tailles.texte, 5, 0),
        style("Bas", tailles.texte, 2, Z.bas + (Z.bas ? 20 : 4)),
        style("SousTitres", tailles.sousTitres, posSousTitres === "bas" ? 2 : 5, Z.bas + (Z.bas ? 40 : 8)),
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ];
    const fin = dureeVideo || 3600;
    for (const t of textes) {
        const nom = t.position === "centre" ? "Centre" : t.position === "bas" ? "Bas" : "Haut";
        const tags = [
            t.y !== undefined ? `\\an8\\pos(${axe},${Math.round(t.y)})` : nom === "Centre" ? `\\an5\\pos(${axe},${milieu})` : "",
            t.taille ? `\\fs${Math.round(t.taille)}` : "",
            fonduTextes ? "\\fad(200,200)" : "",
        ].join("");
        lignes.push(`Dialogue: 1,${tempsAss(t.debut ?? 0)},${tempsAss(t.fin ?? fin)},${nom},,0,0,0,,${tags ? `{${tags}}` : ""}${texteAss(t.texte)}`);
    }
    const posSt = posSousTitres === "centre" ? `{\\an5\\pos(${axe},${milieu})}` : "";
    for (const s of segments)
        lignes.push(`Dialogue: 0,${tempsAss(s.debut)},${tempsAss(s.fin)},SousTitres,,0,0,0,,${posSt}${texteAss(s.texte)}`);
    return lignes.join("\n") + "\n";
}
/** Une image au milieu de l'affichage de chaque texte (et du premier sous-titre), six au plus, en planche avec la
 *  zone sûre tracée : <vidéo>-controle.jpg. Rend la ligne à ajouter au résultat. */
async function plancheControle(video, textes, segments, duree, cas, tmp) {
    const instants = new Set();
    for (const t of textes)
        instants.add(((t.debut ?? 0) + Math.min(t.fin ?? duree, duree)) / 2);
    if (segments[0])
        instants.add((segments[0].debut + segments[0].fin) / 2);
    const choisis = [...instants].filter((x) => Number.isFinite(x)).sort((x, y) => x - y).slice(0, 6);
    if (!choisis.length)
        choisis.push(Math.min(1, duree / 2));
    const images = [];
    for (const [i, t] of choisis.entries()) {
        const f = join(tmp, `controle-${i}.png`);
        await ffmpeg(["-ss", String(Math.max(0, Math.min(t, duree - 0.05))), "-i", video, "-frames:v", "1", f]);
        images.push(f);
    }
    const sortiePlanche = join(dirname(video), `${basename(video, extname(video))}-controle.jpg`);
    try {
        const { planche } = await import("./apercu.js"); // playwright-core : chargé seulement ici
        await planche(images, cas, sortiePlanche);
        return `Planche de contrôle (zone « ${cas} » tracée, ${images.length} image(s) à ${choisis.map(s2).join(", ")}) : ${sortiePlanche} — regarde-la : aucun texte dans le rouge.`;
    }
    catch (e) {
        return `Pas de planche de contrôle (${e.message.split("\n")[0].slice(0, 160)}) : extraire une image avec montage_couverture et la vérifier avec carrousel_apercu (chemins, zone).`;
    }
}
// ---------------------------------------------------------------------------------------------
// Remotion (chez l'utilisateur seulement)
const MODELES_REMOTION = fileURLToPath(sousRacine("modeles/montage/remotion/"));
const ENTREES_REMOTION = ["src/index.ts", "src/index.tsx", "src/index.js", "src/index.jsx", "remotion/index.ts", "remotion/index.tsx", "app/remotion/index.ts", "index.ts", "index.js"];
export async function projetRemotion(chemin) {
    const candidat = chemin ?? process.env.VIRALDAR_REMOTION ?? process.env.REMOTION_PROJET;
    if (!candidat)
        return { manque: "aucun chemin donné, et ni VIRALDAR_REMOTION ni REMOTION_PROJET ne sont définies" };
    const dossier = resolve(candidat.startsWith("~") ? join(homedir(), candidat.slice(1)) : candidat);
    let pkg;
    try {
        pkg = JSON.parse(await readFile(join(dossier, "package.json"), "utf8"));
    }
    catch {
        return { manque: `pas de package.json dans ${dossier}` };
    }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (!deps.remotion && !deps["@remotion/cli"])
        return { manque: `${dossier} n'a ni « remotion » ni « @remotion/cli » dans ses dépendances` };
    // Le CLI installé (on le lance par node, sans shell ni npx : marche aussi sous Windows).
    let cli;
    try {
        const p = JSON.parse(await readFile(join(dossier, "node_modules/@remotion/cli/package.json"), "utf8"));
        const bin = typeof p.bin === "string" ? p.bin : p.bin?.remotion;
        if (bin)
            cli = join(dossier, "node_modules/@remotion/cli", bin);
    }
    catch { /* pas installé */ }
    if (!cli || !existsSync(cli))
        return { manque: `${dossier} déclare Remotion mais @remotion/cli n'est pas installé (lancer \`npm install\` dans le projet ; ajouter @remotion/cli s'il n'est pas dans package.json)` };
    let version = "?";
    try {
        version = JSON.parse(await readFile(join(dossier, "node_modules/remotion/package.json"), "utf8")).version;
    }
    catch { /* */ }
    let entreeTrouvee;
    try {
        const conf = await readFile(join(dossier, "remotion.config.ts"), "utf8");
        entreeTrouvee = /setEntryPoint\(\s*["'`]([^"'`]+)/.exec(conf)?.[1];
    }
    catch { /* */ }
    entreeTrouvee ??= ENTREES_REMOTION.find((e) => existsSync(join(dossier, e)));
    return { dossier, version, cli, entree: entreeTrouvee };
}
/** Le navigateur de Remotion (Chrome Headless Shell) est-il déjà là ? Remotion le télécharge (≈ 100 Mo) au premier
 *  rendu ou à la première liste de compositions, dans node_modules/.remotion/ du projet (ou .remotion/ à la racine,
 *  selon le gestionnaire de paquets), sauf si le projet en désigne un (setBrowserExecutable). */
async function navigateurRemotion(dossier) {
    try {
        const conf = await readFile(join(dossier, "remotion.config.ts"), "utf8");
        if (/setBrowserExecutable\(\s*["'`]/.test(conf))
            return true;
    }
    catch { /* pas de configuration */ }
    for (const d of ["node_modules/.remotion", ".remotion", ".yarn/.remotion", ".pnp/.remotion"]) {
        const base = join(dossier, d, "chrome-headless-shell");
        const sous = await readdir(base).catch(() => []);
        if (sous.some((s) => s !== "VERSION" && !s.endsWith(".lock")))
            return true;
    }
    return false;
}
const AVANT_TELECHARGEMENT = (dossier) => `Rien n'est lancé : Remotion n'a pas encore son navigateur. Au premier rendu (ou à la première liste de compositions), il télécharge ` +
    `Chrome Headless Shell (environ 100 Mo, quelques minutes) dans ${join(dossier, "node_modules/.remotion/")}. ` +
    "Préviens l'utilisateur, puis rappelle l'outil avec `telechargerNavigateur: true` (ou il lance lui-même `npx remotion browser ensure` dans son projet).";
const DEMANDER_REMOTION = "Demande à l'utilisateur s'il a Remotion (https://www.remotion.dev) et, si oui, le chemin de son projet " +
    "(le dossier avec package.json). viraldar ne fournit ni Remotion ni sa licence : Remotion est gratuit pour un " +
    "particulier ou une entreprise de 3 personnes au plus, payant au-delà (voir remotion.dev/license). " +
    "Sans Remotion, les outils montage_* (ffmpeg) suffisent pour l'accroche, les sous-titres, le diaporama et l'assemblage.";
/** Copie les fichiers locaux cités dans les props dans public/viraldar-medias/ et y fait pointer les props
 *  (Remotion ne lit pas les chemins du disque : il passe par staticFile ou une URL). */
async function preparerProps(valeur, publicDir, copies) {
    if (typeof valeur === "string") {
        if (!isAbsolute(valeur) && !valeur.startsWith("~"))
            return valeur;
        const brut = resolve(valeur.startsWith("~") ? join(homedir(), valeur.slice(1)) : valeur);
        if (!existsSync(brut))
            return valeur;
        // Seulement des médias, hors dossiers cachés : le dossier public/ d'un projet finit souvent en ligne.
        const chemin = await entree(valeur);
        const dossier = join(publicDir, "viraldar-medias");
        await mkdir(dossier, { recursive: true });
        const nom = basename(chemin).replace(/[^a-zA-Z0-9._-]+/g, "-");
        await copyFile(chemin, join(dossier, nom));
        copies.push(`${chemin} → public/viraldar-medias/${nom}`);
        return `viraldar-medias/${nom}`;
    }
    if (Array.isArray(valeur))
        return Promise.all(valeur.map((v) => preparerProps(v, publicDir, copies)));
    if (valeur && typeof valeur === "object") {
        const o = {};
        for (const [k, v] of Object.entries(valeur))
            o[k] = await preparerProps(v, publicDir, copies);
        return o;
    }
    return valeur;
}
// ---------------------------------------------------------------------------------------------
// Les outils
const zMode = z.enum(["auto", "recadrer", "flou", "bandes"]).describe("Mise au format : recadrer (coupe les bords), flou (fond flouté), bandes (fond uni), auto (recadrer si le ratio est proche, sinon flou).");
const zFps = z.number().min(15).max(60).optional().describe("i/s (30 par défaut).");
export const zQualite = z.enum(["rapide", "normale", "haute"]).optional().describe("normale par défaut.");
export const zNom = z.string().optional().describe("Nom de sortie (sans extension), rangé dans montages/.");
const zMusique = z.object({
    fichier: z.string().describe("Fichier son (musique ou voix off)."),
    debut: z.number().min(0).optional().describe("s"),
    volume: z.number().min(0).max(4).optional().describe("1 = inchangé, 0.3 = sous une voix."),
    fonduSortie: z.number().min(0).optional().describe("s (1,5 par défaut ; 0 avec dureeSurMusique)."),
}).optional().describe("Musique ou voix off mixée sur tout le montage. Plus longue que le montage : coupée (avertissement), sauf dureeSurMusique.");
const zDureeSurMusique = z.boolean().optional().describe("Allonger le dernier plan pour que le montage dure autant que la piste (voix off : rien n'est coupé). Non par défaut.");
const zMouvement = z.enum(MOUVEMENTS).optional();
const zAmplitude = z.number().min(0.02).max(0.5).optional().describe("Ampleur du mouvement : 0,12 (12 %) par défaut.");
const zImages = z.number().int().min(1).max(36000).optional();
export const capture = (f) => async (args) => {
    try {
        return await f(args);
    }
    catch (e) {
        return echec(e instanceof Error ? e.message : String(e));
    }
};
export const outilsMontage = (serveur, ctx) => {
    dossierTravail = ctx.dossierTravail;
    serveur.registerTool("montage_infos", {
        title: "Infos d'un média",
        description: "Durée, taille, ratio, images/s, codecs et son d'une vidéo, d'une image ou d'un son (ffprobe), et ce qui l'écarte du format TikTok (1080×1920, H.264/AAC, 30 i/s). Sans fichier : dit si ffmpeg est installé (et comment l'installer sinon) et rappelle les zones sûres.",
        inputSchema: { fichier: z.string().optional().describe("Chemin du média. Vide : état de ffmpeg seulement.") },
        annotations: { readOnlyHint: true },
    }, capture(async ({ fichier }) => {
        const f = await trouverFfmpeg();
        const etat = `ffmpeg ${f.version} (${f.ffmpeg})${f.libass ? "" : " — SANS libass : montage_texte ne marchera pas, installer une version complète de ffmpeg"}.`;
        const zones = "Zones sûres TikTok (sur 1080×1920), par cas (paramètre `zone` de montage_texte) :\n" +
            NOMS_CAS.map((cas) => { const d = descriptionCas(cas); return `- ${cas}${cas === ZONES.defaut ? " (défaut)" : ""} : ${d.titre} — texte ${d.texte_entre}${d.eviter.length ? ` ; éviter ${d.eviter.join(" ; ")}` : ""}.`; }).join("\n");
        if (!fichier)
            return ok(`${etat}\n${zones}\nSorties : ${join(ctx.dossierTravail, "montages")}`);
        const chemin = await entree(fichier);
        const s = await sonder(chemin);
        // La taille se juge contre le format connu le plus proche (un 16:9 voulu n'est pas un défaut), sinon contre le 9:16.
        const proche = s.video ? formatProche(s.video.largeur, s.video.hauteur) : undefined;
        const ecarts = ecartsTiktok(s, attenduPour(proche ?? FORMAT_DEFAUT));
        return ok([resume(chemin, s), ...(proche && proche !== FORMAT_DEFAUT ? [`Format ${proche} (pas 9:16) : à garder s'il est voulu (modèle en ${proche}), sinon montage_format_tiktok le met en 9:16.`] : []),
            ecarts.length ? `Écarts au format TikTok : ${ecarts.join(" ; ")}. (montage_format_tiktok les corrige.)` : "Déjà au format TikTok.", etat].join("\n"));
    }));
    serveur.registerTool("montage_format_tiktok", {
        title: "Mettre au format TikTok",
        description: "Ré-encode une vidéo (ou une image) au format voulu (`format` : 9:16 1080×1920 par défaut ; 3:4, 4:5, 1:1, 4:3 1440×1080, 16:9 1920×1080, 2.35:1 1920×818 pour garder l'orientation d'un modèle), H.264 + AAC, 30 i/s, MP4 sans métadonnées : recadrage, fond flouté ou bandes. Peut découper en même temps. Ajoute une piste silencieuse si la source n'a pas de son.",
        inputSchema: {
            fichier: z.string().describe("Vidéo ou image source."),
            format: zFormat.optional(),
            mode: zMode.optional(),
            couleurBandes: zCouleurBandes.optional().describe("Couleur du fond en mode bandes (#RRGGBB ou nom ffmpeg), noir par défaut."),
            debut: z.number().min(0).optional().describe("s"),
            fin: z.number().min(0).optional().describe("s"),
            duree: z.number().positive().optional().describe("s (image : 5)"),
            volume: z.number().min(0).max(4).optional().describe("0 = muet"),
            fps: zFps, qualite: zQualite, nom: zNom,
        },
    }, capture(async (a) => {
        const chemin = await sortie(ctx, a.nom, `${basename(a.fichier, extname(a.fichier))}-tiktok`, "mp4");
        const { remarques } = await monter([{ fichier: a.fichier, debut: a.debut, fin: a.fin, duree: a.duree, volume: a.volume }], { mode: a.mode ?? "auto", format: a.format, fps: a.fps, couleurBandes: a.couleurBandes?.replace(/^#/, "0x"), qualite: a.qualite, dureeImage: 5 }, chemin);
        return rendu(chemin, `Mis au format ${a.format ?? FORMAT_DEFAUT}.`, remarques, attenduPour(a.format));
    }));
    serveur.registerTool("montage_decouper", {
        title: "Découper",
        description: "Garde un passage d'une vidéo (au centième de seconde près : ré-encodé), sans changer sa taille. Pour découper et mettre au 9:16 d'un coup, utiliser montage_format_tiktok avec debut/fin.",
        inputSchema: {
            fichier: z.string().describe("Vidéo source."),
            debut: z.number().min(0).describe("Début, en s."),
            fin: z.number().min(0).optional().describe("Fin, en s (sinon duree, sinon jusqu'au bout)."),
            duree: z.number().positive().optional().describe("Durée en s, si pas de fin."),
            qualite: zQualite, nom: zNom,
        },
    }, capture(async (a) => {
        const chemin = await sortie(ctx, a.nom, `${basename(a.fichier, extname(a.fichier))}-extrait`, "mp4");
        await monter([{ fichier: a.fichier, debut: a.debut, fin: a.fin, duree: a.duree }], { mode: "aucun", qualite: a.qualite }, chemin);
        // La taille de la source est gardée exprès : on ne la juge pas.
        return rendu(chemin, `Passage de ${a.debut} s gardé.`, [], null);
    }));
    /** Une ligne qui résume la cadence d'un montage (nombre de plans, durée d'un plan). */
    const cadence = (durees) => {
        if (durees.length < 2)
            return [];
        const moy = durees.reduce((x, y) => x + y, 0) / durees.length;
        const min = Math.min(...durees), max = Math.max(...durees);
        return [`Cadence : ${durees.length} plans, ${s2(moy)} en moyenne${max - min > 0.01 ? ` (de ${s2(min)} à ${s2(max)})` : ""}.`];
    };
    serveur.registerTool("montage_assembler", {
        title: "Assembler des plans",
        description: "Met bout à bout plusieurs plans (vidéos, chacune avec son passage, ou images), tous mis au même format de la même façon (`format` : 9:16 par défaut, ou celui du modèle : 16:9, 4:3, 1:1, 2.35:1…). " +
            "Durée exacte par plan, en secondes (`duree`) ou en images (`images`, 15 = 0,5 s à 30 i/s), ou une cadence commune (`dureePlan` / `imagesParPlan`) ; les coupes tombent à l'image près. " +
            "Coupe franche par défaut (`fondu: 0`) ; fondus `xfade` en option. Mouvement de caméra sur les images fixes en option (`mouvement` : zoom_avant, zoom_arriere, gauche, droite, haut, bas — Ken Burns). " +
            "Musique ou voix off en option ; `dureeSurMusique: true` allonge le dernier plan jusqu'à la fin de la piste. Pour du texte par-dessus, enchaîner avec montage_texte.",
        inputSchema: {
            plans: z.array(z.object({
                fichier: z.string().describe("Vidéo ou image."),
                debut: z.number().min(0).optional().describe("s"),
                fin: z.number().min(0).optional().describe("s"),
                duree: z.number().positive().optional().describe("s (image : dureePlan, sinon 3)"),
                images: zImages.describe("Durée en images (prime sur duree)."),
                volume: z.number().min(0).max(4).optional().describe("0 = muet"),
                mouvement: zMouvement.describe("Mouvement de ce plan (image ou vidéo)."),
            })).min(1).describe("Les plans, dans l'ordre."),
            format: zFormat.optional(),
            mode: zMode.optional(),
            dureePlan: z.number().positive().optional().describe("s : durée de tout plan qui n'a ni duree, ni images, ni fin (la cadence du modèle, ex. 0,5)."),
            imagesParPlan: zImages.describe("La même cadence, en images (prime sur dureePlan)."),
            fondu: z.number().min(0).max(3).optional().describe("s ; 0 = coupe franche (défaut, comme les modèles qui coupent vite)."),
            transition: zTransition.optional().describe("xfade, si fondu > 0 : fade, fadeblack, dissolve, slideleft, wipeleft, circleopen, zoomin…"),
            mouvement: zMouvement.describe("Mouvement par défaut des plans image (aucun par défaut)."),
            amplitude: zAmplitude,
            musique: zMusique, dureeSurMusique: zDureeSurMusique, fps: zFps, qualite: zQualite, nom: zNom,
        },
    }, capture(async (a) => {
        const chemin = await sortie(ctx, a.nom, "montage", "mp4");
        const fps = a.fps ?? FPS_DEFAUT;
        const { duree, remarques, durees } = await monter(a.plans, {
            mode: a.mode ?? "auto", format: a.format, fondu: a.fondu, transition: a.transition, musique: a.musique,
            dureeSurMusique: a.dureeSurMusique, fps: a.fps, qualite: a.qualite,
            dureePlan: a.imagesParPlan !== undefined ? a.imagesParPlan / fps : a.dureePlan, mouvement: a.mouvement, amplitude: a.amplitude,
        }, chemin);
        return rendu(chemin, `${a.plans.length} plans assemblés (${s2(duree)}).`, [...cadence(durees), ...remarques], attenduPour(a.format));
    }));
    serveur.registerTool("montage_diaporama", {
        title: "Diaporama vidéo",
        description: "Fait une vidéo à partir d'images (par exemple les PNG d'un carrousel), au format voulu (9:16 par défaut), avec une durée par image (s ou images, ou une pour chacune), coupe franche par défaut ou fondus, " +
            "mouvement de caméra (Ken Burns) en option et une piste audio (musique ou voix) en option.",
        inputSchema: {
            images: z.array(z.string()).min(1).describe("Chemins des images, dans l'ordre."),
            dureeParImage: z.number().positive().optional().describe("s (3)"),
            imagesParImage: zImages.describe("La durée de chaque image, en images (prime sur dureeParImage)."),
            durees: z.array(z.number().positive()).optional().describe("s, une par image"),
            format: zFormat.optional(),
            mode: zMode.optional().describe("bandes par défaut"),
            couleurBandes: zCouleurBandes.optional().describe("Couleur du fond en mode bandes (#RRGGBB), noir par défaut."),
            fondu: z.number().min(0).max(2).optional().describe("s ; 0 = coupe franche (défaut)"),
            transition: zTransition.optional().describe("xfade (fade)"),
            mouvement: zMouvement.describe("Mouvement de caméra sur chaque image (aucun par défaut)."),
            amplitude: zAmplitude,
            musique: zMusique, dureeSurMusique: zDureeSurMusique, fps: zFps, qualite: zQualite, nom: zNom,
        },
    }, capture(async (a) => {
        if (a.durees && a.durees.length !== a.images.length)
            throw new ErreurMontage(`${a.durees.length} durées pour ${a.images.length} images.`);
        const chemin = await sortie(ctx, a.nom, "diaporama", "mp4");
        const plans = a.images.map((f, i) => (a.durees?.[i] !== undefined || a.imagesParImage === undefined
            ? { fichier: f, duree: a.durees?.[i] ?? a.dureeParImage ?? 3 }
            : { fichier: f, images: a.imagesParImage }));
        for (const p of plans)
            if (!EXTENSIONS_IMAGE.has(extname(p.fichier).toLowerCase()))
                throw new ErreurMontage(`Pas une image (png, jpg, webp…) : ${p.fichier}`);
        const { duree, remarques, durees } = await monter(plans, {
            mode: a.mode ?? "bandes", format: a.format, couleurBandes: a.couleurBandes?.replace(/^#/, "0x"), fondu: a.fondu, transition: a.transition,
            musique: a.musique, dureeSurMusique: a.dureeSurMusique, fps: a.fps, qualite: a.qualite, mouvement: a.mouvement, amplitude: a.amplitude,
        }, chemin);
        return rendu(chemin, `Diaporama de ${a.images.length} images (${s2(duree)}).`, [...cadence(durees), ...remarques], attenduPour(a.format));
    }));
    serveur.registerTool("montage_texte", {
        title: "Incruster texte et sous-titres",
        description: "Incruste des textes (accroche en haut par défaut) et des sous-titres (fichier SRT ou segments) dans la zone sûre TikTok du cas `zone` " +
            `(par défaut « ${ZONES.defaut} » : ${descriptionCas(ZONES.defaut).texte_entre}, avatars à gauche évités ; voir montage_infos pour les autres cas). ` +
            `Coupure des lignes automatique, centrage sur l'axe de la zone. Prévient si un texte reste moins de ${LECTURE.parMot} s par mot (${LECTURE.minimum} s au moins). ` +
            "Rend aussi une planche de contrôle (<sortie>-controle.jpg : une image par texte, zones tracées) quand un Chrome/Chromium est trouvé : regarde-la. " +
            "Tout format de vidéo (9:16, 16:9, 4:3, 1:1… : mettre d'abord la vidéo au format voulu) : les px sont ceux d'un repère de 1080 de large " +
            "(1080×1920 en 9:16, 1080×608 en 16:9), donc une taille se lit pareil sur le téléphone. " +
            `Polices fournies d'office : ${Object.keys(POLICES_FOURNIES).join(", ")} (libres, OFL ; polices variables : libass n'en rend que la graisse par défaut, \`gras\` l'épaissit). ` +
            "Les lignes vides (\\n\\n) sont gardées. Les emoji en couleur ne sont pas rendus (libass).",
        inputSchema: {
            fichier: z.string().describe("Vidéo, déjà au format voulu (montage_format_tiktok)."),
            textes: z.array(z.object({
                texte: z.string().describe("\\n = retour à la ligne, \\n\\n = ligne vide"),
                debut: z.number().min(0).optional().describe("s"),
                fin: z.number().min(0).optional().describe("s (fin par défaut)"),
                position: z.enum(["haut", "centre", "bas"]).optional().describe("haut par défaut"),
                y: z.number().optional().describe("y du haut du texte, px du repère (sur 1920 en 9:16)"),
                taille: z.number().min(10).max(250).optional().describe("px"),
            })).optional().describe("Accroches et textes posés."),
            sousTitresSrt: z.string().optional().describe(".srt"),
            sousTitres: z.array(z.object({ debut: z.number().min(0), fin: z.number().min(0), texte: z.string() })).optional().describe("Ou des segments (s)."),
            positionSousTitres: z.enum(["bas", "centre"]).optional().describe("bas par défaut"),
            zone: zCas.optional(),
            controle: z.boolean().optional().describe("Planche de contrôle (oui par défaut)."),
            police: zPolice.optional().describe(`Une police fournie (${Object.keys(POLICES_FOURNIES).join(", ")}), une police installée, ou une de dossierPolices (Arial par défaut).`),
            dossierPolices: z.string().optional().describe("Dossier de .ttf/.otf/.woff2 en plus, lu comme un média (dossier de travail, ou ce que l'utilisateur a permis en lecture)."),
            tailleTexte: z.number().min(10).max(250).optional().describe("px (72)"),
            tailleSousTitres: z.number().min(10).max(200).optional().describe("px (58)"),
            couleur: z.string().optional().describe("#RRGGBB (blanc)"),
            fond: z.enum(["contour", "boite", "aucun"]).optional().describe("contour par défaut ; boite = pavé façon TikTok"),
            couleurFond: z.string().optional().describe("#RRGGBB(AA) (noir)"),
            gras: z.boolean().optional().describe("oui par défaut"),
            fondu: z.boolean().optional().describe("oui par défaut"),
            qualite: zQualite, nom: zNom,
        },
    }, capture(async (a) => {
        const f = await trouverFfmpeg();
        if (!f.libass)
            throw new ErreurMontage(`Ce ffmpeg (${f.ffmpeg}) n'a pas libass (filtre « ass ») : impossible d'incruster du texte. ${installationFfmpeg()}`);
        const source = await entree(a.fichier);
        const s = await sonder(source);
        if (!s.video)
            throw new ErreurMontage("Pas de piste vidéo.");
        let segments = a.sousTitres ?? [];
        if (a.sousTitresSrt) {
            segments = lireSrt(await readFile(await entree(a.sousTitresSrt, [".srt"], "Sous-titres"), "utf8"));
            if (!segments.length)
                throw new ErreurMontage(`Aucun sous-titre lisible dans ${a.sousTitresSrt}.`);
        }
        if (!a.textes?.length && !segments.length)
            throw new ErreurMontage("Rien à incruster : donner textes, sousTitres ou sousTitresSrt.");
        const remarques = [];
        const format = formatProche(s.video.largeur, s.video.hauteur);
        if (!format)
            remarques.push(`La vidéo est en ${ratio(s.video.largeur, s.video.hauteur)}, un format inconnu : la zone sûre y est reportée telle quelle ; passer d'abord par montage_format_tiktok (format du modèle).`);
        if ((a.textes ?? []).some((t) => /\p{Extended_Pictographic}/u.test(t.texte)) || segments.some((t) => /\p{Extended_Pictographic}/u.test(t.texte)))
            remarques.push("Des emoji sont dans le texte : libass ne les rend pas en couleur (souvent un carré ou rien).");
        const cas = a.zone ?? ZONES.defaut;
        // Le repère du texte : 1080 de large, la hauteur au ratio de la vidéo.
        const HAUTEUR = Math.round((LARGEUR * s.video.hauteur) / s.video.largeur);
        const Z = margesVideo(cas, HAUTEUR);
        const textes = a.textes ?? [];
        for (const t of textes) {
            const debut = t.debut ?? 0, fin = Math.min(t.fin ?? s.duree, s.duree || Infinity);
            const mots = t.texte.split(/\s+/).filter(Boolean).length;
            const besoin = Math.max(LECTURE.minimum, mots * LECTURE.parMot);
            if (fin - debut < besoin - 0.05)
                remarques.push(`« ${t.texte.slice(0, 40)}${t.texte.length > 40 ? "…" : ""} » reste ${s2(fin - debut)} pour ${mots} mots : compter au moins ${s2(besoin)} pour le lire.`);
            if (t.y !== undefined && (t.y < Z.haut || t.y > HAUTEUR - Z.bas - (t.taille ?? a.tailleTexte ?? 72)))
                remarques.push(`« ${t.texte.slice(0, 40)} » : y = ${Math.round(t.y)} sort de la zone sûre « ${cas} » (y ${Z.haut} à ${HAUTEUR - Z.bas}).`);
        }
        if ((a.positionSousTitres ?? "bas") === "bas" && segments.length) {
            const enBas = textes.filter((t) => t.position === "bas" && t.y === undefined &&
                segments.some((g) => g.debut < Math.min(t.fin ?? s.duree, s.duree || Infinity) && g.fin > (t.debut ?? 0)));
            if (enBas.length)
                remarques.push(`${enBas.length} texte(s) en bas s'affichent en même temps que les sous-titres, au même endroit : ` +
                    "les mettre en haut ou au centre, ou passer positionSousTitres à centre.");
        }
        const ass = fichierAss(textes, segments, s.duree, {
            police: nomPolice(a.police ?? "Arial"),
            couleur: a.couleur ?? "#FFFFFF", fond: a.fond ?? "contour", couleurFond: a.couleurFond ?? "#000000", gras: a.gras ?? true,
        }, { texte: a.tailleTexte ?? 72, sousTitres: a.tailleSousTitres ?? 58 }, a.positionSousTitres ?? "bas", a.fondu ?? true, Z, HAUTEUR);
        const tmp = await mkdtemp(join(tmpdir(), "viraldar-texte-"));
        try {
            await writeFile(join(tmp, "textes.ass"), ass, "utf8");
            // Un seul dossier de polices pour libass : celles du plugin, plus celles de l'utilisateur (copiées, polices seulement).
            const n = await preparerPolices(join(tmp, "polices"), a.dossierPolices);
            if (a.dossierPolices && !n.utilisateur)
                remarques.push(`Aucune police (.ttf, .otf, .ttc, .woff, .woff2) trouvée dans ${a.dossierPolices}.`);
            const filtre = "ass=textes.ass:fontsdir=polices";
            const chemin = await sortie(ctx, a.nom, `${basename(source, extname(source))}-texte`, "mp4");
            await ffmpeg(["-i", source, "-vf", `${filtre},${PIXELS}`, "-map", "0:v:0", "-map", "0:a:0?", ...argsEncodage(a.qualite, !!s.audio), chemin], tmp);
            if (a.controle ?? true)
                remarques.push(await plancheControle(chemin, textes, segments, s.duree, cas, tmp));
            return await rendu(chemin, `Incrusté : ${textes.length} texte(s), ${segments.length} sous-titre(s), zone sûre « ${cas} ».`, remarques, format ? attenduPour(format) : null);
        }
        finally {
            await rm(tmp, { recursive: true, force: true });
        }
    }));
    serveur.registerTool("montage_couverture", {
        title: "Image de couverture",
        description: "Extrait une image de la vidéo à l'instant donné (JPEG ou PNG, sans métadonnées), en option mise à un format (`orientation`, 9:16 par défaut quand `mode` est donné).",
        inputSchema: {
            fichier: z.string().describe("Vidéo source."),
            instant: z.number().min(0).optional().describe("Instant en s (1 par défaut, ou le milieu si la vidéo est plus courte)."),
            format: z.enum(["jpg", "png"]).optional().describe("Format de fichier : jpg (défaut) ou png."),
            mode: z.enum(["auto", "recadrer", "flou", "bandes", "aucun"]).optional().describe("Mise au format (aucun par défaut : taille de la vidéo)."),
            orientation: zFormat.optional(),
            nom: zNom,
        },
    }, capture(async (a) => {
        const source = await entree(a.fichier);
        const s = await sonder(source);
        if (!s.video)
            throw new ErreurMontage("Pas de piste vidéo.");
        const voulu = a.instant ?? (s.duree < 2 ? s.duree / 2 : 1);
        const t = Math.max(0, Math.min(voulu, s.duree - 0.05));
        const ext = a.format ?? "jpg";
        const chemin = await sortie(ctx, a.nom, `${basename(source, extname(source))}-couverture`, ext);
        const t2 = tailleVideo(a.orientation ?? FORMAT_DEFAUT);
        const fmt = filtreFormat(a.mode ?? "aucun", s.video.largeur, s.video.hauteur, "black", 0, t2.l, t2.h);
        await ffmpeg(["-ss", String(t), "-i", source, "-frames:v", "1", "-filter_complex", `[0:v]${fmt}[c]`, "-map", "[c]",
            ...(ext === "jpg" ? ["-q:v", "2", "-pix_fmt", "yuvj420p"] : []), "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:v", "+bitexact", chemin]);
        const c = await sonder(chemin);
        return ok(`Couverture à ${s2(t)} : ${chemin}\n${c.video?.largeur}×${c.video?.hauteur}, ${(c.octets / 1e3).toFixed(0)} ko.`);
    }));
    // --- Remotion ---------------------------------------------------------------------------------
    serveur.registerTool("remotion_detecter", {
        title: "Trouver Remotion",
        description: "Cherche le projet Remotion de l'utilisateur (chemin donné, sinon variable VIRALDAR_REMOTION). S'il n'y en a pas, il faut DEMANDER à l'utilisateur s'il a Remotion : viraldar ne l'installe pas et n'en fournit pas la licence. " +
            "Dit si le navigateur de Remotion (Chrome Headless Shell, ≈ 100 Mo) est déjà téléchargé : sinon, le premier rendu le télécharge, et l'outil le dit avant de rien lancer. Peut lister les compositions du projet.",
        inputSchema: {
            projet: z.string().optional().describe("Dossier du projet Remotion (celui qui contient package.json)."),
            listerCompositions: z.boolean().optional().describe("Lancer `remotion compositions` pour lister les compositions (quelques secondes)."),
            telechargerNavigateur: z.boolean().optional().describe("Accepter que Remotion télécharge son navigateur (≈ 100 Mo) s'il manque, après avoir prévenu l'utilisateur."),
        },
        annotations: { readOnlyHint: true },
    }, capture(async (a) => {
        const p = await projetRemotion(a.projet);
        if ("manque" in p)
            return ok(`Pas de projet Remotion utilisable : ${p.manque}.\n${DEMANDER_REMOTION}`);
        const lignes = [`Projet Remotion : ${p.dossier}`, `Remotion ${p.version}`, `Point d'entrée : ${p.entree ?? "introuvable (le donner à remotion_rendre)"}`];
        const nos = existsSync(join(p.dossier, "src/viraldar/Compositions.tsx"));
        lignes.push(nos ? "Les compositions viraldar sont copiées (src/viraldar/)." : "Les compositions viraldar ne sont pas copiées (remotion_modeles).");
        const navigateur = await navigateurRemotion(p.dossier);
        lignes.push(navigateur ? "Navigateur de Remotion : déjà là." : "Navigateur de Remotion : pas encore téléchargé (≈ 100 Mo au premier rendu ; prévenir l'utilisateur).");
        if (a.listerCompositions && p.entree && !navigateur && !a.telechargerNavigateur) {
            lignes.push(AVANT_TELECHARGEMENT(p.dossier));
        }
        else if (a.listerCompositions && p.entree) {
            const { stdout } = await executer(process.execPath, [p.cli, "compositions", p.entree, "--quiet"], { cwd: p.dossier, delaiMs: 180_000, nom: "remotion compositions" });
            lignes.push("Compositions :", stdout.trim());
        }
        return ok(lignes.join("\n"));
    }));
    serveur.registerTool("remotion_modeles", {
        title: "Compositions Remotion types",
        description: "Décrit nos compositions Remotion types (TexteSurVideo : textes animés sur une vidéo ou un fond ; ListeDefile : titre et liste qui apparaît élément par élément ; Citation : citation mot à mot puis auteur), à 30 i/s, durée tirée des props, " +
            `au format de la prop \`format\` (${NOMS_FORMATS.join(", ")} ; 9:16 1080×1920 par défaut ; remotion_rendre la pose avec son paramètre \`format\`), ` +
            `texte dans la zone sûre de la prop \`zone\` (${NOMS_CAS.join(", ")} ; « ${ZONES.defaut} » par défaut). ` +
            "Avec `projet`, les copie dans <projet>/src/viraldar/ (sans écraser sauf `ecraser`) et dit comment les déclarer dans le Root du projet.",
        inputSchema: {
            projet: z.string().optional().describe("Projet Remotion où copier les compositions. Vide : description seulement."),
            ecraser: z.boolean().optional().describe("Remplacer des fichiers viraldar déjà copiés."),
        },
    }, capture(async (a) => {
        const fichiers = (await readdir(join(MODELES_REMOTION, "viraldar"))).sort();
        let props = "";
        try {
            props = await readFile(join(MODELES_REMOTION, "props-exemples.json"), "utf8");
        }
        catch { /* */ }
        const description = `Modèles : ${MODELES_REMOTION}viraldar/ (${fichiers.join(", ")}).\nProps d'exemple par composition :\n${props}`;
        if (!a.projet)
            return ok(description);
        const p = await projetRemotion(a.projet);
        if ("manque" in p)
            return ok(`Pas de projet Remotion utilisable : ${p.manque}.\n${DEMANDER_REMOTION}`);
        const cible = join(p.dossier, "src/viraldar");
        await mkdir(cible, { recursive: true });
        const copies = [], gardes = [];
        for (const f of fichiers) {
            if (existsSync(join(cible, f)) && !a.ecraser)
                gardes.push(f);
            else {
                await copyFile(join(MODELES_REMOTION, "viraldar", f), join(cible, f));
                copies.push(f);
            }
        }
        // Les zones sûres, toujours réécrites depuis modeles/zones-sures.json (commun.ts les importe).
        await writeFile(join(cible, "zones-sures.ts"), "// Écrit par remotion_modeles (MCP viraldar) depuis modeles/zones-sures.json : ne pas éditer, relancer l'outil.\n" +
            `export const ZONES_DONNEES = ${JSON.stringify({
                repere: ZONES.repere, defaut: ZONES.defaut, cas: ZONES.cas,
                formats: Object.fromEntries(Object.entries(ZONES.formats).map(([n, f]) => [n, f.video])),
            }, null, 2)} as const;\n`);
        copies.push("zones-sures.ts (zones sûres et formats à jour)");
        return ok([
            `Copié dans ${cible} : ${copies.join(", ") || "rien"}${gardes.length ? ` ; déjà là, gardés : ${gardes.join(", ")}` : ""}.`,
            "À faire une fois dans le Root du projet (souvent src/Root.tsx) :",
            "  import { CompositionsViraldar } from \"./viraldar/Compositions\";",
            "  … et dans le JSX retourné : <CompositionsViraldar />",
            "Ensuite : remotion_rendre avec composition = ViraldarTexteSurVideo, ViraldarListeDefile ou ViraldarCitation.",
            description,
        ].join("\n"));
    }));
    serveur.registerTool("remotion_rendre", {
        title: "Rendre avec Remotion",
        description: "Lance `remotion render` dans le projet Remotion de l'utilisateur, avec des props JSON. Les chemins absolus de fichiers dans les props (vidéo, image, musique) sont copiés dans public/viraldar-medias/ du projet et remplacés par leur nom staticFile. " +
            "`format` (9:16 par défaut, ou 16:9, 4:3, 1:1, 2.35:1… celui du modèle) est passé en prop `format` : nos compositions s'y mettent ; une composition à soi doit le lire. " +
            "Si le navigateur de Remotion manque, rien n'est lancé tant que `telechargerNavigateur` n'est pas vrai (≈ 100 Mo, prévenir l'utilisateur). Sortie MP4 H.264 dans montages/. Si Remotion manque : demander à l'utilisateur.",
        inputSchema: {
            projet: z.string().optional().describe("Dossier du projet Remotion (sinon VIRALDAR_REMOTION)."),
            composition: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/, "lettres, chiffres, - et _").describe("Identifiant de la composition (ex. ViraldarCitation)."),
            props: z.record(z.string(), z.any()).optional().describe("Props passées à la composition."),
            format: zFormat.optional(),
            entree: z.string().regex(/^[A-Za-z0-9_][A-Za-z0-9_./-]{0,200}$/, "un chemin relatif au projet").optional().describe("Point d'entrée Remotion si non détecté (ex. src/index.ts)."),
            telechargerNavigateur: z.boolean().optional().describe("Accepter que Remotion télécharge son navigateur (≈ 100 Mo) s'il manque, après avoir prévenu l'utilisateur."),
            nom: zNom,
        },
    }, capture(async (a) => {
        const p = await projetRemotion(a.projet);
        if ("manque" in p)
            return ok(`Pas de projet Remotion utilisable : ${p.manque}.\n${DEMANDER_REMOTION}`);
        const entreeRemotion = a.entree ?? p.entree;
        // Ni option glissée au CLI (« --… »), ni fichier hors du projet.
        if (entreeRemotion && (entreeRemotion.startsWith("-") || !sous(p.dossier, resolve(p.dossier, entreeRemotion))))
            throw new ErreurMontage(`Point d'entrée hors du projet : ${entreeRemotion}`);
        if (!entreeRemotion)
            throw new ErreurMontage(`Point d'entrée Remotion introuvable dans ${p.dossier} : le donner (entree).`);
        if (!a.telechargerNavigateur && !(await navigateurRemotion(p.dossier)))
            return ok(AVANT_TELECHARGEMENT(p.dossier));
        // Le format voulu : le paramètre, sinon la prop, sinon celui de nos compositions (9:16) ; une composition à soi
        // sans format n'est pas jugée sur sa taille (2.10 : pas de faux avertissement pour un paysage voulu).
        const formatProps = typeof a.props?.format === "string" ? a.props.format : undefined;
        if (a.format && formatProps && a.format !== formatProps)
            throw new ErreurMontage(`format « ${a.format} » et props.format « ${formatProps} » diffèrent : n'en donner qu'un.`);
        const format = a.format ?? formatProps;
        if (format && !NOMS_FORMATS.includes(format))
            throw new ErreurMontage(`Format inconnu : « ${format} » (possibles : ${NOMS_FORMATS.join(", ")}).`);
        const attendu = format ? attenduPour(format) : a.composition.startsWith("Viraldar") ? attenduPour(FORMAT_DEFAUT) : null;
        const copies = [];
        const props = await preparerProps({ ...(a.props ?? {}), ...(format ? { format } : {}) }, join(p.dossier, "public"), copies);
        const tmp = await mkdtemp(join(tmpdir(), "viraldar-remotion-"));
        try {
            const fichierProps = join(tmp, "props.json");
            await writeFile(fichierProps, JSON.stringify(props), "utf8");
            const chemin = await sortie(ctx, a.nom, a.composition, "mp4");
            await executer(process.execPath, [p.cli, "render", entreeRemotion, a.composition, chemin, `--props=${fichierProps}`, "--codec=h264", "--log=error"], { cwd: p.dossier, delaiMs: 30 * 60_000, nom: "remotion render" });
            // Remotion écrit ses propres métadonnées : on les retire sans ré-encoder.
            const propre = chemin.replace(/\.mp4$/, ".propre.mp4");
            await ffmpeg(["-i", chemin, "-map", "0", "-c", "copy", "-map_metadata", "-1", "-map_chapters", "-1", "-fflags", "+bitexact", "-movflags", "+faststart", propre]).then(() => rename(propre, chemin), () => undefined);
            const plus = copies.length ? [`Médias copiés dans le projet : ${copies.join(" ; ")}`] : [];
            return await rendu(chemin, `Rendu Remotion de ${a.composition}.`, plus, attendu).catch(() => ok([`Rendu Remotion de ${a.composition} : ${chemin}`, ...plus].join("\n")));
        }
        finally {
            await rm(tmp, { recursive: true, force: true });
        }
    }));
};
