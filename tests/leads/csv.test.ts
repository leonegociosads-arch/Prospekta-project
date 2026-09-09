import { test } from "node:test";
import assert from "node:assert/strict";

import { leadsParaCsv, nomeArquivoCsv } from "../../lib/leads/csv";
import type { LeadEnriquecido } from "../../lib/leads/tipos";

function lead(over: Partial<LeadEnriquecido>): LeadEnriquecido {
  return {
    id: "L1",
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
    temSinalAnuncio: null,
    temDiagnostico: false,
    ...over,
  };
}

test("csv: cabecalho + BOM + CRLF", () => {
  const csv = leadsParaCsv([]);
  assert.ok(csv.startsWith("﻿"));
  assert.ok(csv.includes("nome;categoria;endereco"));
  assert.ok(csv.endsWith("\r\n"));
});

test("csv: escapa campo com ponto-e-virgula e aspas", () => {
  const csv = leadsParaCsv([lead({ nome: 'Bar "do Zé"; Cia', score: 70 })]);
  const linha = csv.trim().split("\r\n")[1];
  assert.ok(linha.startsWith('"Bar ""do Zé""; Cia";'));
});

test("csv: colunas por indice (faixa, site_analisado, sinal, favorito)", () => {
  const csv = leadsParaCsv([
    lead({ nome: "A", score: 80, favorito: true, siteAnalisado: true, temSinalAnuncio: true }),
  ]);
  const [cab, linha] = csv.trim().split("\r\n");
  const cols = cab.replace("﻿", "").split(";");
  const val = linha.split(";");
  const campo = (nome: string) => val[cols.indexOf(nome)];
  assert.equal(campo("score"), "80");
  assert.equal(campo("faixa_score"), "alto");
  assert.equal(campo("site_analisado"), "sim");
  assert.equal(campo("sinal_anuncio"), "sim");
  assert.equal(campo("favorito"), "sim");
  assert.equal(campo("lead_id"), "L1");
});

test("csv: valores nulos viram vazio e o desconhecido de anuncio fica em branco", () => {
  const csv = leadsParaCsv([lead({})]);
  const [cab, linha] = csv.trim().split("\r\n");
  const cols = cab.replace("﻿", "").split(";");
  const val = linha.split(";");
  const campo = (nome: string) => val[cols.indexOf(nome)];
  assert.equal(campo("categoria"), "");
  assert.equal(campo("score"), "");
  assert.equal(campo("faixa_score"), "sem score");
  assert.equal(campo("sinal_anuncio"), ""); // temSinalAnuncio null -> em branco
  assert.equal(campo("favorito"), "nao");
});

test("nomeArquivoCsv: slug seguro com data", () => {
  const nome = nomeArquivoCsv("Advocacia", "Iguape, SP");
  assert.match(nome, /^prospekta-advocacia-iguape-sp-\d{4}-\d{2}-\d{2}\.csv$/);
});
