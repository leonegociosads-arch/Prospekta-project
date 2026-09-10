import { test } from "node:test";
import assert from "node:assert/strict";

import { situacaoDoSite } from "../../lib/leads/consulta";

test("situacaoDoSite: sem url -> sem-site; sem boletim -> nao-analisado", () => {
  assert.equal(situacaoDoSite(false, null), "sem-site");
  assert.equal(situacaoDoSite(true, undefined), "nao-analisado");
});

test("situacaoDoSite: erro ou site_existe=false -> fora-do-ar", () => {
  assert.equal(
    situacaoDoSite(true, { site_existe: true, status_http: 200, ttfb_ms: 100, erro: "timeout" }),
    "fora-do-ar",
  );
  assert.equal(
    situacaoDoSite(true, { site_existe: false, status_http: null, ttfb_ms: null, erro: null }),
    "fora-do-ar",
  );
});

test("situacaoDoSite: status de erro HTTP ou TTFB alto -> instavel", () => {
  assert.equal(
    situacaoDoSite(true, { site_existe: true, status_http: 503, ttfb_ms: 100, erro: null }),
    "instavel",
  );
  assert.equal(
    situacaoDoSite(true, { site_existe: true, status_http: 200, ttfb_ms: 4000, erro: null }),
    "instavel",
  );
});

test("situacaoDoSite: responde rapido e 200 -> ok", () => {
  assert.equal(
    situacaoDoSite(true, { site_existe: true, status_http: 200, ttfb_ms: 300, erro: null }),
    "ok",
  );
});
