// Handler do job "diagnosticar_ia": diagnostico comercial com IA de 1 lead.
//
// - O lote ja filtrou a elegibilidade -> o job passa ignorarElegibilidade.
// - Teto de gasto atingido (ErroDeOrcamento) NAO e erro de job: registra e sai.
// - Chave invalida / modelo nao suportado tambem nao adianta reter.
// - 429 / 5xx / timeout / rede da IA -> relanca -> o job tenta de novo com backoff.
// - Resposta do modelo inaproveitavel ja e tratada dentro de diagnosticarLead
//   (grava a linha com `erro` e retorna "erro-modelo", sem lancar).

import { diagnosticarLead } from "@/lib/ia/diagnosticar";
import { ErroDeOrcamento } from "@/lib/guardas";
import { ErroIa, vaLePenaRetentarIa } from "@/lib/ia/erros";
import type { Handler } from "../tipos";

export const handlerDiagnosticarIa: Handler = async ({ db, job, log }) => {
  if (!job.lead_id) {
    throw new Error('job "diagnosticar_ia" sem lead_id');
  }
  const payload = (job.payload ?? {}) as { ignorarElegibilidade?: boolean };

  try {
    const r = await diagnosticarLead({ db, apiKey: process.env.GEMINI_API_KEY }, job.lead_id, {
      ignorarElegibilidade: payload.ignorarElegibilidade === true,
    });
    log("diagnostico IA", {
      status: r.status,
      modelo: r.modelo ?? "-",
      tokens: (r.tokensEntrada ?? 0) + (r.tokensSaida ?? 0),
      custo_usd: r.custoUsd,
      erro: r.erro ?? undefined,
    });
  } catch (e) {
    if (e instanceof ErroDeOrcamento) {
      log("diagnostico IA pulado", { motivo: e.motivo });
      return; // teto de gasto: job considerado feito
    }
    if (e instanceof ErroIa && !vaLePenaRetentarIa(e.tipo)) {
      log("diagnostico IA nao processado", { motivo: `${e.tipo}: ${e.message}` });
      return; // chave invalida / conteudo bloqueado / modelo nao suportado: reter nao ajuda
    }
    throw e; // erro de banco ou IA transitoria -> retry do job
  }
};
