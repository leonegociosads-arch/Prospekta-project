import { test } from "node:test";
import assert from "node:assert/strict";

import { parseDiagnostico } from "../../lib/ia/parse-saida";

const bom = {
  resumo: "Empresa ativa, boa reputacao, site sem CTA nem WhatsApp.",
  problemas: ["site sem CTA", "site sem WhatsApp"],
  oportunidades: ["landing page de captacao"],
  servico_sugerido: "Landing page + trafego",
  angulo_comercial: "Mostrar que o site nao converte",
  confianca: "media",
  fatos_utilizados: ["score 72", "tem_cta=false"],
};

test("parse: JSON valido -> ok com todos os campos", () => {
  const r = parseDiagnostico(JSON.stringify(bom));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.diagnostico.resumo, bom.resumo);
  assert.deepEqual(r.diagnostico.problemas, bom.problemas);
  assert.equal(r.diagnostico.servicoSugerido, "Landing page + trafego");
  assert.equal(r.diagnostico.confianca, "media");
});

test("parse: JSON dentro de ```json ... ``` -> ok", () => {
  const r = parseDiagnostico("```json\n" + JSON.stringify(bom) + "\n```");
  assert.equal(r.ok, true);
});

test("parse: texto solto ao redor do objeto -> ok", () => {
  const r = parseDiagnostico("Claro! Aqui esta:\n" + JSON.stringify(bom) + "\nEspero ter ajudado.");
  assert.equal(r.ok, true);
});

test("parse: sem 'resumo' -> falha", () => {
  const semResumo = { ...bom, resumo: "" };
  const r = parseDiagnostico(JSON.stringify(semResumo));
  assert.equal(r.ok, false);
});

test("parse: nao e JSON -> falha, nao lanca", () => {
  const r = parseDiagnostico("desculpe, nao posso responder agora");
  assert.equal(r.ok, false);
});

test("parse: confianca invalida vira 'baixa'; listas nao-array viram []", () => {
  const r = parseDiagnostico(
    JSON.stringify({ ...bom, confianca: "altissima", problemas: "um texto", fatos_utilizados: null }),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.diagnostico.confianca, "baixa");
  assert.deepEqual(r.diagnostico.problemas, []);
  assert.deepEqual(r.diagnostico.fatosUtilizados, []);
});

test("parse: listas muito longas sao truncadas", () => {
  const muitos = Array.from({ length: 30 }, (_, i) => `item ${i}`);
  const r = parseDiagnostico(JSON.stringify({ ...bom, problemas: muitos }));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(r.diagnostico.problemas.length <= 12);
});
