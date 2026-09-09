import { test } from "node:test";
import assert from "node:assert/strict";

import { consultarMetaAdLibrary, ErroMeta } from "../../lib/ads/meta-ad-library";

function fetchJson(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

const base = { token: "t", termo: "Advocacia X" };

test("meta: anuncios ativos -> encontrado 'sim' + quantidade", async () => {
  const r = await consultarMetaAdLibrary({ ...base, fetchImpl: fetchJson(200, { data: [{ id: "1" }, { id: "2" }] }) });
  assert.equal(r.encontrado, "sim");
  assert.equal(r.quantidade, 2);
});

test("meta: resultado vazio -> 'desconhecido', NUNCA 'nao'", async () => {
  const r = await consultarMetaAdLibrary({ ...base, fetchImpl: fetchJson(200, { data: [] }) });
  assert.equal(r.encontrado, "desconhecido");
  assert.equal(r.fonte, "api");
});

test("meta: 400 (busca nao suportada) -> 'desconhecido', fonte 'erro', nao lanca", async () => {
  const r = await consultarMetaAdLibrary({
    ...base,
    fetchImpl: fetchJson(400, { error: { message: "search is not available", code: 100 } }),
  });
  assert.equal(r.encontrado, "desconhecido");
  assert.equal(r.fonte, "erro");
});

test("meta: token invalido -> ErroMeta('token-invalido')", async () => {
  await assert.rejects(
    () =>
      consultarMetaAdLibrary({
        ...base,
        fetchImpl: fetchJson(400, { error: { message: "Invalid OAuth access token", code: 190 } }),
      }),
    (e) => e instanceof ErroMeta && e.tipo === "token-invalido",
  );
});

test("meta: 429 -> ErroMeta('http-429')", async () => {
  await assert.rejects(
    () => consultarMetaAdLibrary({ ...base, fetchImpl: fetchJson(429, { error: { message: "rate limit", code: 4 } }) }),
    (e) => e instanceof ErroMeta && e.tipo === "http-429",
  );
});

test("meta: 500 -> ErroMeta('http-5xx')", async () => {
  await assert.rejects(
    () => consultarMetaAdLibrary({ ...base, fetchImpl: fetchJson(500, { error: { message: "oops" } }) }),
    (e) => e instanceof ErroMeta && e.tipo === "http-5xx",
  );
});
