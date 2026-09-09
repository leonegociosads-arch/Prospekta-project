// Combina os sinais do site + o resultado da Meta Ad Library num veredito.
// PURO e determinístico. Sem IA.
//
// Regra de ouro (plano, secao 12): "nenhum indicio" NUNCA vira "nao anuncia"
// com confianca alta. Site sem tag pode significar so que anuncia para uma
// landing fora, ou so no Meta sem pixel.

import type { Diagnostico, ResultadoMetaAdLibrary, SinaisNoSite } from "./tipos";

export function montarVeredito(
  site: SinaisNoSite | null,
  meta: ResultadoMetaAdLibrary | null,
): Diagnostico {
  const evidencias: string[] = [];

  // 1) Meta Ad Library confirmou anuncios ativos -> nada supera isso
  if (meta?.encontrado === "sim") {
    if (meta.detalhe) evidencias.push(meta.detalhe);
    for (const s of site?.sinais ?? []) evidencias.push(`${s.rotulo}: ${s.evidencia}`);
    return {
      veredito: "forte",
      confianca: "alta",
      evidencias,
      resumo: "Anúncios ativos encontrados na Meta Ad Library.",
    };
  }

  if (meta && meta.encontrado === "desconhecido" && meta.detalhe) {
    evidencias.push(`Meta Ad Library: ${meta.detalhe}`);
  }

  // 2) site nao analisado e Meta nao confirmou -> sem base
  if (!site) {
    return {
      veredito: null,
      confianca: "baixa",
      evidencias,
      resumo: "Sem base para opinar: o site do lead ainda não foi analisado.",
    };
  }

  for (const s of site.sinais) evidencias.push(`${s.rotulo}: ${s.evidencia}`);

  const forteNoSite = site.temTagConversaoGoogle || site.temRemarketingDoubleclick;
  const soma = Math.min(1, site.sinais.reduce((t, s) => t + s.peso, 0));
  const acessorios =
    Number(site.temMetaPixel) + Number(site.temParametrosCampanha) + Number(site.temGtm);

  // 3) nenhum sinal
  if (site.sinais.length === 0) {
    return {
      veredito: "nenhum",
      confianca: "baixa",
      evidencias,
      resumo:
        "Nenhum indício de tráfego pago no site. Isso NÃO confirma que a empresa não anuncia " +
        "(pode anunciar para uma página externa, ou só no Instagram/Facebook).",
    };
  }

  // 4) forte pelo site: tag de conversao/remarketing + pelo menos mais um sinal
  if (forteNoSite && (acessorios >= 1 || (site.temTagConversaoGoogle && site.temRemarketingDoubleclick))) {
    return {
      veredito: "forte",
      confianca: "media",
      evidencias,
      resumo: "Site tem tag de conversão/remarketing e outros sinais de campanha — provável tráfego pago.",
    };
  }

  // 5) alguns: um sinal forte sozinho, ou combinacao de acessorios
  if (forteNoSite || soma >= 0.35) {
    return {
      veredito: "alguns",
      confianca: forteNoSite ? "media" : "baixa",
      evidencias,
      resumo: "Alguns sinais de tráfego pago no site — não é conclusivo.",
    };
  }

  // 6) so pixel/gtm fracos
  return {
    veredito: "alguns",
    confianca: "baixa",
    evidencias,
    resumo: "Sinais fracos (só pixel/tag manager). Pode ser apenas medição, não anúncio.",
  };
}
