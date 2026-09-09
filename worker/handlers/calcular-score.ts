// Handler do job "calcular_score": recalcula o Score de Oportunidade de 1 lead.
// Sem chamada externa. So erro de banco relanca (retry).

import { calcularEPersistirScore } from "@/lib/score/persistir";
import type { Handler } from "../tipos";

export const handlerCalcularScore: Handler = async ({ db, job, log }) => {
  if (!job.lead_id) {
    throw new Error('job "calcular_score" sem lead_id');
  }
  const r = await calcularEPersistirScore(db, job.lead_id);
  if (r.status === "lead-nao-encontrado") {
    log("score ignorado", { motivo: "lead nao encontrado" });
    return;
  }
  log("score calculado", { total: r.total, confianca: r.resultado.confianca });
};
