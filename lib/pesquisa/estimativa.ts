// Limites da pesquisa + estimativa simples de consumo de chamadas.
// Puro (sem I/O) para dar para usar no navegador (estimativa ao vivo) e no
// servidor (calcular o orcamento a gravar).

export const LIMITES = {
  raioMinKm: 1,
  raioMaxKm: 25,
  raioPadraoKm: 10,
  leadsMin: 1,
  // 20 = 1 pagina do Text Search. Teto conservador: nunca pagina, nunca
  // consome chamada extra sem querer.
  leadsMax: 20,
  leadsPadrao: 20,
} as const;

export type EstimativaConsumo = {
  /** quantas empresas a pesquisa vai tentar trazer */
  leadsAlvo: number;
  /** Text Search: 1 chamada cobre ate 20 resultados */
  chamadasBusca: number;
  /** Geocoding: 0 se a regiao ja estiver em cache, 1 se for nova */
  geocodingMin: number;
  geocodingMax: number;
  /** faixa total de chamadas a Google Places */
  chamadasMin: number;
  chamadasMax: number;
  /** valor gravado em searches.orcamento_chamadas (pior caso) */
  orcamentoChamadas: number;
};

function clampLeads(valor: number): number {
  const n = Math.trunc(valor);
  if (!Number.isFinite(n)) return LIMITES.leadsPadrao;
  return Math.min(Math.max(n, LIMITES.leadsMin), LIMITES.leadsMax);
}

export function estimarConsumo(limiteLeads: number): EstimativaConsumo {
  const leadsAlvo = clampLeads(limiteLeads);
  const chamadasBusca = 1; // leadsAlvo <= 20, entao nunca pagina
  const geocodingMin = 0;
  const geocodingMax = 1;
  return {
    leadsAlvo,
    chamadasBusca,
    geocodingMin,
    geocodingMax,
    chamadasMin: chamadasBusca + geocodingMin,
    chamadasMax: chamadasBusca + geocodingMax,
    orcamentoChamadas: chamadasBusca + geocodingMax,
  };
}
