// Ce que chaque module d'outils reçoit. Les modules ne s'importent pas entre eux : ils passent
// par ce contexte (la session viraldar, les dossiers de travail).
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Contexte {
  /** Le client Supabase de viraldar, avec la session de l'utilisateur (null tant qu'il n'est pas connecté). */
  supabase: () => Promise<SupabaseClient | null>;
  /** L'adresse du projet Supabase (pour appeler les fonctions, ex. `${url}/functions/v1/tiktok`). */
  supabaseUrl: string;
  /** Le dossier où ranger ce qu'on fabrique (carrousels, montages) : ~/viraldar par défaut. */
  dossierTravail: string;
}

export type Module = (serveur: McpServer, ctx: Contexte) => void;
