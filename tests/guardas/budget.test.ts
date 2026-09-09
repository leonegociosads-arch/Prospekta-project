import { test } from "node:test";
import assert from "node:assert/strict";

import { podeChamar } from "../../lib/guardas/budget";
import type { GuardaConfig } from "../../lib/guardas/config";
import { criarFakeStore } from "./fake-store";

const CONFIG: GuardaConfig = {
  tetoMensalChamadas: 5,
  ttlBuscaDias: 60,
  ttlDetalhesDias: 30,
  ttlSiteDias: 14,
  ttlSocialDias: 30,
  pagespeedAtivo: false,
};

// ------------------------------------------------------------
// Cenario 1: orcamento maximo da pesquisa = 1
// ------------------------------------------------------------
test("cenario 1: orcamento da pesquisa = 1 -> 1a permitida, 2a bloqueada", async () => {
  const f = criarFakeStore({
    pesquisas: { s1: { orcamento_chamadas: 1, chamadas_feitas: 0 } },
  });

  const antes = await podeChamar(f.store, { searchId: "s1" }, { config: CONFIG });
  assert.equal(antes.permitido, true);
  assert.equal(antes.motivo, "ok");

  // simula que a 1a chamada aconteceu
  await f.store.registrarConsumoPesquisa("s1", 1, 0);

  const depois = await podeChamar(f.store, { searchId: "s1" }, { config: CONFIG });
  assert.equal(depois.permitido, false);
  assert.equal(depois.motivo, "orcamento-da-pesquisa-esgotado");
});

// ------------------------------------------------------------
// Cenario 2: teto mensal atingido
// ------------------------------------------------------------
test("cenario 2: teto mensal atingido -> nenhuma nova chamada, mesmo com orcamento de pesquisa sobrando", async () => {
  const agora = new Date();
  const f = criarFakeStore({
    pesquisas: { s1: { orcamento_chamadas: 999, chamadas_feitas: 0 } },
    usos: [
      { provedor: "google", endpoint: "text_search", unidades: 5, em: agora.toISOString() },
    ],
  });

  const v = await podeChamar(f.store, { searchId: "s1" }, { agora, config: CONFIG });
  assert.equal(v.permitido, false);
  assert.equal(v.motivo, "teto-mensal-atingido");
  assert.equal(v.detalhes.chamadasNoMes, 5);
});

test("cenario 2b: teto mensal tambem bloqueia chamada sem searchId (ex.: geocoding avulso)", async () => {
  const agora = new Date();
  const f = criarFakeStore({
    usos: [{ provedor: "google", endpoint: "geocoding", unidades: 5, em: agora.toISOString() }],
  });
  const v = await podeChamar(f.store, {}, { agora, config: CONFIG });
  assert.equal(v.permitido, false);
  assert.equal(v.motivo, "teto-mensal-atingido");
});

test("uso de meses anteriores nao conta para o teto do mes atual", async () => {
  const agora = new Date(Date.UTC(2026, 5, 15)); // 15/jun/2026
  const mesPassado = new Date(Date.UTC(2026, 4, 20)).toISOString();
  const f = criarFakeStore({
    usos: [{ provedor: "google", endpoint: "text_search", unidades: 100, em: mesPassado }],
  });
  const v = await podeChamar(f.store, {}, { agora, config: CONFIG });
  assert.equal(v.permitido, true);
  assert.equal(v.detalhes.chamadasNoMes, 0);
});

test("pesquisa inexistente e bloqueada com motivo proprio", async () => {
  const f = criarFakeStore();
  const v = await podeChamar(f.store, { searchId: "nao-existe" }, { config: CONFIG });
  assert.equal(v.permitido, false);
  assert.equal(v.motivo, "pesquisa-nao-encontrada");
});
