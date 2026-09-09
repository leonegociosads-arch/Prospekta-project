// Le do banco tudo que a formula do score precisa: o lead + o boletim de site.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntradaScore } from "./tipos";

export type EntradaColetada = { nome: string; entrada: EntradaScore };

export async function coletarEntradaScore(
  db: SupabaseClient,
  leadId: string,
): Promise<EntradaColetada | null> {
  const { data: lead, error } = await db
    .from("leads")
    .select(
      "id, nome, status_negocio, avaliacao, qtd_avaliacoes, telefone, site_url, instagram_url, facebook_url",
    )
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(`leads: ${error.message}`);
  if (!lead) return null;

  const { data: a, error: errA } = await db
    .from("site_analyses")
    .select(
      "site_existe, https, tls_ok, status_http, tem_viewport, nota_mobile, nota_desempenho, peso_kb, ttfb_ms, tem_whatsapp, tem_formulario, tem_cta, tem_pagina_contato, tem_meta_pixel, tem_ga, tem_gtm, tem_google_ads, tem_doubleclick, erro",
    )
    .eq("lead_id", leadId)
    .maybeSingle();
  if (errA) throw new Error(`site_analyses: ${errA.message}`);

  const entrada: EntradaScore = {
    statusNegocio: lead.status_negocio ?? null,
    avaliacao: lead.avaliacao ?? null,
    qtdAvaliacoes: lead.qtd_avaliacoes ?? null,
    telefone: lead.telefone ?? null,
    siteUrl: lead.site_url ?? null,
    instagramUrl: lead.instagram_url ?? null,
    facebookUrl: lead.facebook_url ?? null,
    analiseSite: a
      ? {
          siteExiste: a.site_existe ?? null,
          https: a.https ?? null,
          tlsOk: a.tls_ok ?? null,
          statusHttp: a.status_http ?? null,
          temViewport: a.tem_viewport ?? null,
          notaMobile: a.nota_mobile ?? null,
          notaDesempenho: a.nota_desempenho ?? null,
          pesoKb: a.peso_kb ?? null,
          ttfbMs: a.ttfb_ms ?? null,
          temWhatsapp: a.tem_whatsapp ?? null,
          temFormulario: a.tem_formulario ?? null,
          temCta: a.tem_cta ?? null,
          temPaginaContato: a.tem_pagina_contato ?? null,
          temMetaPixel: a.tem_meta_pixel ?? null,
          temGa: a.tem_ga ?? null,
          temGtm: a.tem_gtm ?? null,
          temGoogleAds: a.tem_google_ads ?? null,
          temDoubleclick: a.tem_doubleclick ?? null,
          erro: a.erro ?? null,
        }
      : null,
  };

  return { nome: lead.nome as string, entrada };
}
