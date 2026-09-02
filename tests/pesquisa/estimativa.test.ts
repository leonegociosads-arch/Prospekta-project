import { test } from "node:test";
import assert from "node:assert/strict";

import { estimarConsumo, LIMITES } from "../../lib/pesquisa/estimativa";

test("limite 20 -> 1 busca, 1 a 2 chamadas, orcamento 2", () => {
  const e = estimarConsumo(20);
  assert.equal(e.leadsAlvo, 20);
  assert.equal(e.chamadasBusca, 1);
  assert.equal(e.chamadasMin, 1);
  assert.equal(e.chamadasMax, 2);
  assert.equal(e.orcamentoChamadas, 2);
});

test("qualquer limite dentro do teto usa 1 unica busca (sem paginacao)", () => {
  for (const n of [1, 5, 10, 19, 20]) {
    assert.equal(estimarConsumo(n).chamadasBusca, 1);
  }
});

test("valores fora do teto sao normalizados para a estimativa", () => {
  assert.equal(estimarConsumo(0).leadsAlvo, LIMITES.leadsMin);
  assert.equal(estimarConsumo(999).leadsAlvo, LIMITES.leadsMax);
  assert.equal(estimarConsumo(Number.NaN).leadsAlvo, LIMITES.leadsPadrao);
});

test("orcamento estimado bate com o pior caso (busca + geocoding)", () => {
  const e = estimarConsumo(15);
  assert.equal(e.orcamentoChamadas, e.chamadasBusca + e.geocodingMax);
});
