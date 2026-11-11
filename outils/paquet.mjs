// Construit l'extension Claude Desktop (construit/viraldar.mcpb) depuis le même code que le plugin et le paquet npm :
// js/ compilé, modeles/, skills/, manifest.json, et les dépendances de production installées d'après
// npm-shrinkwrap.json, sans script d'installation. Valide le manifeste, puis emballe.
//   npm run paquet
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("../", import.meta.url));
const sortie = join(racine, "construit");
const ext = join(sortie, "extension");
const mcpb = join(racine, "outils", "node_modules", "@anthropic-ai", "mcpb", "dist", "cli", "cli.js");
if (!existsSync(mcpb)) { console.error("Outils absents : npm run outils"); process.exit(1); }
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

execFileSync(process.execPath, [join(racine, "outils", "verifier-construit.mjs")], { stdio: "inherit" });
rmSync(sortie, { recursive: true, force: true });
mkdirSync(ext, { recursive: true });
for (const f of ["js", "modeles", "skills", "manifest.json", "package.json", "package-lock.json", "README.md", "README.en.md", "SECURITY.md", "LICENSE", "NOTICE"]) {
  if (existsSync(join(racine, f))) cpSync(join(racine, f), join(ext, f), { recursive: true });
}
execFileSync(npm, ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: ext, stdio: "inherit" });
execFileSync(process.execPath, [mcpb, "validate", join(ext, "manifest.json")], { stdio: "inherit" });
execFileSync(process.execPath, [mcpb, "pack", ext, join(sortie, "viraldar.mcpb")], { stdio: "inherit" });
console.log(`construit/viraldar.mcpb : ${(statSync(join(sortie, "viraldar.mcpb")).size / 1e6).toFixed(1)} Mo`);
// Le skill seul, à téléverser dans Claude Desktop ou claude.ai (Réglages → Capacités) : un zip du dossier du skill.
try {
  execFileSync("zip", ["-qr", join(sortie, "viraldar-creation.zip"), "viraldar-creation"], { cwd: join(racine, "skills") });
  // La licence voyage avec le skill seul (Apache-2.0 : LICENSE et NOTICE dans toute redistribution).
  execFileSync("zip", ["-qj", join(sortie, "viraldar-creation.zip"), join(racine, "LICENSE"), join(racine, "NOTICE")]);
  console.log("construit/viraldar-creation.zip : le skill seul");
} catch { console.warn("zip absent : construit/viraldar-creation.zip non produit (zipper skills/viraldar-creation/ à la main)."); }
