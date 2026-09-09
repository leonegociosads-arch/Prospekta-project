import { test } from "node:test";
import assert from "node:assert/strict";

import { coletarEntradaDiagnostico, marcoMaisRecente } from "../../lib/ia/coletar-entrada";
import { criarFakeDbIa } from "./fake-db";

test("coleta: campos ausentes viram 'nao_avaliado' explicito", async () => {
  const { db } = criarFakeDbIa({
    lead: {
      id: "L1",
      nome: "Advocacia X",
      categoria: null,
      endereco: "Rua 1",
      telefone: null,
      status_negocio: "OPERATIONAL",
      avaliacao: 4.5,
      qtd_avaliacoes: 80,
      site_url: "https://x.adv.br",
      instagram_url: null,
      facebook_url: null,
      horarios: null,
      google_place_id: null,
      enriquecido_em: null,
    },
    score: { lead_id: "L1", total: 72, calculado_em: "2026-08-30T00:00:00.000Z", detalhamento: { confianca: "alta", fatores: [{ rotulo: "Problemas", pontos: 20, peso: 35, motivo: "sem CTA" }], moderadores: [] } },
    site: { lead_id: "L1", verificado_em: "2026-08-31T00:00:00.000Z", site_existe: true, https: true, tem_whatsapp: false, tem_formulario: false, erro: null },
  });

  const r = await coletarEntradaDiagnostico(db, "L1");
  assert.ok(r);
  if (!r) return;

  assert.equal(r.entrada.empresa.nome, "Advocacia X");
  assert.equal(r.entrada.empresa.categoria, "nao_avaliado");
  assert.equal(r.entrada.empresa.telefone, "nao_avaliado");
  assert.equal(r.entrada.empresa.endereco, "Rua 1");
  assert.equal(r.entrada.empresa.horarios, "nao_avaliado");
  assert.equal(r.entrada.presenca_social, "nao_avaliado");
  assert.equal(r.entrada.avaliacoes_recentes, "nao_avaliado");

  assert.notEqual(r.entrada.score, "nao_avaliado");
  if (r.entrada.score !== "nao_avaliado") {
    assert.equal(r.entrada.score.total, 72);
    assert.equal(r.entrada.score.fatores[0].rotulo, "Problemas");
  }
  assert.notEqual(r.entrada.site, "nao_avaliado");
  if (r.entrada.site !== "nao_avaliado") {
    assert.equal(r.entrada.site.tem_whatsapp, false);
    assert.equal(r.entrada.site.responde, true);
  }

  assert.equal(r.scoreTotal, 72);
  assert.equal(marcoMaisRecente(r.marcos), "2026-08-31T00:00:00.000Z");
});

test("coleta: lead inexistente -> null", async () => {
  const { db } = criarFakeDbIa({ lead: null });
  assert.equal(await coletarEntradaDiagnostico(db, "nope"), null);
});

test("coleta: sem score -> entrada.score 'nao_avaliado' e scoreTotal null", async () => {
  const { db } = criarFakeDbIa({
    lead: { id: "L2", nome: "Sem score", google_place_id: null, horarios: null },
  });
  const r = await coletarEntradaDiagnostico(db, "L2");
  assert.ok(r);
  assert.equal(r?.entrada.score, "nao_avaliado");
  assert.equal(r?.scoreTotal, null);
});
