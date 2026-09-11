// Orquestrador da analise tecnica de um site (1 lead).
//
//  lead -> cache? -> SSRF -> baixar -> extrair sinais -> PageSpeed (opcional)
//  -> upsert em site_analyses
//
// Regra de robustez: erro do SITE (fora do ar, TLS, SSRF, timeout, HTML gigante)
// e RESULTADO — vira uma linha em site_analyses com `erro` preenchido, e o job
// e considerado concluido. So erro de BANCO relanca (o worker faz retry).

import type { SupabaseClient } from "@supabase/supabase-js";
import { carregarGuardaConfig, chamarComGuardas, type PlanoDeChamada } from "@/lib/guardas";
import { criarStoreSupabase } from "@/lib/guardas/store-supabase";
import type { ContextoDescoberta } from "@/lib/sources/types";
import { ErroGoogle, mensagemAmigavel } from "@/lib/descoberta/erros";
import { baixarPagina, type OpcoesBaixar } from "./baixar";
import { extrairSinais, notaMobile } from "./sinais";
import { medirPageSpeed } from "./pagespeed";
import { validarUrlPublica, ErroSSRF } from "./ssrf";
import type { ResultadoAnaliseSite, ResultadoPageSpeed } from "./tipos";

export type DepsAnaliseSite = {
  db: SupabaseClient;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  baixarOpts?: OpcoesBaixar;
  pagespeedFetch?: typeof fetch;
  /** override so para teste */
  agora?: () => Date;
};

const MS_DIA = 86_400_000;

export async function analisarSite(
  deps: DepsAnaliseSite,
  leadId: string,
  opts: { forcar?: boolean } = {},
): Promise<ResultadoAnaliseSite> {
  const { db } = deps;
  const agora = deps.agora ? deps.agora() : new Date();
  const config = carregarGuardaConfig();

  const { data: lead, error: errLead } = await db
    .from("leads")
    .select("id, nome, site_url")
    .eq("id", leadId)
    .maybeSingle();
  if (errLead) throw new Error(`leads: ${errLead.message}`);
  if (!lead) throw new Error(`lead ${leadId} nao encontrado`);

  // cache: ja analisado ha pouco?
  if (!opts.forcar) {
    const { data: anterior } = await db
      .from("site_analyses")
      .select("verificado_em")
      .eq("lead_id", leadId)
      .maybeSingle();
    if (anterior?.verificado_em) {
      const idadeDias = (agora.getTime() - new Date(anterior.verificado_em).getTime()) / MS_DIA;
      if (idadeDias < config.ttlSiteDias) {
        return { status: "pulado-cache", leadId };
      }
    }
  }

  const siteUrl = typeof lead.site_url === "string" ? lead.site_url.trim() : "";
  if (!siteUrl) {
    await gravar(db, leadId, agora, {
      site_existe: false,
      erro: "lead sem site_url",
    });
    return { status: "sem-site", leadId };
  }

  // SSRF: valida antes de qualquer acesso
  try {
    await validarUrlPublica(siteUrl, { resolver: deps.baixarOpts?.resolver });
  } catch (e) {
    if (e instanceof ErroSSRF) {
      await gravar(db, leadId, agora, {
        site_existe: null,
        url_final: siteUrl,
        erro: `URL bloqueada por seguranca (SSRF): ${e.motivo}`,
      });
      return { status: "bloqueado-ssrf", leadId, erro: e.motivo };
    }
    throw e;
  }

  const resp = await baixarPagina(siteUrl, { fetchImpl: deps.fetchImpl, ...deps.baixarOpts });
  const httpsFinal = safeProtocolo(resp.urlFinal) === "https:" || safeProtocolo(siteUrl) === "https:";

  if (!resp.respondeu) {
    await gravar(db, leadId, agora, {
      site_existe: false,
      https: httpsFinal,
      status_http: resp.status,
      url_final: resp.urlFinal,
      qtd_redirects: resp.redirects,
      tls_ok: resp.tlsOk,
      tls_erro: resp.tlsErro,
      ttfb_ms: resp.ttfbMs,
      erro: resp.erro,
    });
    return { status: "site-falhou", leadId, erro: resp.erro ?? "site nao respondeu" };
  }

  const sinais = extrairSinais(resp.html, resp.urlFinal, resp.headers);

  // PageSpeed opcional
  let ps: ResultadoPageSpeed | null = null;
  let psErro: string | null = null;
  if (config.pagespeedAtivo && deps.apiKey && (resp.status ?? 0) < 400) {
    const store = criarStoreSupabase(db);
    const ctx: ContextoDescoberta = {
      chamarComGuardas: (plano, executar) =>
        chamarComGuardas(store, plano as PlanoDeChamada, executar),
    };
    try {
      ps = await medirPageSpeed(ctx, deps.apiKey, resp.urlFinal, {
        fetchImpl: deps.pagespeedFetch ?? deps.fetchImpl,
      });
    } catch (e) {
      psErro = e instanceof ErroGoogle ? `${e.tipo}: ${mensagemAmigavel(e.tipo)}` : String(e);
    }
  }

  await gravar(db, leadId, agora, {
    site_existe: true,
    url_final: resp.urlFinal,
    https: httpsFinal,
    status_http: resp.status,
    qtd_redirects: resp.redirects,
    tls_ok: resp.tlsOk,
    tls_erro: resp.tlsErro,
    tem_viewport: sinais.temViewport,
    nota_mobile: notaMobile(sinais),
    nota_desempenho: ps?.performance ?? null,
    peso_kb: Math.round(resp.tamanhoBytes / 1024) || null,
    ttfb_ms: ps?.ttfbMs != null ? Math.round(ps.ttfbMs) : resp.ttfbMs,
    tem_whatsapp: sinais.temWhatsapp,
    tem_telefone: sinais.temTelefone,
    tem_formulario: sinais.temFormulario,
    tem_cta: sinais.temCta,
    tem_pagina_contato: sinais.temPaginaContato,
    tem_meta_pixel: sinais.temMetaPixel,
    tem_ga: sinais.temGa,
    tem_gtm: sinais.temGtm,
    tem_google_ads: sinais.temGoogleAds,
    tem_doubleclick: sinais.temDoubleclick,
    titulo: sinais.titulo,
    servidor: sinais.servidor,
    stack: sinais.stack,
    sinais: {
      responsividade: sinais.responsividade,
      viewportDeviceWidth: sinais.viewportDeviceWidth,
      redesSociais: sinais.redesSociais,
      evidencias: sinais.evidencias,
      resumoTextual: sinais.resumoTextual,
      truncado: resp.truncado,
      content_type: resp.contentType,
      pagespeed: ps,
      pagespeed_erro: psErro,
    },
    erro: resp.erro, // pode haver aviso mesmo com respondeu=true (ex.: HTML truncado)
  });

  return { status: "ok", leadId };
}

function safeProtocolo(u: string): string | null {
  try {
    return new URL(u).protocol;
  } catch {
    return null;
  }
}

type LinhaSite = Record<string, unknown>;

async function gravar(
  db: SupabaseClient,
  leadId: string,
  agora: Date,
  campos: LinhaSite,
): Promise<void> {
  const { error } = await db.from("site_analyses").upsert(
    {
      lead_id: leadId,
      verificado_em: agora.toISOString(),
      // zera campos que podem ter ficado de uma analise anterior
      site_existe: null,
      url_final: null,
      https: null,
      status_http: null,
      tem_viewport: null,
      nota_mobile: null,
      nota_desempenho: null,
      peso_kb: null,
      ttfb_ms: null,
      tem_whatsapp: null,
      tem_telefone: null,
      tem_formulario: null,
      tem_cta: null,
      tem_pagina_contato: null,
      tem_meta_pixel: null,
      tem_ga: null,
      tem_gtm: null,
      tem_google_ads: null,
      tem_doubleclick: null,
      tls_ok: null,
      tls_erro: null,
      qtd_redirects: null,
      titulo: null,
      servidor: null,
      stack: null,
      sinais: null,
      erro: null,
      ...campos,
    },
    { onConflict: "lead_id" },
  );
  if (error) throw new Error(`site_analyses upsert: ${error.message}`);
}
