import { test } from "node:test";
import assert from "node:assert/strict";

import { numeroDeEnv, carregarGuardaConfig, LIMITES_GUARDA } from "../../lib/guardas/config";
import { carregarConfigIa, LIMITES_IA } from "../../lib/ia/config-ia";
import {
  resumirUso,
  blocoLimitesInternos,
  blocoPesosScore,
  blocoTtlCache,
} from "../../lib/config/inspecao";

function comEnv(vars: Record<string, string>, fn: () => void) {
  const antigo: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    antigo[k] = process.env[k];
    process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (antigo[k] === undefined) delete process.env[k];
      else process.env[k] = antigo[k];
    }
  }
}

test("numeroDeEnv: usa padrao quando ausente, limita a faixa", () => {
  const faixa = { min: 1, max: 100, padrao: 10 };
  comEnv({}, () => assert.equal(numeroDeEnv("NAO_EXISTE_XYZ", faixa), 10));
  comEnv({ X_TESTE: "9999" }, () => assert.equal(numeroDeEnv("X_TESTE", faixa), 100));
  comEnv({ X_TESTE: "-5" }, () => assert.equal(numeroDeEnv("X_TESTE", faixa), 1));
  comEnv({ X_TESTE: "abc" }, () => assert.equal(numeroDeEnv("X_TESTE", faixa), 10));
  comEnv({ X_TESTE: "42" }, () => assert.equal(numeroDeEnv("X_TESTE", faixa), 42));
});

test("config: valor absurdo de teto de IA e cortado para o maximo", () => {
  comEnv({ PROSPEKTA_IA_TETO_MENSAL_USD: "100000" }, () => {
    const ia = carregarConfigIa();
    assert.equal(ia.tetoMensalUsd, LIMITES_IA.tetoMensalUsd.max);
  });
});

test("config: TTL de cache 0 e elevado para o minimo (nao rechama toda hora)", () => {
  comEnv({ PROSPEKTA_CACHE_TTL_SITE_DIAS: "0" }, () => {
    const g = carregarGuardaConfig();
    assert.equal(g.ttlSiteDias, LIMITES_GUARDA.ttlSiteDias.min);
  });
});

test("bloco limites internos: mostra aviso quando o valor foi ajustado", () => {
  comEnv({ PROSPEKTA_IA_TETO_MENSAL_USD: "100000" }, () => {
    const bloco = blocoLimitesInternos();
    const linha = bloco.linhas.find((l) => l.envVar === "PROSPEKTA_IA_TETO_MENSAL_USD");
    assert.ok(linha?.aviso, "esperava um aviso de ajuste");
  });
});

test("bloco TTL: todas as linhas com faixa", () => {
  const bloco = blocoTtlCache();
  assert.ok(bloco.linhas.length >= 5);
  assert.ok(bloco.linhas.every((l) => l.faixa));
});

test("bloco pesos do score: total = 100", () => {
  const bloco = blocoPesosScore();
  const total = bloco.linhas.find((l) => l.rotulo === "Total");
  assert.ok(total?.valor.startsWith("100"));
});

test("resumirUso: agrupa por endpoint e soma totais", () => {
  const r = resumirUso([
    { provedor: "google", endpoint: "text_search", unidades: 1, custo_estimado_usd: 0 },
    { provedor: "google", endpoint: "text_search", unidades: 1, custo_estimado_usd: 0 },
    { provedor: "google", endpoint: "geocoding", unidades: 1, custo_estimado_usd: 0 },
    { provedor: "ia", endpoint: "ia_diagnosis", unidades: 1, custo_estimado_usd: 0.0004 },
  ]);
  assert.equal(r.googleTotal, 3);
  assert.equal(r.iaTotal, 1);
  assert.equal(r.custoUsdTotal, 0.0004);
  const ts = r.porEndpoint.find((e) => e.endpoint === "text_search");
  assert.equal(ts?.chamadas, 2);
});
