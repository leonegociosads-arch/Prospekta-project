// PageSpeed Insights (Lighthouse) v5. OPCIONAL e desligado por padrao.
// Passa por chamarComGuardas -> conta no teto mensal e e registrado em api_usage.
// Trata 429 e timeout sem derrubar a analise (quem chama decide ignorar).

import type { ContextoDescoberta } from "@/lib/sources/types";
import { ErroGoogle } from "@/lib/descoberta/erros";
import type { ResultadoPageSpeed } from "./tipos";

export const ENDPOINT_PAGESPEED =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export type OpcoesPageSpeed = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  estrategia?: "mobile" | "desktop";
};

export async function medirPageSpeed(
  ctx: ContextoDescoberta,
  apiKey: string,
  url: string,
  opts: OpcoesPageSpeed = {},
): Promise<ResultadoPageSpeed> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const estrategia = opts.estrategia ?? "mobile";

  return ctx.chamarComGuardas(
    { provedor: "google", endpoint: "pagespeed", unidades: 1, obs: url.slice(0, 200) },
    () => rodar(fetchImpl, apiKey, url, estrategia, timeoutMs),
  );
}

async function rodar(
  fetchImpl: typeof fetch,
  apiKey: string,
  url: string,
  estrategia: string,
  timeoutMs: number,
): Promise<ResultadoPageSpeed> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  const alvo =
    `${ENDPOINT_PAGESPEED}?url=${encodeURIComponent(url)}&strategy=${estrategia}` +
    `&category=performance&category=accessibility&category=best-practices&category=seo` +
    `&key=${encodeURIComponent(apiKey)}`;

  let resp: Response;
  try {
    resp = await fetchImpl(alvo, { signal: ac.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ErroGoogle("timeout", "PageSpeed excedeu o tempo limite");
    }
    throw new ErroGoogle("rede", e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }

  if (resp.status === 429) throw new ErroGoogle("http-429", "PageSpeed 429", 429);
  if (resp.status === 403) throw new ErroGoogle("http-403", "PageSpeed 403", 403);
  if (resp.status >= 500) throw new ErroGoogle("http-5xx", `PageSpeed ${resp.status}`, resp.status);

  let json: unknown;
  try {
    json = await resp.json();
  } catch {
    throw new ErroGoogle("resposta-inesperada", "PageSpeed: resposta nao e JSON");
  }

  if (!resp.ok) {
    const msg =
      (json as { error?: { message?: string } })?.error?.message ?? `PageSpeed HTTP ${resp.status}`;
    if (/API key not valid/i.test(msg)) throw new ErroGoogle("chave-invalida", msg);
    if (/not been used|is disabled|not enabled/i.test(msg)) throw new ErroGoogle("api-nao-ativada", msg);
    throw new ErroGoogle("http-400", msg, resp.status);
  }

  const lh = (json as {
    lighthouseResult?: {
      categories?: Record<string, { score?: number | null }>;
      audits?: Record<string, { numericValue?: number }>;
    };
  }).lighthouseResult;

  const cat = (nome: string): number | null => {
    const s = lh?.categories?.[nome]?.score;
    return typeof s === "number" ? Math.round(s * 100) : null;
  };
  const audit = (nome: string): number | null => {
    const v = lh?.audits?.[nome]?.numericValue;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  return {
    performance: cat("performance"),
    acessibilidade: cat("accessibility"),
    boasPraticas: cat("best-practices"),
    seo: cat("seo"),
    lcpMs: audit("largest-contentful-paint"),
    cls: audit("cumulative-layout-shift"),
    ttfbMs: audit("server-response-time"),
  };
}
