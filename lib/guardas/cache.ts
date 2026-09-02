// CACHE - decide se e preciso chamar a API externa ou se o dado ja esta no banco
// e ainda dentro da validade (TTL). Trata separadamente o resultado da BUSCA
// e o Place Details.

import type { GuardaStore, RegistroPlace, RegistroRegiao } from "./store";
import { carregarGuardaConfig, type GuardaConfig } from "./config";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function expirado(iso: string | null, ttlDias: number, agora: Date): boolean {
  if (!iso) return true;
  const idadeMs = agora.getTime() - new Date(iso).getTime();
  return idadeMs > ttlDias * MS_POR_DIA;
}

/** Padroniza o texto da regiao para a chave do cache ("Iguape, SP " -> "iguape, sp"). */
export function normalizarRegiao(texto: string): string {
  return texto.trim().toLowerCase().replace(/\s+/g, " ");
}

// ------------------------------------------------------------
// Regiao (geocoding)
// ------------------------------------------------------------
export async function regiaoEmCache(
  store: GuardaStore,
  regiaoTexto: string,
): Promise<RegistroRegiao | null> {
  return store.lerRegiao(normalizarRegiao(regiaoTexto));
}

export async function guardarRegiao(
  store: GuardaStore,
  regiaoTexto: string,
  lat: number,
  lng: number,
): Promise<void> {
  await store.gravarRegiao(normalizarRegiao(regiaoTexto), lat, lng);
}

// ------------------------------------------------------------
// Places
// ------------------------------------------------------------
export type MotivoCache = "sem-cache" | "cache-valido" | "cache-expirado";

export type DecisaoCache = {
  /** true = pode/deve chamar a API. false = usar o que ja esta no banco. */
  precisa: boolean;
  motivo: MotivoCache;
  registro: RegistroPlace | null;
};

/** Decide se e preciso chamar o Text Search para este Place ID. */
export async function decidirBuscaPlace(
  store: GuardaStore,
  placeId: string,
  opts: { agora?: Date; config?: GuardaConfig } = {},
): Promise<DecisaoCache> {
  const agora = opts.agora ?? new Date();
  const config = opts.config ?? carregarGuardaConfig();

  const reg = await store.lerPlace(placeId);
  if (!reg) return { precisa: true, motivo: "sem-cache", registro: null };
  if (expirado(reg.busca_em, config.ttlBuscaDias, agora)) {
    return { precisa: true, motivo: "cache-expirado", registro: reg };
  }
  return { precisa: false, motivo: "cache-valido", registro: reg };
}

/** Decide se e preciso chamar o Place Details para este Place ID. */
export async function decidirDetalhesPlace(
  store: GuardaStore,
  placeId: string,
  opts: { agora?: Date; config?: GuardaConfig } = {},
): Promise<DecisaoCache> {
  const agora = opts.agora ?? new Date();
  const config = opts.config ?? carregarGuardaConfig();

  const reg = await store.lerPlace(placeId);
  if (!reg || reg.detalhes == null) {
    return { precisa: true, motivo: "sem-cache", registro: reg };
  }
  if (expirado(reg.detalhes_em, config.ttlDetalhesDias, agora)) {
    return { precisa: true, motivo: "cache-expirado", registro: reg };
  }
  return { precisa: false, motivo: "cache-valido", registro: reg };
}

export async function guardarBuscaPlace(
  store: GuardaStore,
  placeId: string,
  resultado: unknown,
): Promise<void> {
  await store.gravarBuscaPlace(placeId, resultado);
}

export async function guardarDetalhesPlace(
  store: GuardaStore,
  placeId: string,
  detalhes: unknown,
): Promise<void> {
  await store.gravarDetalhesPlace(placeId, detalhes);
}
