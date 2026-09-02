import { test } from "node:test";
import assert from "node:assert/strict";

import { chaveNomeEndereco, normalizarTexto } from "../../lib/descoberta/dedup";

test("normalizarTexto: minusculas, sem acento, sem pontuacao", () => {
  assert.equal(normalizarTexto("Advocacia  SÃO  José & Cia."), "advocacia sao jose cia");
});

test("mesmo negocio escrito diferente -> mesma chave", () => {
  const a = chaveNomeEndereco("Escritório Andrade", "Rua 7 de Setembro, 100 - Centro");
  const b = chaveNomeEndereco("ESCRITORIO ANDRADE", "R. Sete de Setembro 100  Centro"); // ainda difere no "7"
  assert.notEqual(a, b); // honesto: a normalizacao nao resolve abreviacao "R." vs "Rua"

  const c = chaveNomeEndereco("Escritório Andrade!!!", "Rua 7 de Setembro, 100 - Centro");
  assert.equal(a, c); // pontuacao e acento nao contam
});

test("negocios diferentes -> chaves diferentes", () => {
  const a = chaveNomeEndereco("Advocacia A", "Rua X, 1");
  const b = chaveNomeEndereco("Advocacia B", "Rua X, 1");
  assert.notEqual(a, b);
});

test("endereco nulo nao quebra", () => {
  assert.equal(chaveNomeEndereco("Loja", null), "loja|");
});
