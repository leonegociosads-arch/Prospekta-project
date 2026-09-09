// Precos dos modelos de IA, em USD por 1 milhao de tokens.
//
// Fonte: paginas de preco dos provedores (jan/2026). Se um provedor mudar a
// tabela, ajuste AQUI - e o unico lugar que calcula custo de IA.
//
// O custo real de cada chamada e calculado com os tokens que a API devolve,
// nao com estimativa de tamanho de texto.

export type PrecoModelo = { entradaPorMilhao: number; saidaPorMilhao: number };

export const PRECOS_IA: Record<string, PrecoModelo> = {
  // Google Gemini (AI Studio / API)
  "gemini-2.0-flash": { entradaPorMilhao: 0.1, saidaPorMilhao: 0.4 },
  "gemini-2.0-flash-lite": { entradaPorMilhao: 0.075, saidaPorMilhao: 0.3 },
  "gemini-2.5-flash": { entradaPorMilhao: 0.3, saidaPorMilhao: 2.5 },
  "gemini-2.5-flash-lite": { entradaPorMilhao: 0.1, saidaPorMilhao: 0.4 },
  // OpenAI
  "gpt-4o-mini": { entradaPorMilhao: 0.15, saidaPorMilhao: 0.6 },
  "gpt-4.1-mini": { entradaPorMilhao: 0.4, saidaPorMilhao: 1.6 },
  // Anthropic
  "claude-haiku-4-5": { entradaPorMilhao: 1, saidaPorMilhao: 5 },
};

/** Usado quando o modelo nao esta na tabela: nao arrisca subestimar o gasto. */
export const PRECO_DESCONHECIDO: PrecoModelo = { entradaPorMilhao: 1, saidaPorMilhao: 5 };

export function precoDoModelo(modelo: string): PrecoModelo {
  return PRECOS_IA[modelo] ?? PRECO_DESCONHECIDO;
}

/** Custo em USD de uma chamada, arredondado a 6 casas. */
export function estimarCustoUsd(modelo: string, tokensEntrada: number, tokensSaida: number): number {
  const p = precoDoModelo(modelo);
  const inTok = Number.isFinite(tokensEntrada) && tokensEntrada > 0 ? tokensEntrada : 0;
  const outTok = Number.isFinite(tokensSaida) && tokensSaida > 0 ? tokensSaida : 0;
  const usd = (inTok / 1e6) * p.entradaPorMilhao + (outTok / 1e6) * p.saidaPorMilhao;
  return Math.round(usd * 1e6) / 1e6;
}
