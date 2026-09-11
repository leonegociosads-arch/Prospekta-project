// Deriva "pontos fortes" e "pontos fracos" OBJETIVOS de um lead a partir do que
// o Prospekta ja mediu — sem IA e sem inventar nada. Cada item carrega a
// evidencia real que o sustenta (a tag que aparece ao lado na tela).
//
// Funcao PURA: recebe os dados ja carregados, devolve as listas. Testavel.
//
// Regra de ouro do projeto: ausencia de evidencia NUNCA vira afirmacao. Por
// isso "nenhum indicio de trafego pago" e escrito como falta de sinal, e nao
// como "a empresa nao anuncia".

export type SinalObjetivo = {
  texto: string;
  /** de onde saiu esse item: vira a tag discreta ao lado */
  evidencia: string;
  /** true = problema real; false/ausente = ponto de atencao */
  grave?: boolean;
};

export type SinaisObjetivos = {
  fortes: SinalObjetivo[];
  fracos: SinalObjetivo[];
};

export type DadosLeadSinais = {
  lead: {
    telefone: string | null;
    site_url: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
    avaliacao: number | null;
    qtd_avaliacoes: number | null;
    status_negocio: string | null;
  };
  site: {
    site_existe: boolean | null;
    status_http: number | null;
    ttfb_ms: number | null;
    nota_mobile: number | null;
    tem_viewport: boolean | null;
    tem_whatsapp: boolean | null;
    tem_formulario: boolean | null;
    tem_cta: boolean | null;
    tem_meta_pixel: boolean | null;
    tem_ga: boolean | null;
    erro: string | null;
  } | null;
  ads: {
    veredito: string | null;
    confianca: string | null;
  } | null;
  sociais: Array<{ plataforma: string; status: string | null }>;
};

const TTFB_LENTO_MS = 2500;
const NOTA_BOA = 4;
const MUITAS_AVALIACOES = 100;
const POUCAS_AVALIACOES = 10;
const MOBILE_BOM = 70;

const FONTE_PLACES = "Google Places";
const FONTE_SITE = "análise de site";
const FONTE_SOCIAL = "análise social";

export function derivarSinaisObjetivos(d: DadosLeadSinais): SinaisObjetivos {
  const fortes: SinalObjetivo[] = [];
  const fracos: SinalObjetivo[] = [];
  const { lead, site, ads, sociais } = d;

  // ---------------------------------------------------------------- reputacao
  const nota = lead.avaliacao;
  const qtd = lead.qtd_avaliacoes ?? 0;

  if (nota != null && nota >= NOTA_BOA && qtd >= POUCAS_AVALIACOES) {
    fortes.push({
      texto: `Reputação boa: nota ${nota} com ${qtd} avaliações`,
      evidencia: FONTE_PLACES,
    });
  }
  if (qtd >= MUITAS_AVALIACOES) {
    fortes.push({
      texto: `Volume alto de avaliações (${qtd}) — é um negócio com movimento real`,
      evidencia: FONTE_PLACES,
    });
  }
  if (nota != null && nota < NOTA_BOA) {
    fracos.push({
      texto: `Nota abaixo de ${NOTA_BOA.toFixed(1)} no Google (${nota})`,
      evidencia: `${qtd} avaliações`,
    });
  }
  if (qtd > 0 && qtd < POUCAS_AVALIACOES) {
    fracos.push({
      texto: `Poucas avaliações (${qtd}) — pouca prova social pública`,
      evidencia: FONTE_PLACES,
    });
  }

  if (lead.status_negocio === "OPERATIONAL") {
    fortes.push({ texto: "Negócio operacional segundo o Google", evidencia: FONTE_PLACES });
  } else if (lead.status_negocio && lead.status_negocio.startsWith("CLOSED")) {
    fracos.push({
      texto: `O Google marca este negócio como ${lead.status_negocio}`,
      evidencia: FONTE_PLACES,
      grave: true,
    });
  }

  // ----------------------------------------------------------------- contato
  if ((lead.telefone ?? "").trim() !== "") {
    fortes.push({ texto: "Telefone público para contato", evidencia: FONTE_PLACES });
  } else {
    fracos.push({ texto: "Sem telefone público no Google", evidencia: FONTE_PLACES });
  }

  // -------------------------------------------------------------------- site
  const temUrl = (lead.site_url ?? "").trim() !== "";

  if (!temUrl) {
    fracos.push({
      texto: "Sem site — quem procura no Google não encontra onde comprar ou pedir",
      evidencia: FONTE_PLACES,
      grave: true,
    });
  } else if (!site) {
    fracos.push({ texto: "Site ainda não analisado", evidencia: "aguardando análise" });
  } else {
    const httpRuim = site.status_http != null && site.status_http >= 400;

    if (site.erro || site.site_existe === false) {
      fracos.push({
        texto: "Site não respondeu",
        evidencia: site.status_http ? `HTTP ${site.status_http}` : (site.erro ?? FONTE_SITE),
        grave: true,
      });
    } else if (httpRuim) {
      fracos.push({
        texto: "Site responde com erro",
        evidencia: `HTTP ${site.status_http}`,
        grave: true,
      });
    } else if (site.site_existe === true) {
      fortes.push({
        texto: "Site no ar e respondendo",
        evidencia: site.status_http ? `HTTP ${site.status_http}` : FONTE_SITE,
      });
    }

    const siteNoAr = site.site_existe === true && !site.erro && !httpRuim;

    if (siteNoAr && site.ttfb_ms != null && site.ttfb_ms > TTFB_LENTO_MS) {
      fracos.push({ texto: "Site lento para abrir", evidencia: `TTFB ${site.ttfb_ms} ms` });
    }
    if (site.nota_mobile != null && site.nota_mobile >= MOBILE_BOM) {
      fortes.push({
        texto: `Site adaptado para celular (${site.nota_mobile}/100)`,
        evidencia: FONTE_SITE,
      });
    }
    if (site.tem_viewport === false) {
      fracos.push({
        texto: "Site não adaptado para celular",
        evidencia: "sem meta viewport",
        grave: true,
      });
    }
    if (site.tem_whatsapp === true) {
      fortes.push({ texto: "WhatsApp no site — cliente entra sem fricção", evidencia: FONTE_SITE });
    } else if (site.tem_whatsapp === false) {
      fracos.push({ texto: "Sem link de WhatsApp no site", evidencia: FONTE_SITE });
    }
    if (site.tem_cta === true) {
      fortes.push({ texto: "Site tem chamada para ação", evidencia: FONTE_SITE });
    } else if (site.tem_cta === false) {
      fracos.push({ texto: "Sem chamada para ação (CTA) no site", evidencia: FONTE_SITE });
    }
    if (site.tem_formulario === true) {
      fortes.push({ texto: "Site tem formulário de contato", evidencia: FONTE_SITE });
    } else if (site.tem_formulario === false) {
      fracos.push({ texto: "Sem formulário de contato no site", evidencia: FONTE_SITE });
    }
    if (site.tem_meta_pixel === false && site.tem_ga === false) {
      fracos.push({
        texto: "Sem pixel e sem analytics — hoje não dá para medir nada",
        evidencia: FONTE_SITE,
      });
    }
  }

  // ---------------------------------------------------------------- anuncios
  if (ads?.veredito === "forte" || ads?.veredito === "alguns") {
    fortes.push({
      texto:
        ads.veredito === "forte"
          ? "Indícios fortes de tráfego pago — já investe em marketing"
          : "Alguns indícios de tráfego pago",
      evidencia: ads.confianca ? `confiança ${ads.confianca}` : "detecção de anúncios",
    });
  } else if (ads?.veredito === "nenhum") {
    // NUNCA "nao anuncia": e ausencia de evidencia, nao prova
    fracos.push({
      texto: "Nenhum indício de tráfego pago encontrado (não confirma que não anuncia)",
      evidencia: "detecção de anúncios",
    });
  }

  // ------------------------------------------------------------------- redes
  const encontrada = (p: string) => sociais.some((s) => s.plataforma === p && s.status === "encontrado");
  const temLinkIg = (lead.instagram_url ?? "").trim() !== "";
  const temLinkFb = (lead.facebook_url ?? "").trim() !== "";

  if (encontrada("instagram")) {
    fortes.push({ texto: "Instagram encontrado e ativo", evidencia: FONTE_SOCIAL });
  } else if (temLinkIg) {
    fortes.push({ texto: "Tem link de Instagram", evidencia: FONTE_PLACES });
  }
  if (encontrada("facebook")) {
    fortes.push({ texto: "Facebook encontrado", evidencia: FONTE_SOCIAL });
  }
  if (!temLinkIg && !temLinkFb) {
    fracos.push({ texto: "Nenhuma rede social localizada", evidencia: "site + Google" });
  }

  // graves primeiro, para o que dói aparecer no topo da lista
  fracos.sort((a, b) => Number(b.grave ?? false) - Number(a.grave ?? false));

  return { fortes, fracos };
}
