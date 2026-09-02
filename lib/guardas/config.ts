// Configuracao das guardas de custo.
// Vem de variaveis de ambiente, com valores padrao seguros.
// Nao colocamos numeros magicos espalhados pelo codigo dos modulos.

export type GuardaConfig = {
  /** Limite interno de chamadas externas por mes (soma de `unidades` em api_usage). */
  tetoMensalChamadas: number;
  /** Validade, em dias, do cache de resultado de busca (Text Search). */
  ttlBuscaDias: number;
  /** Validade, em dias, do cache de Place Details. */
  ttlDetalhesDias: number;
};

function numeroDeEnv(nome: string, padrao: number): number {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto.trim() === "") return padrao;
  const n = Number(bruto);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Variavel de ambiente ${nome} invalida: "${bruto}" (esperado numero >= 0)`);
  }
  return n;
}

export function carregarGuardaConfig(): GuardaConfig {
  return {
    tetoMensalChamadas: numeroDeEnv("PROSPEKTA_TETO_MENSAL_CHAMADAS", 2000),
    ttlBuscaDias: numeroDeEnv("PROSPEKTA_CACHE_TTL_BUSCA_DIAS", 60),
    ttlDetalhesDias: numeroDeEnv("PROSPEKTA_CACHE_TTL_DETALHES_DIAS", 30),
  };
}
