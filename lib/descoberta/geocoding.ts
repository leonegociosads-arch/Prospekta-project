// Resolve "Iguape, SP" -> {lat, lng}.
// Cache primeiro (region_cache); so chama a Geocoding API se for regiao nova,
// e sempre via chamarComGuardas.

import type { GuardaStore } from "@/lib/guardas";
import { guardarRegiao, normalizarRegiao, regiaoEmCache } from "@/lib/guardas";
import type { ContextoDescoberta } from "@/lib/sources/types";
import { ErroGoogle } from "./erros";

export const ENDPOINT_GEOCODING = "https://maps.googleapis.com/maps/api/geocode/json";

export type Centro = { lat: number; lng: number };

export async function resolverRegiao(
  store: GuardaStore,
  ctx: ContextoDescoberta,
  apiKey: string,
  regiaoTexto: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<{ centro: Centro; veioDoCache: boolean }> {
  const cache = await regiaoEmCache(store, regiaoTexto);
  if (cache) {
    return { centro: { lat: cache.centro_lat, lng: cache.centro_lng }, veioDoCache: true };
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 10_000;

  const centro = await ctx.chamarComGuardas(
    { provedor: "google", endpoint: "geocoding", unidades: 1, obs: normalizarRegiao(regiaoTexto) },
    () => geocodar(fetchImpl, apiKey, regiaoTexto, timeoutMs),
  );

  await guardarRegiao(store, regiaoTexto, centro.lat, centro.lng);
  return { centro, veioDoCache: false };
}

async function geocodar(
  fetchImpl: typeof fetch,
  apiKey: string,
  regiao: string,
  timeoutMs: number,
): Promise<Centro> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const url =
    `${ENDPOINT_GEOCODING}?address=${encodeURIComponent(regiao)}` +
    `&region=br&language=pt-BR&key=${encodeURIComponent(apiKey)}`;

  let resp: Response;
  try {
    resp = await fetchImpl(url, { signal: ac.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ErroGoogle("timeout", "geocoding excedeu o tempo limite");
    }
    throw new ErroGoogle("rede", e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }

  let json: unknown;
  try {
    json = await resp.json();
  } catch {
    throw new ErroGoogle("resposta-inesperada", "geocoding: resposta nao e JSON");
  }

  const j = json as {
    status?: string;
    error_message?: string;
    results?: Array<{ geometry?: { location?: { lat?: unknown; lng?: unknown } } }>;
  };

  if (j.status === "OK") {
    const loc = j.results?.[0]?.geometry?.location;
    if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
      return { lat: loc.lat, lng: loc.lng };
    }
    throw new ErroGoogle("resposta-inesperada", "geocoding: sem lat/lng no resultado");
  }
  if (j.status === "ZERO_RESULTS") {
    throw new ErroGoogle("resposta-inesperada", `regiao nao encontrada: "${regiao}"`);
  }
  if (j.status === "REQUEST_DENIED") {
    const msg = j.error_message || "geocoding REQUEST_DENIED";
    if (/not activated|not enabled|enable this api/i.test(msg)) {
      throw new ErroGoogle("api-nao-ativada", `Geocoding API desativada: ${msg}`);
    }
    throw new ErroGoogle("chave-invalida", msg);
  }
  if (j.status === "OVER_QUERY_LIMIT") {
    throw new ErroGoogle("http-429", "geocoding OVER_QUERY_LIMIT");
  }
  if (!resp.ok) {
    throw new ErroGoogle(resp.status === 403 ? "http-403" : "resposta-inesperada", `geocoding HTTP ${resp.status}`);
  }
  throw new ErroGoogle("resposta-inesperada", `geocoding status: ${j.status ?? "?"}`);
}
