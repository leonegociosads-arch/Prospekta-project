import { test } from "node:test";
import assert from "node:assert/strict";

import { diagnosticarLead } from "../../lib/ia/diagnosticar";
import { ErroDeOrcamento } from "../../lib/guardas";
import type { ConfigIa } from "../../lib/ia/config-ia";
import type { RespostaModelo } from "../../lib/ia/provedor";
import { criarFakeDbIa, type SeedIa } from "./fake-db";

const CFG: ConfigIa = {
  modelo: "gemini-2.0-flash",
  scoreMinimo: 70,
  topN: 5,
  tetoMensalUsd: 5,
  ttlDias: 30,
  temperatura: 0,
};

const AGORA = () => new Date("2026-09-15T12:00:00.000Z");

const RESPOSTA_OK = JSON.stringify({
  resumo: "Empresa ativa, boa reputacao, mas site sem WhatsApp e sem formulario.",
  problemas: ["site sem WhatsApp", "site sem formulario"],
  oportunidades: ["captacao de leads no site"],
  servico_sugerido: "Landing page + trafego",
  angulo_comercial: "Site recebe visita e nao gera contato",
  confianca: "media",
  fatos_utilizados: ["score 85", "tem_whatsapp=false"],
});

function criarModelo(modo: "ok" | "lixo" = "ok") {
  const estado = { chamadas: 0, modo };
  const fn = async (): Promise<RespostaModelo> => {
    estado.chamadas++;
    return estado.modo === "lixo"
      ? { texto: "nao consigo responder em json", tokensEntrada: 700, tokensSaida: 30 }
      : { texto: RESPOSTA_OK, tokensEntrada: 1500, tokensSaida: 380 };
  };
  return { fn, estado };
}

const leadBase = {
  id: "L1",
  nome: "Advocacia Teste",
  categoria: "Advogado",
  endereco: "Rua 1",
  telefone: "11999999999",
  status_negocio: "OPERATIONAL",
  avaliacao: 4.7,
  qtd_avaliacoes: 120,
  site_url: "https://teste.adv.br",
  instagram_url: null,
  facebook_url: null,
  horarios: null,
  google_place_id: null,
  enriquecido_em: null,
};

function seedComScore(total: number): SeedIa {
  return {
    lead: { ...leadBase },
    score: {
      lead_id: "L1",
      total,
      calculado_em: "2026-09-01T00:00:00.000Z",
      detalhamento: { confianca: "alta", fatores: [], moderadores: [] },
    },
    site: { lead_id: "L1", verificado_em: "2026-09-02T00:00:00.000Z", site_existe: true, tem_whatsapp: false },
  };
}

test("diagnosticar: lead inexistente -> lead-nao-encontrado", async () => {
  const { db } = criarFakeDbIa({ lead: null });
  const { fn } = criarModelo();
  const r = await diagnosticarLead({ db, chamarModelo: fn, config: CFG, agora: AGORA }, "x");
  assert.equal(r.status, "lead-nao-encontrado");
});

test("diagnosticar: lead sem score -> sem-score, modelo nao e chamado", async () => {
  const { db } = criarFakeDbIa({ lead: { ...leadBase } });
  const { fn, estado } = criarModelo();
  const r = await diagnosticarLead({ db, chamarModelo: fn, config: CFG, agora: AGORA }, "L1", {
    ignorarElegibilidade: true,
  });
  assert.equal(r.status, "sem-score");
  assert.equal(estado.chamadas, 0);
});

test("diagnosticar: score 50 sem pesquisa e sem 'ignorar' -> nao-elegivel", async () => {
  const { db, tabelas } = criarFakeDbIa(seedComScore(50));
  const { fn, estado } = criarModelo();
  const r = await diagnosticarLead({ db, chamarModelo: fn, config: CFG, agora: AGORA }, "L1");
  assert.equal(r.status, "nao-elegivel");
  assert.equal(estado.chamadas, 0);
  assert.equal(tabelas.ai_diagnoses.length, 0);
});

test("diagnosticar: score alto -> gerado, grava ai_diagnoses + api_usage", async () => {
  const { db, tabelas } = criarFakeDbIa(seedComScore(85));
  const { fn, estado } = criarModelo();
  const r = await diagnosticarLead({ db, chamarModelo: fn, config: CFG, agora: AGORA }, "L1", {
    ignorarElegibilidade: true,
  });
  assert.equal(r.status, "gerado");
  assert.equal(estado.chamadas, 1);
  assert.ok(r.custoUsd > 0);

  const row = tabelas.ai_diagnoses[0];
  assert.equal(row.lead_id, "L1");
  assert.equal(row.modelo, "gemini-2.0-flash");
  assert.equal(typeof row.resumo, "string");
  assert.deepEqual(row.problemas, ["site sem WhatsApp", "site sem formulario"]);
  assert.equal(row.tokens_entrada, 1500);
  assert.equal(row.erro, null);
  assert.ok(row.entrada, "grava o dossie enviado");

  const usoIa = tabelas.api_usage.filter((u) => u.provedor === "ia");
  assert.equal(usoIa.length, 1);
  assert.equal(usoIa[0].endpoint, "ia_diagnosis");
});

test("diagnosticar: 2a chamada -> cache (modelo nao e chamado de novo)", async () => {
  const { db } = criarFakeDbIa(seedComScore(85));
  const { fn, estado } = criarModelo();
  const deps = { db, chamarModelo: fn, config: CFG, agora: AGORA };
  await diagnosticarLead(deps, "L1", { ignorarElegibilidade: true });
  const r2 = await diagnosticarLead(deps, "L1", { ignorarElegibilidade: true });
  assert.equal(r2.status, "cache");
  assert.equal(estado.chamadas, 1);
});

test("diagnosticar: forcar -> ignora cache e chama de novo", async () => {
  const { db } = criarFakeDbIa(seedComScore(85));
  const { fn, estado } = criarModelo();
  const deps = { db, chamarModelo: fn, config: CFG, agora: AGORA };
  await diagnosticarLead(deps, "L1", { ignorarElegibilidade: true });
  const r2 = await diagnosticarLead(deps, "L1", { forcar: true });
  assert.equal(r2.status, "gerado");
  assert.equal(estado.chamadas, 2);
});

test("diagnosticar: modelo devolve lixo -> retry -> erro-modelo, sem lancar", async () => {
  const { db, tabelas } = criarFakeDbIa(seedComScore(90));
  const { fn, estado } = criarModelo("lixo");
  const r = await diagnosticarLead({ db, chamarModelo: fn, config: CFG, agora: AGORA }, "L1", {
    ignorarElegibilidade: true,
  });
  assert.equal(r.status, "erro-modelo");
  assert.equal(estado.chamadas, 2);
  assert.equal(tabelas.ai_diagnoses[0].resumo, null);
  assert.equal(typeof tabelas.ai_diagnoses[0].erro, "string");
});

test("diagnosticar: teto de gasto atingido -> ErroDeOrcamento", async () => {
  const { db } = criarFakeDbIa(seedComScore(95));
  const { fn } = criarModelo();
  await assert.rejects(
    () =>
      diagnosticarLead(
        { db, chamarModelo: fn, config: { ...CFG, tetoMensalUsd: 0 }, agora: AGORA },
        "L1",
        { ignorarElegibilidade: true },
      ),
    ErroDeOrcamento,
  );
});
