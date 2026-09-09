// Handler do job "analisar_site": roda a analise tecnica do site de 1 lead.
//
// Erro do site (fora do ar, TLS, SSRF, timeout) NAO e erro de job — analisarSite
// grava isso em site_analyses.erro e retorna normalmente. So erro de banco
// (analisarSite relanca) faz o laco reagendar o job.

import { analisarSite } from "@/lib/analise-site/analisar";
import { enfileirarScores } from "@/lib/score/enfileirar";
import { enfileirarDetecaoAds } from "@/lib/ads/enfileirar";
import type { Handler } from "../tipos";

export const handlerAnalisarSite: Handler = async ({ db, job, log }) => {
  if (!job.lead_id) {
    throw new Error('job "analisar_site" sem lead_id');
  }
  const apiKey = process.env.GOOGLE_MAPS_API_KEY; // usado so se PageSpeed estiver ligado

  const r = await analisarSite({ db, apiKey }, job.lead_id);

  log("analise de site terminou", { status: r.status, erro: r.erro });

  // com o boletim novo: recalcula o score e detecta indicios de anuncio
  // (best-effort: nada disso derruba a analise de site)
  try {
    await enfileirarScores(db, { leadIds: [job.lead_id] });
  } catch (e) {
    log("nao enfileirou calcular_score", { erro: e instanceof Error ? e.message : String(e) });
  }
  try {
    await enfileirarDetecaoAds(db, { leadIds: [job.lead_id] });
  } catch (e) {
    log("nao enfileirou detectar_ads", { erro: e instanceof Error ? e.message : String(e) });
  }
};
