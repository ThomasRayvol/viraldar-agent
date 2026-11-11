// Vérifie que js/ (versionné : le plugin s'installe depuis git) correspond à src/ : recompile dans un dossier
// temporaire et compare fichier par fichier. Sans dépendance.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("../", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "viraldar-js-"));
const tsc = join(racine, "outils", "node_modules", "typescript", "bin", "tsc");
const liste = (d) => readdirSync(d).flatMap((n) => statSync(join(d, n)).isDirectory() ? liste(join(d, n)) : [join(d, n)]);
try {
  execFileSync(process.execPath, [tsc, "-p", join(racine, "tsconfig.build.json"), "--outDir", tmp], { stdio: "inherit" });
  const attendus = liste(tmp).map((f) => relative(tmp, f)).sort();
  const presents = liste(join(racine, "js")).map((f) => relative(join(racine, "js"), f)).sort();
  const ecarts = [...new Set([...attendus, ...presents])].filter((f) => {
    try { return readFileSync(join(tmp, f), "utf8") !== readFileSync(join(racine, "js", f), "utf8"); } catch { return true; }
  });
  if (ecarts.length) { console.error(`js/ n'est pas à jour (${ecarts.join(", ")}) : npm run construire`); process.exit(1); }
  console.log(`js/ à jour (${attendus.length} fichiers).`);
} finally { rmSync(tmp, { recursive: true, force: true }); }
