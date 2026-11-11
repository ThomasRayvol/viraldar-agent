// La méthode viraldar (le skill skills/viraldar-creation/) servie par le MCP lui-même, pour les clients qui ne
// lisent pas les skills (Claude Desktop avec la seule extension, autres clients MCP) :
//   - le prompt `methode_viraldar` (SKILL.md) ;
//   - les ressources viraldar://methode/skill et viraldar://methode/<référence> ;
//   - l'outil `methode` (même contenu), pour les clients qui ignorent prompts et ressources.
// Dans Claude Code, le plugin installe en plus le skill : il se déclenche seul, sans passer par ici.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sousRacine } from "./racine.ts";

const DOSSIER = fileURLToPath(sousRacine("skills/viraldar-creation/"));
const sansEntete = (md: string) => md.replace(/^---\n[\s\S]*?\n---\n+/, "");
const lire = (f: string) => readFileSync(DOSSIER + f, "utf8");

export const REFERENCES = readdirSync(DOSSIER + "references").filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort() as [string, ...string[]];
const NOTE = "\n\n---\nServie par le MCP : chaque référence citée (`references/<nom>.md`) se lit avec l'outil `methode` "
  + "(`reference: \"<nom>\"`) ou la ressource `viraldar://methode/<nom>`. Ne les charge qu'à l'étape qui les demande.";

export function methode(reference?: string): string {
  if (!reference) return sansEntete(lire("SKILL.md")) + NOTE;
  if (!REFERENCES.includes(reference)) throw new Error(`Référence inconnue : ${reference} (${REFERENCES.join(", ")}).`);
  return lire(`references/${reference}.md`);
}

export function servirMethode(serveur: McpServer) {
  serveur.registerPrompt("methode_viraldar", {
    title: "Méthode viraldar",
    description: "La méthode de création de contenu TikTok avec viraldar (fiche → formats prouvés → brief → production → brouillon → mesure).",
  }, () => ({ messages: [{ role: "user", content: { type: "text", text: methode() } }] }));

  serveur.registerResource("methode", "viraldar://methode/skill",
    { title: "Méthode viraldar", mimeType: "text/markdown", description: "Le skill viraldar-creation (SKILL.md)." },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: methode() }] }));
  for (const r of REFERENCES) {
    serveur.registerResource(`methode-${r}`, `viraldar://methode/${r}`,
      { title: `Méthode viraldar : ${r}`, mimeType: "text/markdown" },
      async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: methode(r) }] }));
  }

  serveur.registerTool("methode", {
    title: "Méthode viraldar",
    description: "La méthode à suivre pour créer du contenu TikTok avec viraldar. À lire avant de proposer une stratégie, "
      + "un brief ou un contenu ; sans `reference` : la méthode, sinon une de ses références.",
    inputSchema: { reference: z.enum(REFERENCES).optional() },
    annotations: { readOnlyHint: true },
  }, async ({ reference }) => ({ content: [{ type: "text", text: methode(reference) }] }));
}
