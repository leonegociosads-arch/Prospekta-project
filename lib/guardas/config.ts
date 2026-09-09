// Configuracao das guardas de custo.
// Vem de variaveis de ambiente, com valores padrao seguros.
// Nao colocamos numeros magicos espalhados pelo codigo dos modulos.
//
// PROTECAO: todo valor e limitado a uma faixa segura (LIMITES_GUARDA). Uma
// variavel de ambiente errada (ex.: TTL 0, teto gigante) NAO deve virar gasto
// acidental - o clamp corrige e a tela /config avisa.

export type GuardaConfig = {
  /** Limite interno de chamadas externas por mes (soma de `unidades` em api_usage). */
  tetoMensalChamadas: number;
  /** Validade, em dias, do cache de resultado de busca (Text Search). */
  ttlBuscaDias: number;
  /** Validade, em dias, do cache de Place Details. */
  ttlDetalhesDias: number;
  /** Validade, em dias, do boletim tecnico de site (nao reanalisa antes disso). */
  ttlSiteDias: number;
  /** Validade, em dias, da checagem de presenca social. */
  ttlSocialDias: number;
  /** PageSpeed ligado? Desligado por padrao (lento e com limite de cota). */
  pagespeedAtivo: boolean;
};

/** Faixa aceita para cada valor. `min` protege contra gasto acidental (TTL baixo
 *  = rechamar toda hora); `max` protege contra desligar o teto sem querer. */
export const LIMITES_GUARDA = {
  tetoMensalChamadas: { min: 1, max: 50_000, padrao: 2000 },
  ttlBuscaDias: { min: 1, max: 365, padrao: 60 },
  ttlDetalhesDias: { min: 1, max: 365, padrao: 30 },
  ttlSiteDias: { min: 1, max: 365, padrao: 14 },
  ttlSocialDias: { min: 1, max: 365, padrao: 30 },
} as const;

export function boolDeEnv(nome: string, padrao: boolean): boolean {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto.trim() === "") return padrao;
  return /^(1|true|sim|on|yes)$/i.test(bruto.trim());
}

/** Le um numero da env; se ausente/invalido usa o padrao; sempre limita a [min, max]. */
export function numeroDeEnv(
  nome: string,
  faixa: { min: number; max: number; padrao: number },
): number {
  const bruto = process.env[nome];
  let n = faixa.padrao;
  if (bruto !== undefined && bruto.trim() !== "") {
    const parsed = Number(bruto);
    if (Number.isFinite(parsed)) n = parsed;
  }
  return Math.min(Math.max(n, faixa.min), faixa.max);
}

export function carregarGuardaConfig(): GuardaConfig {
  return {
    tetoMensalChamadas: numeroDeEnv("PROSPEKTA_TETO_MENSAL_CHAMADAS", LIMITES_GUARDA.tetoMensalChamadas),
    ttlBuscaDias: numeroDeEnv("PROSPEKTA_CACHE_TTL_BUSCA_DIAS", LIMITES_GUARDA.ttlBuscaDias),
    ttlDetalhesDias: numeroDeEnv("PROSPEKTA_CACHE_TTL_DETALHES_DIAS", LIMITES_GUARDA.ttlDetalhesDias),
    ttlSiteDias: numeroDeEnv("PROSPEKTA_CACHE_TTL_SITE_DIAS", LIMITES_GUARDA.ttlSiteDias),
    ttlSocialDias: numeroDeEnv("PROSPEKTA_CACHE_TTL_SOCIAL_DIAS", LIMITES_GUARDA.ttlSocialDias),
    pagespeedAtivo: boolDeEnv("PROSPEKTA_PAGESPEED", false),
  };
}
