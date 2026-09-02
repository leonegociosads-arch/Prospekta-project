import { test } from "node:test";
import assert from "node:assert/strict";

import { validarNovaPesquisa } from "../../lib/pesquisa/validacao";

test("formulario valido -> ok, com valores ja trimados", () => {
  const r = validarNovaPesquisa({
    regiao: "  Iguape, SP  ",
    nicho: "  dentistas ",
    raioKm: "10",
    limiteLeads: "20",
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.valores.regiao, "Iguape, SP");
    assert.equal(r.valores.nicho, "dentistas");
    assert.equal(r.valores.raioKm, 10);
    assert.equal(r.valores.limiteLeads, 20);
  }
});

test("regiao vazia -> erro", () => {
  const r = validarNovaPesquisa({ regiao: "   ", nicho: "dentistas", raioKm: 10, limiteLeads: 20 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.erros.regiao);
});

test("nicho vazio -> erro", () => {
  const r = validarNovaPesquisa({ regiao: "Iguape, SP", nicho: "", raioKm: 10, limiteLeads: 20 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.erros.nicho);
});

test("raio invalido: nao-numero, zero, negativo, acima do maximo", () => {
  for (const raio of ["abc", 0, -3, 26, 999, ""]) {
    const r = validarNovaPesquisa({ regiao: "Iguape, SP", nicho: "dentistas", raioKm: raio, limiteLeads: 20 });
    assert.equal(r.ok, false, `raio ${JSON.stringify(raio)} deveria falhar`);
    if (!r.ok) assert.ok(r.erros.raioKm);
  }
});

test("limite absurdo: zero, acima de 20, gigante, decimal quebrado, nao-numero", () => {
  for (const limite of [0, 21, 50, 5000, "xyz", -1]) {
    const r = validarNovaPesquisa({ regiao: "Iguape, SP", nicho: "dentistas", raioKm: 10, limiteLeads: limite });
    assert.equal(r.ok, false, `limite ${JSON.stringify(limite)} deveria falhar`);
    if (!r.ok) assert.ok(r.erros.limiteLeads);
  }
});

test("limites nas bordas sao aceitos (1 e 25 km, 1 e 20 leads)", () => {
  const a = validarNovaPesquisa({ regiao: "X, SP", nicho: "ab", raioKm: 1, limiteLeads: 1 });
  const b = validarNovaPesquisa({ regiao: "X, SP", nicho: "ab", raioKm: 25, limiteLeads: 20 });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
});

test("varios erros ao mesmo tempo sao todos reportados", () => {
  const r = validarNovaPesquisa({ regiao: "", nicho: "", raioKm: 0, limiteLeads: 999 });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.erros.regiao && r.erros.nicho && r.erros.raioKm && r.erros.limiteLeads);
  }
});

test("limite com casa decimal e truncado antes de validar (10.9 -> 10, ok)", () => {
  const r = validarNovaPesquisa({ regiao: "X, SP", nicho: "ab", raioKm: 10, limiteLeads: 10.9 });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.valores.limiteLeads, 10);
});
