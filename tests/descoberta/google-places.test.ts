import { test } from "node:test";
import assert from "node:assert/strict";

import {
  criarFonteGooglePlaces,
  FIELD_MASK_BUSCA,
  ENDPOINT_TEXT_SEARCH,
} from "../../lib/sources/google-places";
import { ErroGoogle } from "../../lib/descoberta/erros";
import type { ContextoDescoberta, ParametrosDescoberta } from "../../lib/sources/types";

// ctx que so repassa (o budget/usage e testado nas guardas)
const ctxPassthrough: ContextoDescoberta = {
  chamarComGuardas: (_plano, executar) => executar(),
};

const PARAMS: ParametrosDescoberta = {
  regiaoTexto: "Iguape, SP",
  centro: { lat: -24.7, lng: -47.55 },
  raioKm: 10,
  nicho: "advocacia",
  limiteLeads: 20,
};

function respostaJson(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

test("monta a chamada certa: endpoint, FieldMask explicito, pageSize<=20, circulo", async () => {
  const capturado: Array<{ url: string; init: RequestInit }> = [];
  const fetchFake = (async (url: string, init: RequestInit) => {
    capturado.push({ url: String(url), init });
    return respostaJson({ places: [] });
  }) as unknown as typeof fetch;

  const fonte = criarFonteGooglePlaces({ apiKey: "K", fetchImpl: fetchFake });
  await fonte.descobrir({ ...PARAMS, limiteLeads: 99 }, ctxPassthrough);

  assert.equal(capturado.length, 1);
  const [chamada] = capturado;
  assert.equal(chamada.url, ENDPOINT_TEXT_SEARCH);
  const headers = chamada.init.headers as Record<string, string>;
  assert.equal(headers["X-Goog-FieldMask"], FIELD_MASK_BUSCA);
  assert.doesNotMatch(headers["X-Goog-FieldMask"], /\*/); // nunca "*"
  assert.doesNotMatch(headers["X-Goog-FieldMask"], /photo|review/i); // sem fotos/reviews
  const corpo = JSON.parse(String(chamada.init.body));
  assert.equal(corpo.pageSize, 20); // limitado ao teto mesmo pedindo 99
  assert.ok(corpo.locationRestriction.circle.radius === 10000);
  assert.equal(corpo.languageCode, "pt-BR");
});

test("sem centro (Geocoding indisponivel) -> busca so por texto, sem locationRestriction", async () => {
  const capturado: Array<{ init: RequestInit }> = [];
  const fetchFake = (async (_u: string, init: RequestInit) => {
    capturado.push({ init });
    return respostaJson({ places: [] });
  }) as unknown as typeof fetch;

  await criarFonteGooglePlaces({ apiKey: "K", fetchImpl: fetchFake }).descobrir(
    { ...PARAMS, centro: null },
    ctxPassthrough,
  );
  const corpo = JSON.parse(String(capturado[0].init.body));
  assert.equal(corpo.locationRestriction, undefined);
  assert.match(corpo.textQuery, /Iguape/);
});

test("resposta vazia ({}) -> zero-resultados", async () => {
  const fetchFake = (async () => respostaJson({})) as unknown as typeof fetch;
  const fonte = criarFonteGooglePlaces({ apiKey: "K", fetchImpl: fetchFake });
  const r = await fonte.descobrir(PARAMS, ctxPassthrough);
  assert.equal(r.status, "zero-resultados");
  assert.equal(r.leads.length, 0);
});

test("places: [] -> zero-resultados", async () => {
  const fetchFake = (async () => respostaJson({ places: [] })) as unknown as typeof fetch;
  const r = await criarFonteGooglePlaces({ apiKey: "K", fetchImpl: fetchFake }).descobrir(PARAMS, ctxPassthrough);
  assert.equal(r.status, "zero-resultados");
});

test("resultados normais -> leads normalizados, nunca mais que o limite", async () => {
  const places = Array.from({ length: 25 }, (_, i) => ({
    id: `p${i}`,
    displayName: { text: `Empresa ${i}` },
  }));
  const fetchFake = (async () => respostaJson({ places })) as unknown as typeof fetch;
  const r = await criarFonteGooglePlaces({ apiKey: "K", fetchImpl: fetchFake }).descobrir(
    { ...PARAMS, limiteLeads: 20 },
    ctxPassthrough,
  );
  assert.equal(r.status, "ok");
  assert.equal(r.leads.length, 20);
});

test("HTTP 400 chave invalida -> ErroGoogle tipo 'chave-invalida'", async () => {
  const fetchFake = (async () =>
    respostaJson({ error: { message: "API key not valid. Please pass a valid API key." } }, { status: 400 })) as unknown as typeof fetch;
  await assert.rejects(
    () => criarFonteGooglePlaces({ apiKey: "K", fetchImpl: fetchFake }).descobrir(PARAMS, ctxPassthrough),
    (e: unknown) => e instanceof ErroGoogle && e.tipo === "chave-invalida",
  );
});

test("HTTP 400 generico -> tipo 'http-400'", async () => {
  const fetchFake = (async () =>
    respostaJson({ error: { message: "Invalid pageSize" } }, { status: 400 })) as unknown as typeof fetch;
  await assert.rejects(
    () => criarFonteGooglePlaces({ apiKey: "K", fetchImpl: fetchFake }).descobrir(PARAMS, ctxPassthrough),
    (e: unknown) => e instanceof ErroGoogle && e.tipo === "http-400",
  );
});

test("HTTP 403 -> tipo 'http-403'", async () => {
  const fetchFake = (async () =>
    respostaJson({ error: { message: "quota exceeded" } }, { status: 403 })) as unknown as typeof fetch;
  await assert.rejects(
    () => criarFonteGooglePlaces({ apiKey: "K", fetchImpl: fetchFake }).descobrir(PARAMS, ctxPassthrough),
    (e: unknown) => e instanceof ErroGoogle && e.tipo === "http-403",
  );
});

test("HTTP 429 -> tipo 'http-429'", async () => {
  const fetchFake = (async () => respostaJson({}, { status: 429 })) as unknown as typeof fetch;
  await assert.rejects(
    () => criarFonteGooglePlaces({ apiKey: "K", fetchImpl: fetchFake }).descobrir(PARAMS, ctxPassthrough),
    (e: unknown) => e instanceof ErroGoogle && e.tipo === "http-429",
  );
});

test("HTTP 500 -> tipo 'http-5xx'", async () => {
  const fetchFake = (async () => respostaJson({}, { status: 503 })) as unknown as typeof fetch;
  await assert.rejects(
    () => criarFonteGooglePlaces({ apiKey: "K", fetchImpl: fetchFake }).descobrir(PARAMS, ctxPassthrough),
    (e: unknown) => e instanceof ErroGoogle && e.tipo === "http-5xx",
  );
});

test("timeout (AbortError) -> tipo 'timeout'", async () => {
  const fetchFake = (async (_u: string, init: RequestInit) => {
    return new Promise<Response>((_res, rej) => {
      (init.signal as AbortSignal).addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        rej(err);
      });
    });
  }) as unknown as typeof fetch;
  await assert.rejects(
    () => criarFonteGooglePlaces({ apiKey: "K", fetchImpl: fetchFake, timeoutMs: 20 }).descobrir(PARAMS, ctxPassthrough),
    (e: unknown) => e instanceof ErroGoogle && e.tipo === "timeout",
  );
});

test("resposta inesperada (places nao e lista) -> tipo 'resposta-inesperada'", async () => {
  const fetchFake = (async () => respostaJson({ places: "isto nao e lista" })) as unknown as typeof fetch;
  await assert.rejects(
    () => criarFonteGooglePlaces({ apiKey: "K", fetchImpl: fetchFake }).descobrir(PARAMS, ctxPassthrough),
    (e: unknown) => e instanceof ErroGoogle && e.tipo === "resposta-inesperada",
  );
});

test("corpo nao-JSON com 200 -> 'resposta-inesperada'", async () => {
  const fetchFake = (async () =>
    new Response("<html>", { status: 200, headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
  await assert.rejects(
    () => criarFonteGooglePlaces({ apiKey: "K", fetchImpl: fetchFake }).descobrir(PARAMS, ctxPassthrough),
    (e: unknown) => e instanceof ErroGoogle && e.tipo === "resposta-inesperada",
  );
});
