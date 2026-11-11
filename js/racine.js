// La racine du paquet (le dossier qui contient package.json, modeles/ et skills/), que le code tourne depuis src/
// (type stripping, développement) ou depuis js/ (compilé, paquet npm, plugin, extension) : les deux sont au même
// niveau, un cran sous la racine.
import { fileURLToPath } from "node:url";
export const RACINE_URL = new URL("../", import.meta.url);
export const RACINE = fileURLToPath(RACINE_URL);
/** Une URL sous la racine du paquet (ex. `modeles/carrousel/`). */
export const sousRacine = (chemin) => new URL(chemin, RACINE_URL);
