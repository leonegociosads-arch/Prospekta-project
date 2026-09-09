// cache -> (se preciso) budget + chamada + usage -> grava os detalhes.
//
// Depende so do GuardaStore (nao do Supabase direto) -> testavel com fake store.

import {
  chamarComGuardas,
  decidirDetalhesPlace,
  guardarBuscaPlace,
  guardarDetalhesPlace,
  type GuardaConfig,
  type GuardaStore,
  type MotivoCache,
} from "@/lib/guardas";
import { buscarPlaceDetails, montarFieldMask } from "./place-details";

export type OpcoesObterDetalhes = {
  placeId: string;
  incluirReviews: boolean;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  /** usado quando ainda nao existe linha em places_cache */
  brutoBusca?: unknown;
  config?: GuardaConfig;
  agora?: Date;
};

export type ResultadoObterDetalhes = {
  raw: unknown;
  fonte: "google" | "cache";
  motivoCache: MotivoCache;
};

const CUSTO_ENTERPRISE = 0.02;
const CUSTO_ATMOSPHERE = 0.025;

export async function obterDetalhesPlace(
  store: GuardaStore,
  opts: OpcoesObterDetalhes,
): Promise<ResultadoObterDetalhes> {
  const decisao = await decidirDetalhesPlace(store, opts.placeId, {
    agora: opts.agora,
    config: opts.config,
  });

  // cache valido dentro do TTL -> nao chama o Google
  if (!decisao.precisa && decisao.registro?.detalhes != null) {
    return { raw: decisao.registro.detalhes, fonte: "cache", motivoCache: decisao.motivo };
  }

  if (!opts.apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY ausente - nao da para chamar o Place Details");
  }

  // garante a linha em places_cache (o gravarDetalhesPlace faz UPDATE)
  if (!decisao.registro) {
    await guardarBuscaPlace(store, opts.placeId, opts.brutoBusca ?? {});
  }

  const fieldMask = montarFieldMask(opts.incluirReviews);
  const nCampos = fieldMask.split(",").length;

  const raw = await chamarComGuardas(
    store,
    {
      provedor: "google",
      endpoint: "place_details",
      faixaCampos: opts.incluirReviews ? "atmosphere" : "enterprise",
      unidades: 1,
      custoEstimadoUsd: opts.incluirReviews ? CUSTO_ATMOSPHERE : CUSTO_ENTERPRISE,
      obs: `${nCampos} campos${opts.incluirReviews ? " +reviews" : ""}`,
    },
    () =>
      buscarPlaceDetails({
        apiKey: opts.apiKey!,
        placeId: opts.placeId,
        fieldMask,
        fetchImpl: opts.fetchImpl,
      }),
    { config: opts.config, agora: opts.agora },
  );

  await guardarDetalhesPlace(store, opts.placeId, raw);

  return { raw, fonte: "google", motivoCache: decisao.motivo };
}
