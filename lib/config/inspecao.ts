// Monta o conteudo da tela /config (so leitura). Puro e testavel:
// nao toca no banco - a agregacao de api_usage do mes e feita na page e passada
// para resumirUso(). So e importado por app/config/page.tsx (server component);
// nunca devolve o valor de um segredo, so rotulos/booleanos para exibir.

import {
  carregarGuardaConfig,
  numeroDeEnv,
  LIMITES_GUARDA,
} from "@/lib/guardas/config";
import { carregarConfigIa, LIMITES_IA } from "@/lib/ia/config-ia";
import { PRECOS_IA, precoDoModelo, estimarCustoUsd } from "@/lib/ia/custos";
import { PESOS, ROTULOS, VERSAO_FORMULA } from "@/lib/score/calcular";
import { estimarConsumo, LIMITES as LIMITES_PESQUISA } from "@/lib/pesquisa/estimativa";

export type LinhaConfig = {
  rotulo: string;
  envVar?: string;
  valor: string;
  faixa?: string;
  /** aviso amarelo: valor ajustado ou escolha arriscada */
  aviso?: string;
};

export type BlocoConfig = { titulo: string; descricao?: string; linhas: LinhaConfig[] };

function brutoEnv(nome: string): number | null {
  const b = process.env[nome];
  if (b === undefined || b.trim() === "") return null;
  const n = Number(b);
  return Number.isFinite(n) ? n : null;
}

function linhaNum(
  rotulo: string,
  envVar: string,
  efetivo: number,
  faixa: { min: number; max: number },
  sufixo = "",
): LinhaConfig {
  const bruto = brutoEnv(envVar);
  const linha: LinhaConfig = {
    rotulo,
    envVar,
    valor: `${efetivo}${sufixo}`,
    faixa: `${faixa.min} a ${faixa.max}${sufixo}`,
  };
  if (bruto !== null && bruto !== efetivo) {
    linha.aviso = `Você definiu ${bruto}${sufixo}; foi ajustado para ${efetivo}${sufixo} (fora da faixa segura).`;
  }
  return linha;
}

// ------------------------------------------------------------ limites internos

export function blocoLimitesInternos(): BlocoConfig {
  const g = carregarGuardaConfig();
  const ia = carregarConfigIa();

  const linhas: LinhaConfig[] = [
    linhaNum(
      "Teto de chamadas externas / mês",
      "PROSPEKTA_TETO_MENSAL_CHAMADAS",
      g.tetoMensalChamadas,
      LIMITES_GUARDA.tetoMensalChamadas,
    ),
    linhaNum("Teto de gasto com IA / mês (US$)", "PROSPEKTA_IA_TETO_MENSAL_USD", ia.tetoMensalUsd, LIMITES_IA.tetoMensalUsd),
    linhaNum("Score mínimo para diagnóstico IA", "PROSPEKTA_IA_SCORE_MINIMO", ia.scoreMinimo, LIMITES_IA.scoreMinimo),
    linhaNum("Top N por pesquisa (IA)", "PROSPEKTA_IA_TOP_N", ia.topN, LIMITES_IA.topN),
  ];

  if (ia.tetoMensalUsd === 0) {
    linhas[1].aviso = "Teto US$ 0 — o diagnóstico com IA está desligado.";
  }
  if (ia.scoreMinimo > 0 && ia.scoreMinimo < 40) {
    linhas[2].aviso =
      (linhas[2].aviso ? linhas[2].aviso + " " : "") +
      "Score mínimo baixo: a IA vai rodar em quase todos os leads pontuados.";
  }

  return {
    titulo: "Limites internos",
    descricao:
      "Travas de segurança para não gastar sem querer. Valores fora da faixa são ajustados automaticamente.",
    linhas,
  };
}

// ------------------------------------------------------------ TTL de cache

const FAIXA_TTL = { min: 1, max: 365 };

export function blocoTtlCache(): BlocoConfig {
  const g = carregarGuardaConfig();
  return {
    titulo: "Validade do cache (TTL)",
    descricao: "Antes desse prazo, o Prospekta reaproveita o que já está no banco em vez de chamar de novo.",
    linhas: [
      linhaNum("Busca no Google (Text Search)", "PROSPEKTA_CACHE_TTL_BUSCA_DIAS", g.ttlBuscaDias, LIMITES_GUARDA.ttlBuscaDias, " dias"),
      linhaNum("Detalhes do lugar (Place Details)", "PROSPEKTA_CACHE_TTL_DETALHES_DIAS", g.ttlDetalhesDias, LIMITES_GUARDA.ttlDetalhesDias, " dias"),
      linhaNum("Boletim técnico do site", "PROSPEKTA_CACHE_TTL_SITE_DIAS", g.ttlSiteDias, LIMITES_GUARDA.ttlSiteDias, " dias"),
      linhaNum("Presença social", "PROSPEKTA_CACHE_TTL_SOCIAL_DIAS", g.ttlSocialDias, LIMITES_GUARDA.ttlSocialDias, " dias"),
      linhaNum("Indícios de anúncio", "PROSPEKTA_CACHE_TTL_ADS_DIAS", numeroDeEnv("PROSPEKTA_CACHE_TTL_ADS_DIAS", { ...FAIXA_TTL, padrao: 21 }), FAIXA_TTL, " dias"),
      linhaNum("Diagnóstico com IA", "PROSPEKTA_IA_TTL_DIAS", carregarConfigIa().ttlDias, LIMITES_IA.ttlDias, " dias"),
    ],
  };
}

// ------------------------------------------------------------ IA / provedores

export function blocoIa(): BlocoConfig {
  const ia = carregarConfigIa();
  const preco = precoDoModelo(ia.modelo);
  // dossie tipico: ~2000 tokens de entrada, ~700 de saida
  const custoPorLead = estimarCustoUsd(ia.modelo, 2000, 700);
  const conhecido = ia.modelo in PRECOS_IA;

  const linhas: LinhaConfig[] = [
    {
      rotulo: "Modelo",
      envVar: "PROSPEKTA_IA_MODELO",
      valor: ia.modelo,
      aviso: conhecido
        ? undefined
        : "Modelo sem preço conhecido na tabela — o custo é estimado com tarifa conservadora.",
    },
    {
      rotulo: "Preço do modelo (entrada / saída)",
      valor: `US$ ${preco.entradaPorMilhao} / US$ ${preco.saidaPorMilhao} por 1M de tokens`,
    },
    { rotulo: "Custo estimado por lead", valor: `≈ US$ ${custoPorLead.toFixed(5)}` },
    {
      rotulo: "Diagnósticos possíveis dentro do teto",
      valor:
        ia.tetoMensalUsd > 0 && custoPorLead > 0
          ? `≈ ${Math.floor(ia.tetoMensalUsd / custoPorLead).toLocaleString("pt-BR")} / mês`
          : "—",
    },
    { rotulo: "Temperatura", envVar: "PROSPEKTA_IA_TEMPERATURA", valor: String(ia.temperatura) },
  ];
  return {
    titulo: "IA (diagnóstico comercial)",
    descricao: "A IA só roda depois do score, nos leads elegíveis (score mínimo ou top N) ou sob clique.",
    linhas,
  };
}

// ------------------------------------------------------------ PageSpeed

export function blocoFontesOpcionais(): BlocoConfig {
  const g = carregarGuardaConfig();
  const temTokenMeta = (process.env.META_AD_LIBRARY_TOKEN ?? "").trim() !== "";
  return {
    titulo: "Fontes externas opcionais",
    linhas: [
      {
        rotulo: "PageSpeed na análise de site",
        envVar: "PROSPEKTA_PAGESPEED",
        valor: g.pagespeedAtivo ? "ligado" : "desligado",
        aviso: g.pagespeedAtivo
          ? "Ligado: mais lento e sujeito à cota gratuita do PageSpeed (~25 mil/dia)."
          : undefined,
      },
      {
        rotulo: "Meta Ad Library (indícios de anúncio)",
        envVar: "META_AD_LIBRARY_TOKEN",
        valor: temTokenMeta ? "configurada" : "desligada",
        aviso: temTokenMeta
          ? "A API oficial cobre pouco do comércio no Brasil — o resultado costuma ser 'desconhecido'. O veredito vem principalmente dos sinais do site."
          : "Sem token: o veredito de anúncios usa só os sinais do próprio site.",
      },
    ],
  };
}

// ------------------------------------------------------------ estimativa de consumo

export function blocoEstimativaConsumo(): BlocoConfig {
  const cheia = estimarConsumo(LIMITES_PESQUISA.leadsMax);
  return {
    titulo: "Estimativa de consumo por pesquisa",
    linhas: [
      { rotulo: "Descoberta (Google Places)", valor: `${cheia.chamadasMin} a ${cheia.chamadasMax} chamadas (1 busca + até 1 geocodificação)` },
      { rotulo: "Análise de site", valor: "0 chamadas pagas (código próprio); PageSpeed só se ligado" },
      { rotulo: "Score", valor: "0 chamadas (fórmula local)" },
      { rotulo: "Enriquecimento (Place Details)", valor: "1 chamada por lead, só sob clique" },
      { rotulo: "Diagnóstico IA", valor: "1 chamada por lead elegível, respeitando o teto US$/mês" },
    ],
  };
}

// ------------------------------------------------------------ pesos do score

export function blocoPesosScore(): BlocoConfig {
  const total = Object.values(PESOS).reduce((s, n) => s + n, 0);
  return {
    titulo: `Pesos do Score de Oportunidade · fórmula ${VERSAO_FORMULA}`,
    descricao: "Fórmula determinística, sem IA. Muda só com nova versão.",
    linhas: [
      ...(Object.keys(PESOS) as Array<keyof typeof PESOS>).map((k) => ({
        rotulo: ROTULOS[k],
        valor: `peso ${PESOS[k]}`,
      })),
      { rotulo: "Total", valor: `${total} (máx. do score)` },
    ],
  };
}

// ------------------------------------------------------------ uso do mes (recebe rows do banco)

export type UsoBruto = {
  provedor: string | null;
  endpoint: string | null;
  unidades: number | null;
  custo_estimado_usd: number | null;
};

export type ResumoUso = {
  googleTotal: number;
  iaTotal: number;
  metaTotal: number;
  custoUsdTotal: number;
  porEndpoint: Array<{ provedor: string; endpoint: string; chamadas: number; custoUsd: number }>;
};

const ROTULO_ENDPOINT: Record<string, string> = {
  text_search: "Busca (Text Search)",
  place_details: "Detalhes (Place Details)",
  geocoding: "Geocodificação",
  pagespeed: "PageSpeed",
  ia_diagnosis: "Diagnóstico IA",
  meta_ad_library: "Meta Ad Library",
};

export function rotularEndpoint(endpoint: string): string {
  return ROTULO_ENDPOINT[endpoint] ?? endpoint;
}

export function resumirUso(rows: UsoBruto[]): ResumoUso {
  const mapa = new Map<string, { provedor: string; endpoint: string; chamadas: number; custoUsd: number }>();
  let googleTotal = 0;
  let iaTotal = 0;
  let metaTotal = 0;
  let custoUsdTotal = 0;

  for (const r of rows) {
    const provedor = r.provedor ?? "?";
    const endpoint = r.endpoint ?? "?";
    const unidades = Number(r.unidades ?? 0) || 0;
    const custo = Number(r.custo_estimado_usd ?? 0) || 0;
    const chave = `${provedor}|${endpoint}`;
    const atual = mapa.get(chave) ?? { provedor, endpoint, chamadas: 0, custoUsd: 0 };
    atual.chamadas += unidades;
    atual.custoUsd += custo;
    mapa.set(chave, atual);
    if (provedor === "google") googleTotal += unidades;
    if (provedor === "ia") iaTotal += unidades;
    if (provedor === "meta") metaTotal += unidades;
    custoUsdTotal += custo;
  }

  return {
    googleTotal,
    iaTotal,
    metaTotal,
    custoUsdTotal: Math.round(custoUsdTotal * 1e6) / 1e6,
    porEndpoint: [...mapa.values()].sort((a, b) => b.chamadas - a.chamadas),
  };
}
