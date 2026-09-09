// Quem entra no diagnostico em lote: score >= scoreMinimo OU entre os topN
// melhores de alguma pesquisa a que o lead pertence.
//
// O botao manual em /lead/[id] IGNORA isto (roda mesmo abaixo do limite).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConfigIa } from "./config-ia";

/**
 * Melhor (menor) posicao do lead no ranking por score, entre todas as pesquisas
 * a que ele pertence. 1 = melhor lead da pesquisa. null = lead sem score ou
 * sem pesquisa.
 */
export async function melhorPosicaoNoRanking(
  db: SupabaseClient,
  leadId: string,
): Promise<number | null> {
  const { data: vinc, error } = await db
    .from("search_leads")
    .select("search_id")
    .eq("lead_id", leadId);
  if (error) throw new Error(`search_leads: ${error.message}`);
  const searchIds = [...new Set((vinc ?? []).map((v) => v.search_id as string))];
  if (searchIds.length === 0) return null;

  let melhor: number | null = null;
  for (const sid of searchIds) {
    const pos = await posicaoNaPesquisa(db, sid, leadId);
    if (pos != null && (melhor === null || pos < melhor)) melhor = pos;
  }
  return melhor;
}

/** Posicao (1-based) do lead entre os leads COM score da pesquisa. */
export async function posicaoNaPesquisa(
  db: SupabaseClient,
  searchId: string,
  leadId: string,
): Promise<number | null> {
  const { data: irmaos, error } = await db
    .from("search_leads")
    .select("lead_id")
    .eq("search_id", searchId);
  if (error) throw new Error(`search_leads: ${error.message}`);
  const ids = (irmaos ?? []).map((r) => r.lead_id as string);
  if (ids.length === 0) return null;

  const { data: scores, error: errSc } = await db
    .from("scores")
    .select("lead_id, total")
    .in("lead_id", ids);
  if (errSc) throw new Error(`scores: ${errSc.message}`);

  const ordenado = (scores ?? [])
    .map((s) => ({ id: s.lead_id as string, total: s.total as number }))
    .sort((a, b) => b.total - a.total);

  const idx = ordenado.findIndex((s) => s.id === leadId);
  return idx >= 0 ? idx + 1 : null;
}

export type VereditoElegibilidade = {
  elegivel: boolean;
  motivo: string;
  scoreTotal: number | null;
  posicao: number | null;
};

/** Aplica a regra: score >= scoreMinimo OU posicao <= topN. */
export async function avaliarElegibilidade(
  db: SupabaseClient,
  leadId: string,
  scoreTotal: number | null,
  config: ConfigIa,
): Promise<VereditoElegibilidade> {
  if (scoreTotal == null) {
    return { elegivel: false, motivo: "lead ainda sem score", scoreTotal: null, posicao: null };
  }
  if (scoreTotal >= config.scoreMinimo) {
    return {
      elegivel: true,
      motivo: `score ${scoreTotal} >= ${config.scoreMinimo}`,
      scoreTotal,
      posicao: null,
    };
  }
  const posicao = await melhorPosicaoNoRanking(db, leadId);
  if (posicao != null && posicao <= config.topN) {
    return {
      elegivel: true,
      motivo: `${posicao}o melhor da pesquisa (top ${config.topN})`,
      scoreTotal,
      posicao,
    };
  }
  return {
    elegivel: false,
    motivo: `score ${scoreTotal} < ${config.scoreMinimo} e fora do top ${config.topN}`,
    scoreTotal,
    posicao,
  };
}
