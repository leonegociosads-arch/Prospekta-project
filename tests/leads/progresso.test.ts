import { test } from "node:test";
import assert from "node:assert/strict";

import { calcularProgressoPesquisa } from "../../lib/leads/progresso";
import type { LeadEnriquecido } from "../../lib/leads/tipos";

function lead(over: Partial<LeadEnriquecido>): LeadEnriquecido {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    nome: "Empresa X",
    categoria: null,
    endereco: null,
    telefone: null,
    site_url: null,
    instagram_url: null,
    facebook_url: null,
    avaliacao: null,
    qtd_avaliacoes: null,
    status_negocio: null,
    favorito: false,
    criado_em: "2026-01-01T00:00:00.000Z",
    score: null,
    siteAnalisado: false,
    siteSituacao: "sem-site",
    temWhatsapp: null,
    temSinalAnuncio: null,
    vereditoAnuncio: null,
    temRedeSocial: false,
    socialAnalisado: false,
    temDiagnostico: false,
    ...over,
  };
}

test("progresso: total de score conta todos os leads; site conta so quem tem site", () => {
  const leads = [
    lead({ site_url: "https://a.com", score: 80, siteAnalisado: true }),
    lead({ site_url: null, score: 40 }),
    lead({ site_url: "https://c.com" }),
  ];
  const p = calcularProgressoPesquisa(leads, 2);
  const score = p.etapas.find((e) => e.rotulo === "Score")!;
  const site = p.etapas.find((e) => e.rotulo === "Site")!;
  assert.deepEqual([score.feito, score.total], [2, 3]);
  assert.deepEqual([site.feito, site.total], [1, 2]);
  assert.equal(p.naFila, 2);
  assert.equal(p.concluido, false);
});

test("progresso: concluido so quando fila zerada e nada faltando", () => {
  const leads = [
    lead({
      site_url: "https://a.com",
      score: 80,
      siteAnalisado: true,
      socialAnalisado: true,
      vereditoAnuncio: "nenhum",
    }),
  ];
  assert.equal(calcularProgressoPesquisa(leads, 0).concluido, true);
  assert.equal(calcularProgressoPesquisa(leads, 1).concluido, false);
});

test("progresso: sem leads com site -> etapa de site fica com total 0 (nao trava o concluido)", () => {
  const leads = [lead({ site_url: null, score: 10, socialAnalisado: true })];
  const p = calcularProgressoPesquisa(leads, 0);
  const site = p.etapas.find((e) => e.rotulo === "Site")!;
  assert.equal(site.total, 0);
  assert.equal(p.concluido, true);
});
