import { test } from "node:test";
import assert from "node:assert/strict";

import { extrairSinaisNoSite } from "../../lib/ads/onsite-signals";

test("onsite: site nao analisado -> null", () => {
  assert.equal(extrairSinaisNoSite(null), null);
});

test("onsite: tag de conversao + pixel + evidencias", () => {
  const s = extrairSinaisNoSite({
    tem_google_ads: true,
    tem_doubleclick: false,
    tem_meta_pixel: true,
    tem_gtm: false,
    sinais: { evidencias: { googleAds: ["googleadservices.com/pagead/conversion"], metaPixel: ["fbq('init'"] } },
  });
  assert.ok(s);
  if (!s) return;
  assert.equal(s.temTagConversaoGoogle, true);
  assert.equal(s.temMetaPixel, true);
  const chaves = s.sinais.map((x) => x.chave);
  assert.ok(chaves.includes("tag_conversao_google"));
  assert.ok(chaves.includes("meta_pixel"));
  const tag = s.sinais.find((x) => x.chave === "tag_conversao_google")!;
  assert.ok(tag.peso > 0.5, "tag de conversao pesa mais que pixel");
  assert.match(tag.evidencia, /googleadservices/);
});

test("onsite: parametros de campanha lidos das evidencias", () => {
  const s = extrairSinaisNoSite({
    tem_google_ads: false,
    sinais: { evidencias: { parametrosCampanha: ['href="/promo?utm_source=instagram&utm_medium=bio'] } },
  });
  assert.equal(s?.temParametrosCampanha, true);
  assert.ok(s?.sinais.some((x) => x.chave === "parametros_campanha"));
});

test("onsite: site analisado sem nada -> zero sinais", () => {
  const s = extrairSinaisNoSite({
    tem_google_ads: false,
    tem_doubleclick: false,
    tem_meta_pixel: false,
    tem_gtm: false,
    sinais: {},
  });
  assert.equal(s?.sinais.length, 0);
});
