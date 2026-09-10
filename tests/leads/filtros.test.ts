import { test } from "node:test";
import assert from "node:assert/strict";

import {
  aplicarCriterios,
  ordenarLeads,
  contarFiltrosAtivos,
  CRITERIOS_PADRAO,
} from "../../lib/leads/filtros";
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
    adsAnalisado: false,
    temRedeSocial: false,
    socialAnalisado: false,
    temDiagnostico: false,
    ...over,
  };
}

test("busca: casa nome, categoria e endereco, ignorando acento e caixa", () => {
  const leads = [
    lead({ nome: "Advocacia Sao Joao" }),
    lead({ nome: "Padaria", categoria: "Panificadora", endereco: "Rua das Flores" }),
  ];
  assert.equal(aplicarCriterios(leads, { ...CRITERIOS_PADRAO, busca: "são joão" }).length, 1);
  assert.equal(aplicarCriterios(leads, { ...CRITERIOS_PADRAO, busca: "flores" }).length, 1);
  assert.equal(aplicarCriterios(leads, { ...CRITERIOS_PADRAO, busca: "xyz" }).length, 0);
});

test("faixa de score", () => {
  const leads = [
    lead({ id: "a", score: 82 }),
    lead({ id: "b", score: 55 }),
    lead({ id: "c", score: 20 }),
    lead({ id: "d", score: null }),
  ];
  assert.deepEqual(aplicarCriterios(leads, { ...CRITERIOS_PADRAO, faixaScore: "alto" }).map((l) => l.id), ["a"]);
  assert.deepEqual(aplicarCriterios(leads, { ...CRITERIOS_PADRAO, faixaScore: "medio" }).map((l) => l.id), ["b"]);
  assert.deepEqual(aplicarCriterios(leads, { ...CRITERIOS_PADRAO, faixaScore: "baixo" }).map((l) => l.id), ["c"]);
  assert.deepEqual(aplicarCriterios(leads, { ...CRITERIOS_PADRAO, faixaScore: "sem" }).map((l) => l.id), ["d"]);
});

test("filtro com/sem site", () => {
  const leads = [lead({ id: "a", site_url: "https://a.com" }), lead({ id: "b", site_url: null }), lead({ id: "c", site_url: "  " })];
  assert.deepEqual(aplicarCriterios(leads, { ...CRITERIOS_PADRAO, site: "com" }).map((l) => l.id), ["a"]);
  assert.deepEqual(
    aplicarCriterios(leads, { ...CRITERIOS_PADRAO, site: "sem" }).map((l) => l.id).sort(),
    ["b", "c"],
  );
});

test("filtro por sinal de anuncio: 'sem' exclui os nao analisados (null)", () => {
  const leads = [
    lead({ id: "com", temSinalAnuncio: true }),
    lead({ id: "sem", temSinalAnuncio: false }),
    lead({ id: "desconhecido", temSinalAnuncio: null }),
  ];
  assert.deepEqual(aplicarCriterios(leads, { ...CRITERIOS_PADRAO, anuncio: "com" }).map((l) => l.id), ["com"]);
  assert.deepEqual(aplicarCriterios(leads, { ...CRITERIOS_PADRAO, anuncio: "sem" }).map((l) => l.id), ["sem"]);
});

test("só favoritos", () => {
  const leads = [lead({ id: "f", favorito: true }), lead({ id: "n", favorito: false })];
  assert.deepEqual(aplicarCriterios(leads, { ...CRITERIOS_PADRAO, soFavoritos: true }).map((l) => l.id), ["f"]);
});

test("ordenacao por score: sem score vai para o fim, empate por avaliacoes", () => {
  const leads = [
    lead({ id: "semscore", score: null, qtd_avaliacoes: 999 }),
    lead({ id: "meio", score: 50, qtd_avaliacoes: 2 }),
    lead({ id: "alto1", score: 80, qtd_avaliacoes: 5 }),
    lead({ id: "alto2", score: 80, qtd_avaliacoes: 40 }),
  ];
  assert.deepEqual(ordenarLeads(leads, "score").map((l) => l.id), ["alto2", "alto1", "meio", "semscore"]);
});

test("ordenacao por nome e por recentes", () => {
  const leads = [
    lead({ id: "b", nome: "Beta", criado_em: "2026-02-01T00:00:00Z" }),
    lead({ id: "a", nome: "Alfa", criado_em: "2026-01-01T00:00:00Z" }),
  ];
  assert.deepEqual(ordenarLeads(leads, "nome").map((l) => l.id), ["a", "b"]);
  assert.deepEqual(ordenarLeads(leads, "recentes").map((l) => l.id), ["b", "a"]);
});

test("contarFiltrosAtivos", () => {
  assert.equal(contarFiltrosAtivos(CRITERIOS_PADRAO), 0);
  assert.equal(contarFiltrosAtivos({ ...CRITERIOS_PADRAO, busca: "x", soFavoritos: true }), 2);
});
