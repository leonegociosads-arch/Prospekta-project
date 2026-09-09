// Enriquecimento profundo de UM lead. Roda so sob acao explicita do usuario
// (botao "Enriquecer lead" ou script). Nunca automatico, nunca em lote.

import type { SupabaseClient } from "@supabase/supabase-js";
import { criarStoreSupabase } from "@/lib/guardas/store-supabase";
import type { GuardaConfig } from "@/lib/guardas";
import { obterDetalhesPlace } from "./obter-detalhes";
import { normalizarDetalhes } from "./normalizar";
import type { ResultadoEnriquecimento } from "./tipos";

export type DepsEnriquecer = {
  db: SupabaseClient;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  guardaConfig?: GuardaConfig;
};

export type OpcoesEnriquecer = {
  incluirReviews?: boolean;
  /** janela anti-clique-duplo (ms). Default 90s. */
  janelaDedupeMs?: number;
};

export async function enriquecerLead(
  deps: DepsEnriquecer,
  leadId: string,
  opts: OpcoesEnriquecer = {},
): Promise<ResultadoEnriquecimento> {
  const { db } = deps;
  const incluirReviews = opts.incluirReviews ?? false;
  const janela = opts.janelaDedupeMs ?? 90_000;

  const { data: lead, error } = await db
    .from("leads")
    .select("id, nome, google_place_id, site_url, telefone, bruto, enriquecido_em")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(`leads: ${error.message}`);
  if (!lead) {
    return { status: "lead-nao-encontrado", fonte: null, detalhes: null, registradoUso: false, incluiuReviews: false };
  }
  if (!lead.google_place_id) {
    return { status: "sem-place-id", fonte: null, detalhes: null, registradoUso: false, incluiuReviews: false };
  }

  const store = criarStoreSupabase(db);

  // anti-clique-duplo: enriquecido ha pouquissimo tempo -> devolve o que ja temos
  if (lead.enriquecido_em && Date.now() - new Date(lead.enriquecido_em).getTime() < janela) {
    const reg = await store.lerPlace(lead.google_place_id);
    return {
      status: "cache",
      fonte: "cache",
      detalhes: reg?.detalhes != null ? normalizarDetalhes(reg.detalhes) : null,
      registradoUso: false,
      incluiuReviews: false,
    };
  }

  const { raw, fonte } = await obterDetalhesPlace(store, {
    placeId: lead.google_place_id,
    incluirReviews,
    apiKey: deps.apiKey,
    fetchImpl: deps.fetchImpl,
    brutoBusca: lead.bruto ?? {},
    config: deps.guardaConfig,
  });

  const detalhes = normalizarDetalhes(raw);

  const patch: Record<string, unknown> = {
    telefone_internacional: detalhes.telefoneInternacional,
    maps_uri: detalhes.mapsUri,
    horarios: detalhes.horarios.length > 0 ? detalhes.horarios : null,
    enriquecido_em: new Date().toISOString(),
  };
  // preenche buracos sem sobrescrever o que ja existe
  if (!(lead.site_url ?? "").trim() && detalhes.siteUrl) patch.site_url = detalhes.siteUrl;
  if (!(lead.telefone ?? "").trim() && detalhes.telefoneNacional) patch.telefone = detalhes.telefoneNacional;
  if (detalhes.statusNegocio) patch.status_negocio = detalhes.statusNegocio;

  const { error: errUpd } = await db.from("leads").update(patch).eq("id", leadId);
  if (errUpd) throw new Error(`leads update: ${errUpd.message}`);

  return {
    status: fonte === "cache" ? "cache" : "enriquecido",
    fonte,
    detalhes,
    registradoUso: fonte === "google",
    incluiuReviews: incluirReviews && fonte === "google",
  };
}
