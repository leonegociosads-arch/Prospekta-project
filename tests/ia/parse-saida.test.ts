import { test } from "node:test";
import assert from "node:assert/strict";

import { parseDiagnostico } from "../../lib/ia/parse-saida";

const bom = {
  resumo: "Empresa ativa, boa reputacao, site sem CTA nem WhatsApp.",
  pontos_fortes: ["nota 4.6 com 312 avaliacoes"],
  pontos_fracos: ["site sem CTA", "site sem WhatsApp"],
  proposta: {
    servico: "Landing page + trafego",
    escopo: "1 pagina de captacao + pixel instalado",
    justificativa: "ja tem demanda comprovada, falta destino clicavel",
  },
  estrategia: {
    canal: "whatsapp",
    melhor_horario: "fora do horario de pico",
    gatilhos: [
      { titulo: "Site fora do ar", descricao: "abrir mostrando isso", fonte: "site_existe=false" },
    ],
  },
  mensagem_inicial: "Boa tarde! Vi que o site de voces esta fora do ar...",
  objecoes: [{ pergunta: "Ja tenho movimento", resposta: "O foco e captar contato direto" }],
  confianca: "media",
  fatos_utilizados: ["score 72", "tem_cta=false"],
};

test("parse: JSON valido -> ok com todos os campos", () => {
  const r = parseDiagnostico(JSON.stringify(bom));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.diagnostico.resumo, bom.resumo);
  assert.deepEqual(r.diagnostico.pontosFracos, bom.pontos_fracos);
  assert.equal(r.diagnostico.proposta.servico, "Landing page + trafego");
  assert.equal(r.diagnostico.estrategia.canal, "whatsapp");
  assert.equal(r.diagnostico.estrategia.gatilhos.length, 1);
  assert.equal(r.diagnostico.estrategia.gatilhos[0].fonte, "site_existe=false");
  assert.equal(r.diagnostico.mensagemInicial, bom.mensagem_inicial);
  assert.equal(r.diagnostico.objecoes.length, 1);
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

test("parse: so 'resumo' presente -> ok, resto vira valor de reserva (nao falha o dossie todo)", () => {
  const r = parseDiagnostico(JSON.stringify({ resumo: "So isso mesmo." }));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.diagnostico.pontosFortes, []);
  assert.deepEqual(r.diagnostico.pontosFracos, []);
  assert.deepEqual(r.diagnostico.proposta, { servico: "", escopo: "", justificativa: "" });
  assert.deepEqual(r.diagnostico.estrategia, { canal: "", melhorHorario: "", gatilhos: [] });
  assert.equal(r.diagnostico.mensagemInicial, "");
  assert.deepEqual(r.diagnostico.objecoes, []);
  assert.equal(r.diagnostico.confianca, "baixa");
});

test("parse: confianca invalida vira 'baixa'; listas nao-array viram []", () => {
  const r = parseDiagnostico(
    JSON.stringify({ ...bom, confianca: "altissima", pontos_fracos: "um texto", fatos_utilizados: null }),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.diagnostico.confianca, "baixa");
  assert.deepEqual(r.diagnostico.pontosFracos, []);
  assert.deepEqual(r.diagnostico.fatosUtilizados, []);
});

test("parse: listas e sublistas muito longas sao truncadas", () => {
  const muitos = Array.from({ length: 30 }, (_, i) => `item ${i}`);
  const gatilhosDemais = Array.from({ length: 20 }, (_, i) => ({
    titulo: `g${i}`,
    descricao: "x",
    fonte: "y",
  }));
  const r = parseDiagnostico(
    JSON.stringify({
      ...bom,
      pontos_fracos: muitos,
      estrategia: { ...bom.estrategia, gatilhos: gatilhosDemais },
    }),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(r.diagnostico.pontosFracos.length <= 12);
  assert.ok(r.diagnostico.estrategia.gatilhos.length <= 6);
});

test("parse: gatilho sem titulo e descartado (nao vira gatilho vazio)", () => {
  const r = parseDiagnostico(
    JSON.stringify({
      ...bom,
      estrategia: { ...bom.estrategia, gatilhos: [{ descricao: "sem titulo", fonte: "x" }] },
    }),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.diagnostico.estrategia.gatilhos, []);
});
