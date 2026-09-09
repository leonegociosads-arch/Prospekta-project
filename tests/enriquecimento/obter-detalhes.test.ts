import { test } from "node:test";
import assert from "node:assert/strict";

import { obterDetalhesPlace } from "../../lib/enriquecimento/obter-detalhes";
import { ErroDeOrcamento } from "../../lib/guardas/erros";
import type { GuardaConfig } from "../../lib/guardas/config";
import { criarFakeStore, diasAtras } from "../guardas/fake-store";

const CONFIG: GuardaConfig = {
  tetoMensalChamadas: 100,
  ttlBuscaDias: 60,
  ttlDetalhesDias: 30,
  ttlSiteDias: 14,
  ttlSocialDias: 30,
  pagespeedAtivo: false,
};

function fetchJson(body: unknown, capturar?: (h: Record<string, string>) => void) {
  return (async (_u: string, init: RequestInit) => {
    capturar?.(init.headers as Record<string, string>);
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

test("cache valido dentro do TTL -> nao chama o Google, fonte 'cache'", async () => {
  const { store } = criarFakeStore({
    places: { P1: { resultado_busca: {}, detalhes: { id: "P1" }, busca_em: diasAtras(2), detalhes_em: diasAtras(2) } },
  });
  let chamou = false;
  const f = (async () => {
    chamou = true;
    return new Response("{}");
  }) as unknown as typeof fetch;

  const r = await obterDetalhesPlace(store, { placeId: "P1", incluirReviews: false, apiKey: "K", fetchImpl: f, config: CONFIG });
  assert.equal(r.fonte, "cache");
  assert.equal(chamou, false);
});

test("sem cache -> cria linha, chama 1x, registra uso, grava detalhes", async () => {
  const { store, usos, places } = criarFakeStore({ places: {} });
  const r = await obterDetalhesPlace(store, {
    placeId: "P2", incluirReviews: false, apiKey: "K", config: CONFIG,
    fetchImpl: fetchJson({ id: "P2", rating: 4.1 }),
  });
  assert.equal(r.fonte, "google");
  assert.equal(usos.length, 1);
  assert.equal(usos[0].endpoint, "place_details");
  assert.equal(usos[0].faixaCampos, "enterprise");
  assert.deepEqual(places.get("P2")?.detalhes, { id: "P2", rating: 4.1 });
});

test("cache expirado -> chama de novo", async () => {
  const { store, usos } = criarFakeStore({
    places: { P3: { resultado_busca: {}, detalhes: { id: "P3" }, busca_em: diasAtras(40), detalhes_em: diasAtras(40) } },
  });
  const r = await obterDetalhesPlace(store, {
    placeId: "P3", incluirReviews: false, apiKey: "K", config: CONFIG,
    fetchImpl: fetchJson({ id: "P3", rating: 5 }),
  });
  assert.equal(r.fonte, "google");
  assert.equal(usos.length, 1);
});

test("budget estourado -> ErroDeOrcamento; nao chama, nao grava, nao registra", async () => {
  const { store, usos, places } = criarFakeStore({
    places: { P4: { resultado_busca: {}, detalhes: null, busca_em: diasAtras(1), detalhes_em: null } },
    usos: [{ provedor: "google", endpoint: "text_search", unidades: 100, em: new Date().toISOString() }],
  });
  let chamou = false;
  const f = (async () => {
    chamou = true;
    return new Response("{}");
  }) as unknown as typeof fetch;

  await assert.rejects(
    () => obterDetalhesPlace(store, { placeId: "P4", incluirReviews: false, apiKey: "K", fetchImpl: f, config: CONFIG }),
    ErroDeOrcamento,
  );
  assert.equal(chamou, false);
  assert.equal(usos.length, 1); // so o seed
  assert.equal(places.get("P4")?.detalhes, null);
});

test("incluirReviews -> FieldMask enviado contem 'reviews' e faixa 'atmosphere'", async () => {
  const { store, usos } = criarFakeStore({ places: {} });
  let fieldMask = "";
  await obterDetalhesPlace(store, {
    placeId: "P5", incluirReviews: true, apiKey: "K", config: CONFIG,
    fetchImpl: fetchJson({ id: "P5" }, (h) => { fieldMask = h["X-Goog-FieldMask"]; }),
  });
  assert.ok(fieldMask.includes("reviews"));
  assert.ok(!fieldMask.includes("*"));
  assert.equal(usos[0].faixaCampos, "atmosphere");
});

test("sem apiKey e sem cache -> erro claro", async () => {
  const { store } = criarFakeStore({ places: {} });
  await assert.rejects(
    () => obterDetalhesPlace(store, { placeId: "P6", incluirReviews: false, config: CONFIG }),
    /GOOGLE_MAPS_API_KEY/,
  );
});
