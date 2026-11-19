// La méthode viraldar servie par un serveur MCP, à partir de ses textes : commun au MCP local (methode.ts, qui les lit
// sur le disque) et au connecteur distant (connecteur/, qui les embarque au build). Aucune dépendance à Node.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface TextesMethode {
  /** SKILL.md, sans son en-tête YAML. */
  skill: string;
  /** Les références, par nom (sans .md). */
  references: Record<string, string>;
}

export const sansEntete = (md: string) => md.replace(/^---\n[\s\S]*?\n---\n+/, "");
const NOTE = "\n\n---\nServie par le MCP : chaque référence citée (`references/<nom>.md`) se lit avec l'outil `methode` "
  + "(`reference: \"<nom>\"`) ou la ressource `viraldar://methode/<nom>`. Ne les charge qu'à l'étape qui les demande.";

export function servirTextesMethode(serveur: McpServer, t: TextesMethode) {
  const noms = Object.keys(t.references).sort() as [string, ...string[]];
  const methode = (reference?: string): string => {
    if (!reference) return t.skill + NOTE;
    const r = t.references[reference];
    if (r === undefined) throw new Error(`Référence inconnue : ${reference} (${noms.join(", ")}).`);
    return r;
  };

  serveur.registerPrompt("methode_viraldar", {
    title: "Méthode viraldar",
    description: "La méthode de création de contenu TikTok avec viraldar (fiche → formats prouvés → brief → production → brouillon → mesure).",
  }, () => ({ messages: [{ role: "user", content: { type: "text", text: methode() } }] }));

  serveur.registerResource("methode", "viraldar://methode/skill",
    { title: "Méthode viraldar", mimeType: "text/markdown", description: "Le skill viraldar-creation (SKILL.md)." },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: methode() }] }));
  for (const r of noms) {
    serveur.registerResource(`methode-${r}`, `viraldar://methode/${r}`,
      { title: `Méthode viraldar : ${r}`, mimeType: "text/markdown" },
      async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: methode(r) }] }));
  }

  serveur.registerTool("methode", {
    title: "Méthode viraldar",
    description: "La méthode à suivre pour créer du contenu TikTok avec viraldar. À lire avant de proposer une stratégie, "
      + "un brief ou un contenu ; sans `reference` : la méthode, sinon une de ses références.",
    inputSchema: { reference: z.enum(noms).optional() },
    annotations: { readOnlyHint: true },
  }, async ({ reference }) => ({ content: [{ type: "text", text: methode(reference) }] }));
}
