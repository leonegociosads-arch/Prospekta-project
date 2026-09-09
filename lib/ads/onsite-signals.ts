// Sinais de trafego pago tirados do PROPRIO site do lead (site_analyses).
// PURO: recebe a linha do site_analyses, devolve os sinais + evidencias.
// Sem rede, sem IA.

import type { SinaisNoSite, SinalAds } from "./tipos";

type LinhaSite = {
  tem_google_ads?: boolean | null;
  tem_doubleclick?: boolean | null;
  tem_meta_pixel?: boolean | null;
  tem_gtm?: boolean | null;
  sinais?: unknown;
};

/** Pesos: quanto cada sinal empurra para "esta empresa faz trafego pago". */
const PESO = {
  tagConversaoGoogle: 0.55, // AW- / googleadservices / /pagead/conversion : so serve para medir anuncio
  remarketingDoubleclick: 0.45, // google_remarketing_only / doubleclick : retargeting ativo
  parametrosCampanha: 0.35, // links do proprio site com utm_/gclid/fbclid : campanhas marcadas
  metaPixel: 0.25, // pixel sozinho e fraco (pode ser so medicao)
  gtm: 0.1, // tag manager sozinho quase nao diz nada
} as const;

function evidenciaDe(evidencias: Record<string, unknown>, chave: string, padrao: string): string {
  const v = evidencias[chave];
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return v[0].slice(0, 160);
  return padrao;
}

export function extrairSinaisNoSite(site: LinhaSite | null): SinaisNoSite | null {
  if (!site) return null;

  const blob = (site.sinais ?? {}) as { evidencias?: Record<string, unknown> };
  const ev = blob.evidencias ?? {};

  const temTagConversaoGoogle = site.tem_google_ads === true;
  const temRemarketingDoubleclick = site.tem_doubleclick === true;
  const temMetaPixel = site.tem_meta_pixel === true;
  const temGtm = site.tem_gtm === true;
  const temParametrosCampanha = Array.isArray(ev.parametrosCampanha) && ev.parametrosCampanha.length > 0;

  const sinais: SinalAds[] = [];
  const add = (cond: boolean, chave: string, rotulo: string, peso: number, evChave: string, padrao: string) => {
    if (cond) sinais.push({ chave, rotulo, peso, evidencia: evidenciaDe(ev, evChave, padrao) });
  };

  add(temTagConversaoGoogle, "tag_conversao_google", "Tag de conversão do Google Ads", PESO.tagConversaoGoogle, "googleAds", "tag de conversão do Google Ads no site");
  add(temRemarketingDoubleclick, "remarketing_doubleclick", "Remarketing / DoubleClick", PESO.remarketingDoubleclick, "doubleclick", "código de remarketing (DoubleClick) no site");
  add(temParametrosCampanha, "parametros_campanha", "Parâmetros de campanha nos links", PESO.parametrosCampanha, "parametrosCampanha", "links com utm_/gclid/fbclid");
  add(temMetaPixel, "meta_pixel", "Meta Pixel", PESO.metaPixel, "metaPixel", "Meta Pixel no site");
  add(temGtm, "gtm", "Google Tag Manager", PESO.gtm, "gtm", "GTM no site");

  return {
    temTagConversaoGoogle,
    temRemarketingDoubleclick,
    temMetaPixel,
    temGtm,
    temParametrosCampanha,
    sinais,
  };
}
