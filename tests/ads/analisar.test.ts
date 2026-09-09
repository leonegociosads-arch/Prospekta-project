import { test } from "node:test";
import assert from "node:assert/strict";

import { analisarAds } from "../../lib/ads/analisar-ads";
import { criarFakeDbAds } from "./fake-db";
import type { ResultadoMetaAdLibrary } from "../../lib/ads/tipos";

const AGORA = () => new Date("2026-09-20T12:00:00.000Z");

const metaSim: ResultadoMetaAdLibrary = { encontrado: "sim", quantidade: 5, fonte: "api", detalhe: "5 anuncios" };
const consultarSim = async () => metaSim;
const consultarQuebra = async () => {
  throw new Error("ECONNRESET");
};

test("analisar: lead inexistente -> lead-nao-encontrado", async () => {
  const { db } = criarFakeDbAds({ lead: null });
  const r = await analisarAds({ db, agora: AGORA }, "x");
  assert.equal(r.status, "lead-nao-encontrado");
});

test("analisar: site com tags, sem token Meta -> veredito do site, linha gravada", async () => {
  const { db, tabelas } = criarFakeDbAds({
    lead: { id: "L1", nome: "Advocacia X", site_url: "https://x.br", facebook_url: null },
    site: { lead_id: "L1", tem_google_ads: true, tem_meta_pixel: true, tem_doubleclick: false, tem_gtm: false, sinais: {} },
  });
  const r = await analisarAds({ db, agora: AGORA, metaToken: "" }, "L1", { forcar: true });
  assert.equal(r.status, "ok");
  assert.equal(r.veredito, "forte");
  const row = tabelas.ad_signals[0];
  assert.equal(row.lead_id, "L1");
  assert.equal(row.meta_ads_encontrado, "desconhecido");
  assert.equal(row.google_ads_no_site, true);
  assert.equal((row.sinais as { meta: { fonte: string } }).meta.fonte, "nao-configurado");
});

test("analisar: sem boletim de site -> veredito null", async () => {
  const { db, tabelas } = criarFakeDbAds({
    lead: { id: "L2", nome: "Sem site", site_url: null, facebook_url: null },
  });
  const r = await analisarAds({ db, agora: AGORA }, "L2", { forcar: true });
  assert.equal(r.veredito, null);
  assert.equal((tabelas.ad_signals[0].evidencias as { resumo: string }).resumo.includes("não foi analisado"), true);
});

test("analisar: token + Meta 'sim' -> forte/alta e api_usage registrado", async () => {
  const { db, tabelas } = criarFakeDbAds({
    lead: { id: "L3", nome: "Padaria Z", site_url: "https://z.br", facebook_url: null },
    site: { lead_id: "L3", tem_google_ads: false, tem_meta_pixel: false },
  });
  const r = await analisarAds({ db, agora: AGORA, metaToken: "tok", consultarMeta: consultarSim }, "L3", { forcar: true });
  assert.equal(r.veredito, "forte");
  assert.equal(r.confianca, "alta");
  assert.equal(tabelas.ad_signals[0].meta_ads_encontrado, "sim");
  assert.equal(tabelas.ad_signals[0].meta_ads_qtd, 5);
  assert.equal(tabelas.api_usage.filter((u) => u.provedor === "meta").length, 1);
});

test("analisar: Meta quebra -> nao lanca, veredito ainda sai do site", async () => {
  const { db, tabelas } = criarFakeDbAds({
    lead: { id: "L4", nome: "Bar W", site_url: "https://w.br", facebook_url: null },
    site: { lead_id: "L4", tem_google_ads: true, tem_doubleclick: true, tem_meta_pixel: true },
  });
  const r = await analisarAds({ db, agora: AGORA, metaToken: "tok", consultarMeta: consultarQuebra }, "L4", { forcar: true });
  assert.equal(r.status, "ok");
  assert.equal(r.veredito, "forte");
  assert.equal(tabelas.ad_signals[0].meta_ads_encontrado, "desconhecido");
});

test("analisar: cache dentro do TTL -> pulado-cache", async () => {
  const { db } = criarFakeDbAds({
    lead: { id: "L5", nome: "X", site_url: null, facebook_url: null },
    adSignal: { lead_id: "L5", verificado_em: "2026-09-19T00:00:00.000Z", veredito: "nenhum" },
  });
  const r = await analisarAds({ db, agora: AGORA }, "L5");
  assert.equal(r.status, "pulado-cache");
});
