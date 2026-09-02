import { test } from "node:test";
import assert from "node:assert/strict";

import { chamarComGuardas } from "../../lib/guardas/index";
import { ErroDeOrcamento, ErroDeRegistroDeUso } from "../../lib/guardas/erros";
import { decidirBuscaPlace, guardarBuscaPlace } from "../../lib/guardas/cache";
import type { GuardaConfig } from "../../lib/guardas/config";
import { criarFakeStore } from "./fake-store";

const CONFIG: GuardaConfig = {
  tetoMensalChamadas: 5,
  ttlBuscaDias: 60,
  ttlDetalhesDias: 30,
};

const PLANO = { provedor: "google", endpoint: "text_search", searchId: "s1" } as const;

// ------------------------------------------------------------
// Cenario 1 fim-a-fim pelo orquestrador
// ------------------------------------------------------------
test("cenario 1 (orquestrador): orcamento=1 -> 1a executa, 2a nem chama a API", async () => {
  const f = criarFakeStore({ pesquisas: { s1: { orcamento_chamadas: 1, chamadas_feitas: 0 } } });
  let chamadasReais = 0;
  const executar = async () => {
    chamadasReais++;
    return { ok: true };
  };

  const r1 = await chamarComGuardas(f.store, PLANO, executar, { config: CONFIG });
  assert.deepEqual(r1, { ok: true });
  assert.equal(chamadasReais, 1);
  assert.equal(f.usos.length, 1);
  assert.equal(f.pesquisas.get("s1")?.chamadas_feitas, 1);

  await assert.rejects(
    () => chamarComGuardas(f.store, PLANO, executar, { config: CONFIG }),
    (e: unknown) => e instanceof ErroDeOrcamento && e.motivo === "orcamento-da-pesquisa-esgotado",
  );
  assert.equal(chamadasReais, 1, "a API externa NAO pode ser chamada quando bloqueado");
  assert.equal(f.usos.length, 1, "nada registrado na chamada bloqueada");
});

// ------------------------------------------------------------
// Cenario 2 pelo orquestrador
// ------------------------------------------------------------
test("cenario 2 (orquestrador): teto mensal atingido -> bloqueia antes de executar", async () => {
  const agora = new Date();
  const f = criarFakeStore({
    pesquisas: { s1: { orcamento_chamadas: 999, chamadas_feitas: 0 } },
    usos: [{ provedor: "google", endpoint: "text_search", unidades: 5, em: agora.toISOString() }],
  });
  let chamou = false;

  await assert.rejects(
    () => chamarComGuardas(f.store, PLANO, async () => { chamou = true; return 1; }, { agora, config: CONFIG }),
    (e: unknown) => e instanceof ErroDeOrcamento && e.motivo === "teto-mensal-atingido",
  );
  assert.equal(chamou, false);
});

// ------------------------------------------------------------
// Cenario 5 pelo orquestrador
// ------------------------------------------------------------
test("cenario 5 (orquestrador): API executa mas o registro de uso falha -> erro sobe", async () => {
  const f = criarFakeStore(
    { pesquisas: { s1: { orcamento_chamadas: 10, chamadas_feitas: 0 } } },
    { falharInserirUso: true },
  );
  let chamou = false;

  await assert.rejects(
    () => chamarComGuardas(f.store, PLANO, async () => { chamou = true; return "dados"; }, { config: CONFIG }),
    (e: unknown) => e instanceof ErroDeRegistroDeUso,
  );
  assert.equal(chamou, true, "a chamada externa ja tinha acontecido");
  assert.equal(
    f.contadores.registrarConsumoPesquisa,
    0,
    "o contador da pesquisa NAO e incrementado se o registro de uso falhou",
  );
});

// ------------------------------------------------------------
// Erro da propria API externa (timeout / 429 / 500)
// ------------------------------------------------------------
test("se a chamada externa falha (ex.: 429), nada e registrado nem incrementado", async () => {
  const f = criarFakeStore({ pesquisas: { s1: { orcamento_chamadas: 10, chamadas_feitas: 0 } } });

  await assert.rejects(
    () => chamarComGuardas(f.store, PLANO, async () => { throw new Error("HTTP 429"); }, { config: CONFIG }),
    /429/,
  );
  assert.equal(f.usos.length, 0);
  assert.equal(f.pesquisas.get("s1")?.chamadas_feitas, 0);
});

// ------------------------------------------------------------
// Cenario 6: duas execucoes tentando processar o mesmo Place ID
// ------------------------------------------------------------
test("cenario 6: 2a execucao ve o cache da 1a e nao chama a API de novo", async () => {
  const f = criarFakeStore();
  let chamadasAPI = 0;
  const buscarNaGoogle = async () => {
    chamadasAPI++;
    return { nome: "Advocacia Y" };
  };

  // Execucao A
  const dA = await decidirBuscaPlace(f.store, "place-1", { config: CONFIG });
  assert.equal(dA.precisa, true);
  const resA = await buscarNaGoogle();
  await guardarBuscaPlace(f.store, "place-1", resA);

  // Execucao B (depois de A ter gravado)
  const dB = await decidirBuscaPlace(f.store, "place-1", { config: CONFIG });
  assert.equal(dB.precisa, false, "B deve reaproveitar o cache de A");

  assert.equal(chamadasAPI, 1, "a API so foi chamada uma vez");
});

test("cenario 6b: gravar o mesmo Place ID duas vezes nao duplica linha (upsert por PK)", async () => {
  const f = criarFakeStore();
  await guardarBuscaPlace(f.store, "place-1", { v: "A" });
  await guardarBuscaPlace(f.store, "place-1", { v: "B" });
  assert.equal(f.places.size, 1);
  assert.deepEqual(f.places.get("place-1")?.resultado_busca, { v: "B" });
});
