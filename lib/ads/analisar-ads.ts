// Deteccao de indicios de trafego pago de UM lead.
//
//  lead -> cache? -> sinais do site -> Meta Ad Library (opt-in) -> veredito -> upsert
//
// Robustez: qualquer falha de fonte externa (Meta fora do ar, token invalido,
// teto de chamadas) vira "desconhecido" e o veredito sai so dos sinais do site.
// So erro de BANCO relanca (o worker faz retry).

import type { SupabaseClient } from "@supabase/supabase-js";
import { chamarComGuardas, ErroDeOrcamento, type PlanoDeChamada } from "@/lib/guardas";
import { criarStoreSupabase } from "@/lib/guardas/store-supabase";
import { numeroDeEnv } from "@/lib/guardas/config";
import { extrairSinaisNoSite } from "./onsite-signals";
import { consultarMetaAdLibrary, ErroMeta } from "./meta-ad-library";
import { montarVeredito } from "./veredito";
import type { ResultadoDetecaoAds, ResultadoMetaAdLibrary } from "./tipos";

const MS_DIA = 86_400_000;
const TTL_ADS = { min: 1, max: 365, padrao: 21 };

export type DepsAds = {
  db: SupabaseClient;
  metaToken?: string;
  fetchImpl?: typeof fetch;
  /** injecao para teste: substitui a chamada real a Meta */
  consultarMeta?: typeof consultarMetaAdLibrary;
  agora?: () => Date;
};

export async function analisarAds(
  deps: DepsAds,
  leadId: string,
  opts: { forcar?: boolean } = {},
): Promise<ResultadoDetecaoAds> {
  const { db } = deps;
  const agora = deps.agora ? deps.agora() : new Date();
  const ttlDias = numeroDeEnv("PROSPEKTA_CACHE_TTL_ADS_DIAS", TTL_ADS);

  const { data: lead, error } = await db
    .from("leads")
    .select("id, nome, site_url, facebook_url")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(`leads: ${error.message}`);
  if (!lead) {
    return { status: "lead-nao-encontrado", leadId, veredito: null, confianca: null, metaAds: null };
  }

  // cache
  if (!opts.forcar) {
    const { data: ant } = await db
      .from("ad_signals")
      .select("verificado_em")
      .eq("lead_id", leadId)
      .maybeSingle();
    if (ant?.verificado_em) {
      const dias = (agora.getTime() - new Date(ant.verificado_em).getTime()) / MS_DIA;
      if (dias < ttlDias) {
        return { status: "pulado-cache", leadId, veredito: null, confianca: null, metaAds: null };
      }
    }
  }

  // sinais do proprio site
  const { data: site } = await db
    .from("site_analyses")
    .select("tem_google_ads, tem_doubleclick, tem_meta_pixel, tem_gtm, sinais")
    .eq("lead_id", leadId)
    .maybeSingle();
  const sinaisNoSite = extrairSinaisNoSite(site ?? null);

  // Meta Ad Library (opt-in)
  const token = (deps.metaToken ?? process.env.META_AD_LIBRARY_TOKEN ?? "").trim();
  const termo = String(lead.nome ?? "").trim();
  let meta: ResultadoMetaAdLibrary;

  if (!token) {
    meta = {
      encontrado: "desconhecido",
      quantidade: null,
      fonte: "nao-configurado",
      detalhe: "Meta Ad Library não consultada (META_AD_LIBRARY_TOKEN ausente).",
    };
  } else if (!termo) {
    meta = {
      encontrado: "desconhecido",
      quantidade: null,
      fonte: "erro",
      detalhe: "Lead sem nome para buscar na Meta Ad Library.",
    };
  } else {
    meta = await consultarMetaComGuardas(db, deps, token, termo, agora);
  }

  const diag = montarVeredito(sinaisNoSite, meta);

  const { error: errUp } = await db.from("ad_signals").upsert(
    {
      lead_id: leadId,
      verificado_em: agora.toISOString(),
      meta_ads_encontrado: meta.encontrado, // "sim" | "desconhecido" - nunca "nao"
      meta_ads_qtd: meta.quantidade,
      google_ads_no_site: sinaisNoSite ? sinaisNoSite.temTagConversaoGoogle : null,
      sinais: { onsite: sinaisNoSite, meta },
      veredito: diag.veredito,
      confianca: diag.confianca,
      evidencias: { resumo: diag.resumo, itens: diag.evidencias },
      erro: null,
    },
    { onConflict: "lead_id" },
  );
  if (errUp) throw new Error(`ad_signals upsert: ${errUp.message}`);

  return {
    status: "ok",
    leadId,
    veredito: diag.veredito,
    confianca: diag.confianca,
    metaAds: meta.encontrado,
  };
}

async function consultarMetaComGuardas(
  db: SupabaseClient,
  deps: DepsAds,
  token: string,
  termo: string,
  agora: Date,
): Promise<ResultadoMetaAdLibrary> {
  const consultar = deps.consultarMeta ?? consultarMetaAdLibrary;
  const store = criarStoreSupabase(db);
  const plano: PlanoDeChamada = {
    provedor: "meta",
    endpoint: "meta_ad_library",
    unidades: 1,
    custoEstimadoUsd: 0,
    obs: termo.slice(0, 60),
  };
  try {
    return await chamarComGuardas(
      store,
      plano,
      () => consultar({ token, termo, fetchImpl: deps.fetchImpl }),
      { agora },
    );
  } catch (e) {
    let detalhe = e instanceof Error ? e.message : String(e);
    if (e instanceof ErroMeta) detalhe = `${e.tipo}: ${e.message}`;
    if (e instanceof ErroDeOrcamento) detalhe = `teto de chamadas atingido (${e.motivo})`;
    return { encontrado: "desconhecido", quantidade: null, fonte: "erro", detalhe };
  }
}
