import { test } from "node:test";
import assert from "node:assert/strict";

import { estimarCustoUsd, precoDoModelo, PRECO_DESCONHECIDO } from "../../lib/ia/custos";

test("custo: gemini-2.0-flash com tokens conhecidos", () => {
  // 2000 in * 0.10/1M + 700 out * 0.40/1M = 0.0002 + 0.00028 = 0.00048
  const c = estimarCustoUsd("gemini-2.0-flash", 2000, 700);
  assert.equal(c, 0.00048);
});

test("custo: modelo desconhecido usa a tarifa conservadora (nao subestima)", () => {
  assert.deepEqual(precoDoModelo("modelo-que-nao-existe"), PRECO_DESCONHECIDO);
  const c = estimarCustoUsd("modelo-que-nao-existe", 1_000_000, 0);
  assert.equal(c, PRECO_DESCONHECIDO.entradaPorMilhao);
});

test("custo: tokens invalidos/negativos contam como zero", () => {
  assert.equal(estimarCustoUsd("gemini-2.0-flash", -5, Number.NaN), 0);
});
