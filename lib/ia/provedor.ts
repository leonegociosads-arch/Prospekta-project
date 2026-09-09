// Chamada ao modelo de IA. Sem SDK - `fetch` puro, como lib/sources/google-places.ts.
//
// Nesta versao so o Google Gemini esta implementado (escolha da etapa 14).
// O switch por familia de modelo deixa o encaixe pronto para OpenAI / Anthropic.

import { ErroIa } from "./erros";

export type ChamadaModelo = {
  modelo: string;
  /** instrucoes fixas (as regras rigidas). */
  system: string;
  /** o dossie do lead. */
  user: string;
  temperatura: number;
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** teto de tokens de saida (o JSON de diagnostico e curto). */
  maxTokensSaida?: number;
};

export type RespostaModelo = {
  texto: string;
  tokensEntrada: number;
  tokensSaida: number;
};

export async function chamarModeloIa(opts: ChamadaModelo): Promise<RespostaModelo> {
  if (opts.modelo.startsWith("gemini-")) return chamarGemini(opts);
  throw new ErroIa(
    "resposta-inesperada",
    `Modelo "${opts.modelo}" nao suportado nesta versao. Use um modelo "gemini-*" ` +
      `ou implemente o provedor em lib/ia/provedor.ts.`,
  );
}

const BASE_GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";

async function chamarGemini(opts: ChamadaModelo): Promise<RespostaModelo> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const url = `${BASE_GEMINI}/${encodeURIComponent(opts.modelo)}:generateContent`;

  const corpo = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    generationConfig: {
      temperature: opts.temperatura,
      responseMimeType: "application/json",
      maxOutputTokens: opts.maxTokensSaida ?? 1200,
    },
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
      body: JSON.stringify(corpo),
      signal: ac.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ErroIa("timeout", `Gemini excedeu ${timeoutMs}ms`);
    }
    throw new ErroIa("rede", e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    let corpoErro: unknown = null;
    try {
      corpoErro = await resp.json();
    } catch {
      /* pode nao ter corpo */
    }
    const msg =
      corpoErro && typeof corpoErro === "object" && "error" in corpoErro
        ? String((corpoErro as { error?: { message?: unknown } }).error?.message ?? "")
        : "";
    const texto = `${msg} ${JSON.stringify(corpoErro ?? {})}`;

    if (resp.status === 400 && /API_KEY_INVALID|api key not valid/i.test(texto)) {
      throw new ErroIa("chave-invalida", msg || "API key not valid", 400);
    }
    if (resp.status === 400) {
      throw new ErroIa("resposta-inesperada", msg || "requisicao invalida (400)", 400);
    }
    if (resp.status === 401) throw new ErroIa("chave-invalida", msg || "nao autenticado", 401);
    if (resp.status === 403) {
      if (/SERVICE_DISABLED|has not been used|not authorized|permission/i.test(texto)) {
        throw new ErroIa("chave-invalida", msg || "API de IA nao habilitada para esta chave", 403);
      }
      throw new ErroIa("http-403", msg || "acesso negado", 403);
    }
    if (resp.status === 429) throw new ErroIa("http-429", msg || "rate limit", 429);
    if (resp.status >= 500) throw new ErroIa("http-5xx", msg || `HTTP ${resp.status}`, resp.status);
    throw new ErroIa("resposta-inesperada", msg || `HTTP ${resp.status}`, resp.status);
  }

  let dados: unknown;
  try {
    dados = await resp.json();
  } catch {
    throw new ErroIa("resposta-inesperada", "corpo da resposta nao e JSON valido");
  }

  const d = dados as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: unknown }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  if (d.promptFeedback?.blockReason) {
    throw new ErroIa("conteudo-bloqueado", `bloqueado pelo Gemini: ${d.promptFeedback.blockReason}`);
  }
  const cand = d.candidates?.[0];
  if (!cand) {
    throw new ErroIa("resposta-inesperada", "Gemini nao retornou nenhuma resposta (candidates vazio)");
  }
  if (cand.finishReason && cand.finishReason === "SAFETY") {
    throw new ErroIa("conteudo-bloqueado", "resposta interrompida por filtro de seguranca");
  }

  const texto = (cand.content?.parts ?? [])
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
  if (!texto) {
    throw new ErroIa("resposta-inesperada", `resposta vazia (finishReason=${cand.finishReason ?? "?"})`);
  }

  return {
    texto,
    tokensEntrada: numero(d.usageMetadata?.promptTokenCount),
    tokensSaida: numero(d.usageMetadata?.candidatesTokenCount),
  };
}

function numero(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}
