import { test } from "node:test";
import assert from "node:assert/strict";

import { montarVeredito } from "../../lib/ads/veredito";
import type { ResultadoMetaAdLibrary, SinaisNoSite } from "../../lib/ads/tipos";

const metaDesconhecida: ResultadoMetaAdLibrary = { encontrado: "desconhecido", quantidade: null, fonte: "nao-configurado", detalhe: null };
const metaSim: ResultadoMetaAdLibrary = { encontrado: "sim", quantidade: 4, fonte: "api", detalhe: "4 anuncios ativos" };

function site(over: Partial<SinaisNoSite>): SinaisNoSite {
  const base: SinaisNoSite = {
    temTagConversaoGoogle: false,
    temRemarketingDoubleclick: false,
    temMetaPixel: false,
    temGtm: false,
    temParametrosCampanha: false,
    sinais: [],
    ...over,
  };
  // reconstroi a lista de sinais a partir dos booleanos, com pesos plausiveis
  const s: SinaisNoSite["sinais"] = [];
  if (base.temTagConversaoGoogle) s.push({ chave: "tag_conversao_google", rotulo: "Tag de conversão", peso: 0.55, evidencia: "x" });
  if (base.temRemarketingDoubleclick) s.push({ chave: "remarketing_doubleclick", rotulo: "Remarketing", peso: 0.45, evidencia: "x" });
  if (base.temParametrosCampanha) s.push({ chave: "parametros_campanha", rotulo: "Campanha", peso: 0.35, evidencia: "x" });
  if (base.temMetaPixel) s.push({ chave: "meta_pixel", rotulo: "Pixel", peso: 0.25, evidencia: "x" });
  if (base.temGtm) s.push({ chave: "gtm", rotulo: "GTM", peso: 0.1, evidencia: "x" });
  base.sinais = over.sinais ?? s;
  return base;
}

test("Meta 'sim' -> forte + confianca alta, mesmo sem sinais no site", () => {
  const d = montarVeredito(site({}), metaSim);
  assert.equal(d.veredito, "forte");
  assert.equal(d.confianca, "alta");
});

test("site nao analisado + Meta desconhecida -> veredito null", () => {
  const d = montarVeredito(null, metaDesconhecida);
  assert.equal(d.veredito, null);
  assert.equal(d.confianca, "baixa");
  assert.match(d.resumo, /não foi analisado/);
});

test("site sem nenhum sinal -> 'nenhum' com confianca baixa (nunca afirma nao anuncia)", () => {
  const d = montarVeredito(site({}), metaDesconhecida);
  assert.equal(d.veredito, "nenhum");
  assert.equal(d.confianca, "baixa");
  assert.match(d.resumo, /NÃO confirma/i);
});

test("tag de conversao + pixel -> forte (confianca media)", () => {
  const d = montarVeredito(site({ temTagConversaoGoogle: true, temMetaPixel: true }), metaDesconhecida);
  assert.equal(d.veredito, "forte");
  assert.equal(d.confianca, "media");
});

test("so tag de conversao -> alguns (confianca media)", () => {
  const d = montarVeredito(site({ temTagConversaoGoogle: true }), metaDesconhecida);
  assert.equal(d.veredito, "alguns");
  assert.equal(d.confianca, "media");
});

test("so meta pixel -> alguns, confianca baixa (pode ser so medicao)", () => {
  const d = montarVeredito(site({ temMetaPixel: true }), metaDesconhecida);
  assert.equal(d.veredito, "alguns");
  assert.equal(d.confianca, "baixa");
});

test("parametros de campanha sozinhos -> alguns", () => {
  const d = montarVeredito(site({ temParametrosCampanha: true }), metaDesconhecida);
  assert.equal(d.veredito, "alguns");
});
