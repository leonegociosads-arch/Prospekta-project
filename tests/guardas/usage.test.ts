import { test } from "node:test";
import assert from "node:assert/strict";

import { registrarUso, totalChamadasNoMes, inicioDoMesUtc } from "../../lib/guardas/usage";
import { ErroDeRegistroDeUso } from "../../lib/guardas/erros";
import { criarFakeStore } from "./fake-store";

test("registrarUso grava o registro com os defaults (unidades=1, custo=0)", async () => {
  const f = criarFakeStore();
  await registrarUso(f.store, { provedor: "google", endpoint: "text_search", searchId: "s1" });

  assert.equal(f.usos.length, 1);
  assert.equal(f.usos[0].unidades, 1);
  assert.equal(f.usos[0].custoEstimadoUsd, 0);
  assert.equal(typeof f.usos[0].em, "string");
});

test("registrarUso preserva unidades/faixa/custo informados", async () => {
  const f = criarFakeStore();
  await registrarUso(f.store, {
    provedor: "google",
    endpoint: "text_search",
    unidades: 3,
    faixaCampos: "pro",
    custoEstimadoUsd: 0.096,
  });
  assert.equal(f.usos[0].unidades, 3);
  assert.equal(f.usos[0].faixaCampos, "pro");
  assert.equal(f.usos[0].custoEstimadoUsd, 0.096);
});

// ------------------------------------------------------------
// Cenario 5: falha ao registrar usage -> NAO esconder
// ------------------------------------------------------------
test("cenario 5: falha ao gravar api_usage -> lanca ErroDeRegistroDeUso (nao engole)", async () => {
  const f = criarFakeStore({}, { falharInserirUso: true });

  await assert.rejects(
    () => registrarUso(f.store, { provedor: "google", endpoint: "text_search" }),
    (err: unknown) => {
      assert.ok(err instanceof ErroDeRegistroDeUso);
      assert.ok(err.causa instanceof Error);
      assert.match(err.message, /api_usage/);
      return true;
    },
  );
  // a tentativa de insert aconteceu (nao foi pulada silenciosamente)
  assert.equal(f.contadores.inserirUso, 1);
});

test("totalChamadasNoMes soma so o mes corrente", async () => {
  const agora = new Date(Date.UTC(2026, 2, 10)); // 10/mar/2026
  const f = criarFakeStore({
    usos: [
      { provedor: "google", endpoint: "text_search", unidades: 2, em: new Date(Date.UTC(2026, 2, 1)).toISOString() },
      { provedor: "google", endpoint: "geocoding", unidades: 1, em: new Date(Date.UTC(2026, 2, 9)).toISOString() },
      { provedor: "google", endpoint: "text_search", unidades: 9, em: new Date(Date.UTC(2026, 1, 28)).toISOString() }, // fev
    ],
  });
  assert.equal(inicioDoMesUtc(agora), "2026-03-01T00:00:00.000Z");
  assert.equal(await totalChamadasNoMes(f.store, agora), 3);
});
