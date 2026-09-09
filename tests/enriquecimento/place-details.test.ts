import { test } from "node:test";
import assert from "node:assert/strict";

import {
  montarFieldMask,
  buscarPlaceDetails,
  CAMPOS_ENRIQUECIMENTO_BASE,
} from "../../lib/enriquecimento/place-details";
import { ErroGoogle } from "../../lib/descoberta/erros";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("montarFieldMask: explicito, sem '*', reviews so quando pedido", () => {
  const semRev = montarFieldMask(false);
  assert.ok(!semRev.includes("*"));
  assert.ok(!/review/i.test(semRev));
  for (const c of CAMPOS_ENRIQUECIMENTO_BASE) assert.ok(semRev.includes(c), `falta ${c}`);
  assert.ok(!semRev.includes("photos"));

  const comRev = montarFieldMask(true);
  assert.ok(comRev.includes("reviews"));
});

test("buscarPlaceDetails: GET com api key e FieldMask no header", async () => {
  const cap: Array<{ u: string; init: RequestInit }> = [];
  const f = (async (u: string, init: RequestInit) => {
    cap.push({ u: String(u), init });
    return json({ id: "P1" });
  }) as unknown as typeof fetch;

  await buscarPlaceDetails({ apiKey: "K", placeId: "ChIJ_abc", fieldMask: montarFieldMask(false), fetchImpl: f });
  assert.equal(cap.length, 1);
  assert.match(cap[0].u, /\/v1\/places\/ChIJ_abc\?/);
  assert.equal(cap[0].init.method, "GET");
  const h = cap[0].init.headers as Record<string, string>;
  assert.equal(h["X-Goog-Api-Key"], "K");
  assert.ok(h["X-Goog-FieldMask"].includes("regularOpeningHours"));
});

test("recusa FieldMask com '*'", async () => {
  const f = (async () => json({})) as unknown as typeof fetch;
  await assert.rejects(
    () => buscarPlaceDetails({ apiKey: "K", placeId: "x", fieldMask: "id,*", fetchImpl: f }),
    /\*/,
  );
});

const casos: Array<[number, unknown, ErroGoogle["tipo"]]> = [
  [400, { error: { message: "API key not valid" } }, "chave-invalida"],
  [400, { error: { message: "bad request" } }, "http-400"],
  [403, { error: { message: "quota" } }, "http-403"],
  [404, { error: { message: "not found" } }, "http-400"],
  [429, {}, "http-429"],
  [503, {}, "http-5xx"],
];

for (const [status, body, tipo] of casos) {
  test(`HTTP ${status} -> ErroGoogle '${tipo}'`, async () => {
    const f = (async () => json(body, status)) as unknown as typeof fetch;
    await assert.rejects(
      () => buscarPlaceDetails({ apiKey: "K", placeId: "x", fieldMask: montarFieldMask(false), fetchImpl: f }),
      (e: unknown) => e instanceof ErroGoogle && e.tipo === tipo,
    );
  });
}

test("timeout -> ErroGoogle 'timeout'", async () => {
  const f = (async (_u: string, init: RequestInit) =>
    new Promise<Response>((_res, rej) => {
      (init.signal as AbortSignal).addEventListener("abort", () => {
        const e = new Error("aborted");
        e.name = "AbortError";
        rej(e);
      });
    })) as unknown as typeof fetch;
  await assert.rejects(
    () => buscarPlaceDetails({ apiKey: "K", placeId: "x", fieldMask: montarFieldMask(false), fetchImpl: f, timeoutMs: 15 }),
    (e: unknown) => e instanceof ErroGoogle && e.tipo === "timeout",
  );
});

test("200 com corpo nao-JSON -> 'resposta-inesperada'", async () => {
  const f = (async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch;
  await assert.rejects(
    () => buscarPlaceDetails({ apiKey: "K", placeId: "x", fieldMask: montarFieldMask(false), fetchImpl: f }),
    (e: unknown) => e instanceof ErroGoogle && e.tipo === "resposta-inesperada",
  );
});
