// Cliente do Place Details (New). 1 GET, FieldMask EXPLICITO no header, nunca "*".
//
// SKU: os campos base caem em Place Details Enterprise; `reviews` sobe para
// Enterprise + Atmosphere. Por isso reviews e opt-in.

import { ErroGoogle } from "@/lib/descoberta/erros";

export const ENDPOINT_PLACE_DETAILS = "https://places.googleapis.com/v1/places/";

/** Campos aprovados para o enriquecimento (uteis para prospeccao). Sem "*", sem photos. */
export const CAMPOS_ENRIQUECIMENTO_BASE = [
  "id",
  "displayName",
  "formattedAddress",
  "googleMapsUri",
  "internationalPhoneNumber",
  "nationalPhoneNumber",
  "websiteUri",
  "regularOpeningHours",
  "businessStatus",
  "rating",
  "userRatingCount",
];

export const CAMPO_REVIEWS = "reviews";

export function montarFieldMask(incluirReviews: boolean): string {
  const campos = [...CAMPOS_ENRIQUECIMENTO_BASE];
  if (incluirReviews) campos.push(CAMPO_REVIEWS);
  return campos.join(",");
}

export type OpcoesBuscarDetalhes = {
  apiKey: string;
  placeId: string;
  fieldMask: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export async function buscarPlaceDetails(opts: OpcoesBuscarDetalhes): Promise<unknown> {
  if (/[*]/.test(opts.fieldMask)) {
    throw new Error('FieldMask nao pode conter "*"');
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 15_000;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const url =
    ENDPOINT_PLACE_DETAILS +
    encodeURIComponent(opts.placeId) +
    "?languageCode=pt-BR&regionCode=BR";

  let resp: Response;
  try {
    resp = await fetchImpl(url, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": opts.apiKey,
        "X-Goog-FieldMask": opts.fieldMask,
      },
      signal: ac.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ErroGoogle("timeout", `Place Details excedeu ${timeoutMs}ms`);
    }
    throw new ErroGoogle("rede", e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }

  if (resp.ok) {
    try {
      return await resp.json();
    } catch {
      throw new ErroGoogle("resposta-inesperada", "corpo da resposta nao e JSON valido");
    }
  }

  let corpoErro: unknown = null;
  try {
    corpoErro = await resp.json();
  } catch {
    /* pode nao ter corpo */
  }
  const msgApi =
    corpoErro && typeof corpoErro === "object" && "error" in corpoErro
      ? String((corpoErro as { error?: { message?: unknown } }).error?.message ?? "")
      : "";
  const texto = `${msgApi} ${JSON.stringify(corpoErro ?? {})}`;

  if (resp.status === 404) {
    throw new ErroGoogle("http-400", "Place ID nao encontrado (pode ter expirado)", 404);
  }
  if (resp.status === 400) {
    if (/api[_ ]?key[_ ]?(not[_ ]?valid|invalid)/i.test(texto)) {
      throw new ErroGoogle("chave-invalida", msgApi || "API key not valid", 400);
    }
    throw new ErroGoogle("http-400", msgApi || "requisicao invalida", 400);
  }
  if (resp.status === 401) throw new ErroGoogle("chave-invalida", msgApi || "nao autenticado", 401);
  if (resp.status === 403) {
    if (/api[_ ]?key|SERVICE_DISABLED|not[_ ]?authorized/i.test(texto)) {
      throw new ErroGoogle("chave-invalida", msgApi || "chave sem permissao", 403);
    }
    if (/disabled|not been used|enable/i.test(texto)) {
      throw new ErroGoogle("api-nao-ativada", msgApi || "Places API (New) nao ativada", 403);
    }
    throw new ErroGoogle("http-403", msgApi || "acesso negado (cota diaria?)", 403);
  }
  if (resp.status === 429) throw new ErroGoogle("http-429", msgApi || "rate limit", 429);
  if (resp.status >= 500) {
    throw new ErroGoogle("http-5xx", msgApi || `HTTP ${resp.status}`, resp.status);
  }
  throw new ErroGoogle("resposta-inesperada", `HTTP ${resp.status}`, resp.status);
}
