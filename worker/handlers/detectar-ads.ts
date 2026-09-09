// Handler do job "detectar_ads": indicios de trafego pago de 1 lead.
//
// Falha de fonte externa (Meta Ad Library) NAO e erro de job -> analisarAds
// grava "desconhecido" e retorna normalmente. So erro de banco relanca.

import { analisarAds } from "@/lib/ads/analisar-ads";
import type { Handler } from "../tipos";

export const handlerDetectarAds: Handler = async ({ db, job, log }) => {
  if (!job.lead_id) {
    throw new Error('job "detectar_ads" sem lead_id');
  }
  const r = await analisarAds({ db }, job.lead_id);
  log("deteccao de anuncios terminou", {
    status: r.status,
    veredito: r.veredito ?? "-",
    confianca: r.confianca ?? "-",
    meta: r.metaAds ?? "-",
  });
};
