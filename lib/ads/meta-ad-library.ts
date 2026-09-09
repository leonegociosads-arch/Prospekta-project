// Consulta a Meta Ad Library (biblioteca de anuncios do Facebook/Instagram).
//
// OPT-IN: so roda se META_AD_LIBRARY_TOKEN estiver no ambiente. A API oficial
// para anuncios comerciais no Brasil e restrita - na pratica costuma responder
// vazio ou erro. Por isso:
//   - resultado vazio  => "desconhecido" (NUNCA "nao anuncia")
//   - erro da API      => "desconhecido"
//   - anuncios ativos  => "sim" + quantidade
//
// `fetch` puro, sem SDK. 1 chamada por lead, sempre pelas guardas de custo.

import type { ResultadoMetaAdLibrary } from "./tipos";

const ENDPOINT = "https://graph.facebook.com/v21.0/ads_archive";

export type TipoErroMeta = "token-invalido" | "http-429" | "http-5xx" | "timeout" | "rede" | "resposta-inesperada";

export class ErroMeta extends Error {
  readonly tipo: TipoErroMeta;
  constructor(tipo: TipoErroMeta, mensagem: string) {
    super(mensagem);
    this.name = "ErroMeta";
    this.tipo = tipo;
  }
}

export type OpcoesMeta = {
  token: string;
  termo: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  paisReached?: string;
};

/** Faz UMA chamada. Devolve ResultadoMetaAdLibrary ou lanca ErroMeta (transitorio). */
export async function consultarMetaAdLibrary(opts: OpcoesMeta): Promise<ResultadoMetaAdLibrary> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const pais = opts.paisReached ?? "BR";

  const url =
    `${ENDPOINT}?` +
    new URLSearchParams({
      access_token: opts.token,
      search_terms: opts.termo,
      ad_reached_countries: `["${pais}"]`,
      ad_active_status: "ACTIVE",
      fields: "id,page_name",
      limit: "12",
    }).toString();

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetchImpl(url, { signal: ac.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ErroMeta("timeout", `Meta Ad Library excedeu ${timeoutMs}ms`);
    }
    throw new ErroMeta("rede", e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }

  let corpo: unknown;
  try {
    corpo = await resp.json();
  } catch {
    throw new ErroMeta("resposta-inesperada", "corpo da resposta nao e JSON valido");
  }

  const c = corpo as {
    data?: Array<unknown>;
    error?: { message?: string; code?: number; type?: string };
  };

  if (!resp.ok || c.error) {
    const msg = c.error?.message ?? `HTTP ${resp.status}`;
    const code = c.error?.code;
    if (resp.status === 190 || code === 190 || /oauth|access token/i.test(msg)) {
      throw new ErroMeta("token-invalido", msg);
    }
    if (resp.status === 429 || code === 4 || code === 17 || code === 613) {
      throw new ErroMeta("http-429", msg);
    }
    if (resp.status >= 500) throw new ErroMeta("http-5xx", msg);
    // 400 e afins: a API restrita nao aceitou a busca -> desconhecido, nao e erro fatal
    return {
      encontrado: "desconhecido",
      quantidade: null,
      fonte: "erro",
      detalhe: `Meta Ad Library recusou a busca: ${msg}`,
    };
  }

  const qtd = Array.isArray(c.data) ? c.data.length : 0;
  if (qtd > 0) {
    return {
      encontrado: "sim",
      quantidade: qtd,
      fonte: "api",
      detalhe: `${qtd}${qtd >= 12 ? "+" : ""} anúncio(s) ativo(s) encontrados na busca por "${opts.termo}"`,
    };
  }
  return {
    encontrado: "desconhecido",
    quantidade: 0,
    fonte: "api",
    detalhe:
      "Nenhum anúncio ativo retornado. A API não cobre todos os anúncios comerciais no Brasil — " +
      "isso não confirma que a empresa não anuncia.",
  };
}
