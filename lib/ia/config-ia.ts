// Configuracao do diagnostico com IA. Tudo vem de variaveis de ambiente,
// com valores padrao seguros (ver .env.example).
//
// Escolhas desta instalacao (etapa 14): Gemini 2.0 Flash, teto US$ 5/mes,
// elegivel quando score >= 70 OU entre os 5 melhores da pesquisa.
//
// PROTECAO (etapa 15): todo numero e limitado a uma faixa segura (LIMITES_IA).
// Ex.: PROSPEKTA_IA_TETO_MENSAL_USD=9999 e cortado para o teto maximo; a tela
// /config avisa quando um valor foi ajustado.

import { numeroDeEnv } from "@/lib/guardas/config";

export type ConfigIa = {
  /** id do modelo (ex.: "gemini-2.0-flash"). Precos conhecidos em custos.ts. */
  modelo: string;
  /** score minimo (0-100) para o lead entrar no diagnostico em lote. */
  scoreMinimo: number;
  /** alem do score minimo, os N melhores de cada pesquisa sempre entram. */
  topN: number;
  /** teto DURO de gasto com IA no mes corrente, em USD. Ao atingir, bloqueia. */
  tetoMensalUsd: number;
  /** nao refaz o diagnostico de um lead antes de X dias (se os dados nao mudaram). */
  ttlDias: number;
  /** temperatura do modelo. 0 = mais previsivel, menos "invencao". */
  temperatura: number;
};

export const LIMITES_IA = {
  /** 0 = IA desligada. Teto de 25 para nao virar gasto acidental. */
  tetoMensalUsd: { min: 0, max: 25, padrao: 5 },
  scoreMinimo: { min: 0, max: 100, padrao: 70 },
  /** 0 = so pelo score. 50 leads ja e uma pesquisa inteira. */
  topN: { min: 0, max: 50, padrao: 5 },
  ttlDias: { min: 1, max: 365, padrao: 30 },
  temperatura: { min: 0, max: 2, padrao: 0 },
} as const;

export const MODELO_PADRAO = "gemini-2.0-flash";

export function carregarConfigIa(): ConfigIa {
  return {
    modelo: (process.env.PROSPEKTA_IA_MODELO ?? MODELO_PADRAO).trim() || MODELO_PADRAO,
    scoreMinimo: numeroDeEnv("PROSPEKTA_IA_SCORE_MINIMO", LIMITES_IA.scoreMinimo),
    topN: numeroDeEnv("PROSPEKTA_IA_TOP_N", LIMITES_IA.topN),
    tetoMensalUsd: numeroDeEnv("PROSPEKTA_IA_TETO_MENSAL_USD", LIMITES_IA.tetoMensalUsd),
    ttlDias: numeroDeEnv("PROSPEKTA_IA_TTL_DIAS", LIMITES_IA.ttlDias),
    temperatura: numeroDeEnv("PROSPEKTA_IA_TEMPERATURA", LIMITES_IA.temperatura),
  };
}
