// USAGE - registra cada chamada externa em api_usage e soma o consumo do mes.

import type { GuardaStore, RegistroDeUso } from "./store";
import { ErroDeRegistroDeUso } from "./erros";

/**
 * Grava um registro de consumo. Se o banco falhar, NAO engole o erro:
 * embrulha em ErroDeRegistroDeUso e relanca (cenario 5).
 */
export async function registrarUso(
  store: GuardaStore,
  registro: RegistroDeUso,
  agora: Date = new Date(),
): Promise<void> {
  try {
    await store.inserirUso({
      ...registro,
      unidades: registro.unidades ?? 1,
      custoEstimadoUsd: registro.custoEstimadoUsd ?? 0,
      em: agora.toISOString(),
    });
  } catch (causa) {
    throw new ErroDeRegistroDeUso(causa);
  }
}

/** Primeiro instante do mes atual, em UTC, formato ISO. */
export function inicioDoMesUtc(agora: Date = new Date()): string {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)).toISOString();
}

/** Total de unidades consumidas no mes corrente. */
export async function totalChamadasNoMes(
  store: GuardaStore,
  agora: Date = new Date(),
): Promise<number> {
  return store.somarUnidadesDesde(inicioDoMesUtc(agora));
}
