// Fonte de dados: Google Places API (New) - Text Search.
//
// Regras de custo (fixas no codigo):
//  - FieldMask EXPLICITO, nunca "*"
//  - sem photos, sem reviews, sem Place Details
//  - pageSize <= 20, e NUNCA segue nextPageToken (sem paginacao automatica)
//  - 1 unica chamada por descoberta

import type {
  ContextoDescoberta,
  FonteDeDados,
  ParametrosDescoberta,
  ResultadoDescoberta,
} from "./types";
import { normalizarPlace } from "@/lib/descoberta/normalizar";
import { ErroGoogle } from "@/lib/descoberta/erros";

export const ENDPOINT_TEXT_SEARCH = "https://places.googleapis.com/v1/places:searchText";

/** Campos aprovados pela arquitetura (docs/prospekta-plano.html, secao 08). */
export const FIELD_MASK_BUSCA = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.businessStatus",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.nationalPhoneNumber",
].join(",");

export const MAX_LEADS_POR_BUSCA = 20;
export const MAX_CHAMADAS_POR_DESCOBERTA = 1;

type Opcoes = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export function criarFonteGooglePlaces(opts: Opcoes): FonteDeDados {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 15_000;

  return {
    nome: "google_places",

    async descobrir(
      params: ParametrosDescoberta,
      ctx: ContextoDescoberta,
    ): Promise<ResultadoDescoberta> {
      const pageSize = Math.min(
        Math.max(Math.trunc(params.limiteLeads) || 1, 1),
        MAX_LEADS_POR_BUSCA,
      );
      const raioMetros = Math.min(Math.max(params.raioKm, 1), 50) * 1000;

      const corpo: Record<string, unknown> = {
        textQuery: `${params.nicho} em ${params.regiaoTexto}`,
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize,
      };
      // Circulo so quando temos o centro (Geocoding disponivel). Sem ele, a
      // localizacao vem so do texto da busca.
      if (params.centro) {
        corpo.locationRestriction = {
          circle: {
            center: { latitude: params.centro.lat, longitude: params.centro.lng },
            radius: raioMetros,
          },
        };
      }

      const dados = await ctx.chamarComGuardas(
        {
          provedor: "google",
          endpoint: "text_search",
          faixaCampos: "enterprise",
          unidades: 1,
          obs: `pageSize=${pageSize} raio=${raioMetros}m`,
        },
        () => chamarTextSearch(fetchImpl, opts.apiKey, corpo, timeoutMs),
      );

      const bruto = dados as { places?: unknown };
      // Places API (New) devolve {} (sem "places") quando nao ha resultados.
      if (bruto.places === undefined) return { status: "zero-resultados", leads: [] };
      if (!Array.isArray(bruto.places)) {
        throw new ErroGoogle("resposta-inesperada", "campo 'places' nao e uma lista");
      }
      if (bruto.places.length === 0) return { status: "zero-resultados", leads: [] };

      const leads = bruto.places
        .slice(0, pageSize) // trava dura: nunca mais que o limite
        .map(normalizarPlace)
        .filter((l): l is NonNullable<typeof l> => l !== null);

      return { status: "ok", leads };
    },
  };
}

async function chamarTextSearch(
  fetchImpl: typeof fetch,
  apiKey: string,
  corpo: unknown,
  timeoutMs: number,
): Promise<unknown> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetchImpl(ENDPOINT_TEXT_SEARCH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK_BUSCA,
      },
      body: JSON.stringify(corpo),
      signal: ac.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ErroGoogle("timeout", `Text Search excedeu ${timeoutMs}ms`);
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

  if (resp.status === 400) {
    if (/api[_ ]?key[_ ]?(not[_ ]?valid|invalid)/i.test(texto)) {
      throw new ErroGoogle("chave-invalida", msgApi || "API key not valid", 400);
    }
    throw new ErroGoogle("http-400", msgApi || "requisicao invalida", 400);
  }
  if (resp.status === 401) {
    throw new ErroGoogle("chave-invalida", msgApi || "nao autenticado", 401);
  }
  if (resp.status === 403) {
    if (/api[_ ]?key|SERVICE_DISABLED|not[_ ]?authorized/i.test(texto)) {
      throw new ErroGoogle("chave-invalida", msgApi || "chave sem permissao", 403);
    }
    throw new ErroGoogle("http-403", msgApi || "acesso negado (cota diaria?)", 403);
  }
  if (resp.status === 429) throw new ErroGoogle("http-429", msgApi || "rate limit", 429);
  if (resp.status >= 500) throw new ErroGoogle("http-5xx", msgApi || `HTTP ${resp.status}`, resp.status);
  throw new ErroGoogle("resposta-inesperada", `HTTP ${resp.status}`, resp.status);
}
