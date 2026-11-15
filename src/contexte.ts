// Ce que chaque module d'outils reçoit. Les modules ne s'importent pas entre eux : ils passent
// par ce contexte (la session viraldar, les dossiers de travail).
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Contexte {
  /** Le client Supabase de viraldar, avec la session de l'utilisateur (null tant qu'il n'est pas connecté). */
  supabase: () => Promise<SupabaseClient | null>;
  /** Le message à rendre quand `supabase()` donne null : « connecte-toi », ou « ta session a été révoquée ». */
  pasConnecte: () => string;
  /** Le message d'une erreur RPC ou de fonction, réécrit en « reconnecte-toi » si la session n'est plus valable. */
  expliquer: (message: string) => string;
  /** Les produits du compte et le produit actif (multi-produits, 15/11/2026) ; null sans session. */
  produits: () => Promise<{ liste: { id: string; nom: string; cree_le: string }[]; actif: { id: string; nom: string; cree_le: string } } | null>;
  /** Fait d'un produit (son id) le produit actif : en-tête de toutes les requêtes suivantes, et dernier choix gardé. */
  choisirProduit: (id: string) => void;
  /** L'id envoyé en en-tête, sans appel réseau (null : aucun choix, la base prend le premier produit). Sert de clé
   *  aux caches qui dépendent du produit (les posts triés). */
  produitId: () => string | null;
  /** L'adresse du projet Supabase (pour appeler les fonctions, ex. `${url}/functions/v1/tiktok`). */
  supabaseUrl: string;
  /** Le dossier où ranger ce qu'on fabrique (carrousels, montages) : ~/viraldar par défaut. */
  dossierTravail: string;
}

export type Module = (serveur: McpServer, ctx: Contexte) => void;
