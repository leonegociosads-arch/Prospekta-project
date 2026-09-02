import { test } from "node:test";
import assert from "node:assert/strict";

import {
  decidirBuscaPlace,
  decidirDetalhesPlace,
  normalizarRegiao,
  regiaoEmCache,
  guardarRegiao,
} from "../../lib/guardas/cache";
import type { GuardaConfig } from "../../lib/guardas/config";
import { criarFakeStore, diasAtras } from "./fake-store";

const CONFIG: GuardaConfig = {
  tetoMensalChamadas: 5,
  ttlBuscaDias: 60,
  ttlDetalhesDias: 30,
};

// ------------------------------------------------------------
// Cenario 3: Place ID existente e cache valido -> nao pedir de novo
// ------------------------------------------------------------
test("cenario 3: cache de busca valido -> nao precisa chamar a API", async () => {
  const f = criarFakeStore({
    places: {
      abc: {
        resultado_busca: { nome: "Advocacia X" },
        detalhes: null,
        busca_em: diasAtras(3),
        detalhes_em: null,
      },
    },
  });

  const d = await decidirBuscaPlace(f.store, "abc", { config: CONFIG });
  assert.equal(d.precisa, false);
  assert.equal(d.motivo, "cache-valido");
  assert.deepEqual(d.registro?.resultado_busca, { nome: "Advocacia X" });
});

// ------------------------------------------------------------
// Cenario 4: cache expirado -> permitir atualizacao
// ------------------------------------------------------------
test("cenario 4: cache de busca expirado (mais que o TTL) -> precisa chamar a API", async () => {
  const f = criarFakeStore({
    places: {
      abc: {
        resultado_busca: { nome: "antigo" },
        detalhes: null,
        busca_em: diasAtras(100), // TTL e 60
        detalhes_em: null,
      },
    },
  });

  const d = await decidirBuscaPlace(f.store, "abc", { config: CONFIG });
  assert.equal(d.precisa, true);
  assert.equal(d.motivo, "cache-expirado");
  assert.equal(d.registro?.resultado_busca !== undefined, true); // ainda entrega o valor antigo
});

test("sem nenhum registro -> precisa chamar (sem-cache)", async () => {
  const f = criarFakeStore();
  const d = await decidirBuscaPlace(f.store, "novo", { config: CONFIG });
  assert.equal(d.precisa, true);
  assert.equal(d.motivo, "sem-cache");
  assert.equal(d.registro, null);
});

test("busca e detalhes tem TTL independentes", async () => {
  // busca fresca, mas detalhes velhos
  const f = criarFakeStore({
    places: {
      abc: {
        resultado_busca: { nome: "X" },
        detalhes: { reviews: [] },
        busca_em: diasAtras(5),
        detalhes_em: diasAtras(45), // TTL detalhes e 30
      },
    },
  });

  const busca = await decidirBuscaPlace(f.store, "abc", { config: CONFIG });
  assert.equal(busca.precisa, false);

  const detalhes = await decidirDetalhesPlace(f.store, "abc", { config: CONFIG });
  assert.equal(detalhes.precisa, true);
  assert.equal(detalhes.motivo, "cache-expirado");
});

test("detalhes ausentes -> precisa chamar Place Details", async () => {
  const f = criarFakeStore({
    places: {
      abc: {
        resultado_busca: { nome: "X" },
        detalhes: null,
        busca_em: diasAtras(1),
        detalhes_em: null,
      },
    },
  });
  const d = await decidirDetalhesPlace(f.store, "abc", { config: CONFIG });
  assert.equal(d.precisa, true);
  assert.equal(d.motivo, "sem-cache");
});

// ------------------------------------------------------------
// Cache de regiao + normalizacao
// ------------------------------------------------------------
test("regiao e normalizada antes de virar chave de cache", async () => {
  assert.equal(normalizarRegiao("  Iguape,   SP "), "iguape, sp");

  const f = criarFakeStore();
  await guardarRegiao(f.store, "Iguape, SP", -24.7, -47.55);
  const hit = await regiaoEmCache(f.store, "  iguape,  sp  ");
  assert.equal(hit?.centro_lat, -24.7);
});
