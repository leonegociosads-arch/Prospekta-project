// Coleta a entrada, calcula o score e grava em `scores` (upsert por lead).

import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularScore, VERSAO_FORMULA } from "./calcular";
import { coletarEntradaScore } from "./coletar";
import type { ResultadoScore } from "./tipos";

export type ResultadoPersistScore =
  | { status: "ok"; total: number; resultado: ResultadoScore }
  | { status: "lead-nao-encontrado" };

export async function calcularEPersistirScore(
  db: SupabaseClient,
  leadId: string,
): Promise<ResultadoPersistScore> {
  const coletado = await coletarEntradaScore(db, leadId);
  if (!coletado) return { status: "lead-nao-encontrado" };

  const resultado = calcularScore(coletado.entrada);

  const { error } = await db.from("scores").upsert(
    {
      lead_id: leadId,
      calculado_em: resultado.calculadoEm,
      total: resultado.total,
      versao_formula: VERSAO_FORMULA,
      detalhamento: {
        versao: resultado.versao,
        calculado_em: resultado.calculadoEm,
        total: resultado.total,
        confianca: resultado.confianca,
        fatores: resultado.fatores,
        moderadores: resultado.moderadores,
        entrada: coletado.entrada,
      },
    },
    { onConflict: "lead_id" },
  );
  if (error) throw new Error(`scores upsert: ${error.message}`);

  return { status: "ok", total: resultado.total, resultado };
}
