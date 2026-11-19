// La méthode viraldar (le skill skills/viraldar-creation/) servie par le MCP lui-même, pour les clients qui ne
// lisent pas les skills (Claude Desktop avec la seule extension, autres clients MCP) :
//   - le prompt `methode_viraldar` (SKILL.md) ;
//   - les ressources viraldar://methode/skill et viraldar://methode/<référence> ;
//   - l'outil `methode` (même contenu), pour les clients qui ignorent prompts et ressources.
// Dans Claude Code, le plugin installe en plus le skill : il se déclenche seul, sans passer par ici.
// Le service lui-même est dans methode-commune.ts, partagé avec le connecteur distant.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sousRacine } from "./racine.ts";
import { sansEntete, servirTextesMethode } from "./methode-commune.ts";

const DOSSIER = fileURLToPath(sousRacine("skills/viraldar-creation/"));
const lire = (f: string) => readFileSync(DOSSIER + f, "utf8");

export function servirMethode(serveur: McpServer) {
  const references = Object.fromEntries(readdirSync(DOSSIER + "references").filter((f) => f.endsWith(".md"))
    .map((f) => [f.slice(0, -3), lire("references/" + f)]));
  servirTextesMethode(serveur, { skill: sansEntete(lire("SKILL.md")), references });
}
