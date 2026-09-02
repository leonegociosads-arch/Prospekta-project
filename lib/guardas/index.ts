// Ponto de entrada das guardas de custo.
//
// `chamarComGuardas` e o UNICO caminho autorizado para gastar uma chamada
// externa. Toda a etapa de descoberta (e depois a de IA) vai passar por aqui.

import type { GuardaStore, RegistroDeUso } from "./store";
import { podeChamar } from "./budget";
import { registrarUso } from "./usage";
import { ErroDeOrcamento } from "./erros";
import { carregarGuardaConfig, type GuardaConfig } from "./config";

export * from "./store";
export * from "./erros";
export * from "./config";
export * from "./cache";
export { podeChamar } from "./budget";
export type { VerdictoOrcamento, MotivoVeredito } from "./budget";
export { registrarUso, totalChamadasNoMes, inicioDoMesUtc } from "./usage";

export type PlanoDeChamada = RegistroDeUso;

/**
 * Executa uma chamada externa protegida:
 *
 *   1. verifica o orcamento (teto mensal + orcamento da pesquisa)  -> bloqueia com ErroDeOrcamento
 *   2. executa a chamada real (a funcao que voce passa em `executar`)
 *   3. registra o consumo em api_usage                              -> se falhar, ErroDeRegistroDeUso (nao engole)
 *   4. incrementa os contadores da pesquisa (atomico, via SQL)
 *
 * Se `executar()` lancar (timeout / 429 / 500 / etc.), o erro sobe e
 * NADA e registrado nem incrementado - a chamada nao "aconteceu" do ponto
 * de vista do consumo.
 */
export async function chamarComGuardas<T>(
  store: GuardaStore,
  plano: PlanoDeChamada,
  executar: () => Promise<T>,
  opts: { agora?: Date; config?: GuardaConfig } = {},
): Promise<T> {
  const agora = opts.agora ?? new Date();
  const config = opts.config ?? carregarGuardaConfig();
  const unidades = plano.unidades ?? 1;

  const veredito = await podeChamar(
    store,
    { searchId: plano.searchId, unidades },
    { agora, config },
  );
  if (!veredito.permitido) {
    throw new ErroDeOrcamento(veredito.motivo);
  }

  const resultado = await executar();

  // 3. auditoria primeiro (registro duravel). Se falhar, relanca.
  await registrarUso(store, plano, agora);

  // 4. contadores da pesquisa
  if (plano.searchId) {
    await store.registrarConsumoPesquisa(plano.searchId, unidades, plano.custoEstimadoUsd ?? 0);
  }

  return resultado;
}
