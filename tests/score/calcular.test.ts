import { test } from "node:test";
import assert from "node:assert/strict";

import { calcularScore, VERSAO_FORMULA } from "../../lib/score/calcular";
import type { EntradaAnalise, EntradaScore } from "../../lib/score/tipos";

const siteRuim: EntradaAnalise = {
  siteExiste: true, https: true, tlsOk: true, statusHttp: 200,
  temViewport: false, notaMobile: 20, notaDesempenho: 30, pesoKb: 4200, ttfbMs: 3800,
  temWhatsapp: false, temFormulario: false, temCta: false, temPaginaContato: false,
  temMetaPixel: false, temGa: false, temGtm: false, temGoogleAds: false, temDoubleclick: false,
  erro: null,
};
const siteOtimo: EntradaAnalise = {
  ...siteRuim,
  temViewport: true, notaMobile: 100, notaDesempenho: 95, pesoKb: 600, ttfbMs: 300,
  temWhatsapp: true, temFormulario: true, temCta: true, temPaginaContato: true,
  temMetaPixel: true, temGa: true, temGtm: true, temGoogleAds: true, temDoubleclick: true,
};
const siteMediano: EntradaAnalise = {
  ...siteRuim,
  temViewport: true, notaMobile: 80, notaDesempenho: 70, pesoKb: 1500, ttfbMs: 900,
  temWhatsapp: true, temFormulario: true, temCta: true, temPaginaContato: true,
  temMetaPixel: false, temGa: true,
};

function entrada(over: Partial<EntradaScore>): EntradaScore {
  return {
    statusNegocio: "OPERATIONAL",
    avaliacao: null, qtdAvaliacoes: null, telefone: null,
    siteUrl: null, instagramUrl: null, facebookUrl: null,
    analiseSite: null,
    ...over,
  };
}

const A = entrada({ avaliacao: 4.3, qtdAvaliacoes: 80, telefone: "x", siteUrl: "https://a", analiseSite: siteRuim });
const B = entrada({ statusNegocio: null, qtdAvaliacoes: 0, analiseSite: null });
const C = entrada({ avaliacao: 4.8, qtdAvaliacoes: 210, telefone: "x", siteUrl: "https://c", instagramUrl: "https://instagram.com/c", analiseSite: siteOtimo });
const D = entrada({ avaliacao: 4.2, qtdAvaliacoes: 30, telefone: "x", siteUrl: "https://d", analiseSite: siteMediano });

const totalDe = (e: EntradaScore) => calcularScore(e).total;

test("saida tem versao, data e a composicao SEMPRE soma o total", () => {
  for (const e of [A, B, C, D]) {
    const r = calcularScore(e);
    assert.equal(r.versao, VERSAO_FORMULA);
    assert.ok(!Number.isNaN(Date.parse(r.calculadoEm)));
    const soma = r.fatores.reduce((s, f) => s + f.pontos, 0);
    assert.equal(soma, r.total, `perfil somou ${soma} mas total=${r.total}`);
    assert.ok(r.total >= 0 && r.total <= 100);
  }
});

test("determinismo: mesma entrada -> mesmo total", () => {
  const base = new Date("2026-01-01T00:00:00Z");
  assert.equal(calcularScore(A, { agora: base }).total, calcularScore(A, { agora: base }).total);
});

test("ranking dos perfis faz sentido comercial", () => {
  const tA = totalDe(A), tB = totalDe(B), tC = totalDe(C), tD = totalDe(D);
  // A: ativa + muitas avaliacoes + site ruim -> melhor lead
  assert.ok(tA > tC, `A(${tA}) deve > C(${tC})`);
  assert.ok(tA >= tD, `A(${tA}) deve >= D(${tD})`);
  // D: boa + mediana -> ainda vale mais que a empresa "perfeita" (nada a vender)
  assert.ok(tD > tC, `D(${tD}) deve > C(${tC})`);
  // B: quase inexistente -> o pior
  assert.ok(tB < tA && tB < tC && tB < tD, `B(${tB}) deve ser o menor`);
  assert.ok(tB < 40, `B(${tB}) deve ser baixo`);
});

test("nenhum problema isolado leva o score a 100", () => {
  // empresa perfeita em tudo, EXCETO um unico problema no site
  const soUmProblema: EntradaAnalise = { ...siteOtimo, temViewport: false, notaMobile: 10 };
  const e = entrada({
    avaliacao: 5, qtdAvaliacoes: 500, telefone: "x", siteUrl: "https://z",
    instagramUrl: "https://instagram.com/z", analiseSite: soUmProblema,
  });
  const r = calcularScore(e);
  assert.ok(r.total < 100, `total ${r.total} nao deveria ser 100`);
  const problemas = r.fatores.find((f) => f.chave === "problemas")!;
  assert.ok(problemas.fracao <= 0.45, `um problema so nao deve dominar o fator (fracao ${problemas.fracao})`);
});

test("empresa fechada em definitivo -> score 0, mesmo com site ruim e muitas avaliacoes", () => {
  const e = entrada({ statusNegocio: "CLOSED_PERMANENTLY", avaliacao: 4.9, qtdAvaliacoes: 300, telefone: "x", siteUrl: "https://f", analiseSite: siteRuim });
  const r = calcularScore(e);
  assert.equal(r.total, 0);
  assert.ok(r.moderadores.find((m) => m.chave === "negocio_fechado")?.aplicado);
});

test("empresa quase inativa nao ganha score alto so por ter site ruim", () => {
  const inativaSiteRuim = entrada({ statusNegocio: null, qtdAvaliacoes: 0, siteUrl: "https://i", analiseSite: siteRuim });
  const r = calcularScore(inativaSiteRuim);
  assert.ok(r.total < 45, `total ${r.total} alto demais para empresa inativa`);
  assert.ok(r.moderadores.find((m) => m.chave === "atividade_baixa")?.aplicado);
});

test("falta de informacao != informacao negativa", () => {
  const semAnalise = entrada({ avaliacao: 4.4, qtdAvaliacoes: 40, telefone: "x", siteUrl: "https://x", analiseSite: null });
  const analiseRuim = entrada({ avaliacao: 4.4, qtdAvaliacoes: 40, telefone: "x", siteUrl: "https://y", analiseSite: siteRuim });
  const r1 = calcularScore(semAnalise);
  const r2 = calcularScore(analiseRuim);
  assert.ok(r2.total > r1.total, `site comprovadamente ruim (${r2.total}) deve pontuar mais que nao analisado (${r1.total})`);
  assert.notEqual(r1.confianca, "alta");
});

test("ausencia de site nao vira oportunidade automatica", () => {
  const ativaSemSite = entrada({ avaliacao: 4.5, qtdAvaliacoes: 60, telefone: "x", siteUrl: null, analiseSite: null });
  const r = calcularScore(ativaSemSite);
  const problemas = r.fatores.find((f) => f.chave === "problemas")!;
  assert.ok(problemas.pontos < problemas.peso, "sem site nao deve maximizar o fator problemas");
  assert.ok(problemas.fracao <= 0.4);
});

test("'nao encontramos trafego' != 'nao anuncia'", () => {
  const semTags = entrada({ avaliacao: 4.2, qtdAvaliacoes: 25, telefone: "x", siteUrl: "https://s", analiseSite: { ...siteMediano, temGa: false, temGtm: false, temGoogleAds: false, temMetaPixel: false, temDoubleclick: false } });
  const r = calcularScore(semTags);
  const inv = r.fatores.find((f) => f.chave === "investimento")!;
  assert.match(inv.motivo, /NAO confirma|nao confirma/i);
  assert.ok(inv.fracao > 0, "sem sinal de investimento nao deve zerar o fator");
});

test("fator reputacao: sem avaliacoes tem confianca baixa e nao vira zero", () => {
  const r = calcularScore(entrada({ qtdAvaliacoes: 0 }));
  const rep = r.fatores.find((f) => f.chave === "reputacao")!;
  assert.equal(rep.confianca, "baixa");
  assert.ok(rep.fracao > 0);
});

test("fator contato: telefone + whatsapp + form pontua alto", () => {
  const e = entrada({ telefone: "x", siteUrl: "https://c", analiseSite: { ...siteRuim, temWhatsapp: true, temFormulario: true } });
  const contato = calcularScore(e).fatores.find((f) => f.chave === "contato")!;
  assert.ok(contato.fracao >= 0.85);
});
