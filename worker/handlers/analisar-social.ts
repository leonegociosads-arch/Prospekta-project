// Handler do job "analisar_social": presenca social objetiva de 1 lead.
//
// Complementar. Bloqueio de Instagram/Facebook NAO e erro de job -> analisarSocial
// grava status "desconhecido" e retorna normalmente. So erro de banco relanca.

import { analisarSocial } from "@/lib/analise-social/analisar-social";
import type { Handler } from "../tipos";

export const handlerAnalisarSocial: Handler = async ({ db, job, log }) => {
  if (!job.lead_id) {
    throw new Error('job "analisar_social" sem lead_id');
  }
  const r = await analisarSocial({ db }, job.lead_id);
  log("presenca social terminou", {
    status: r.status,
    resumo: r.plataformas.map((p) => `${p.plataforma}:${p.status}`).join(" "),
  });
};
