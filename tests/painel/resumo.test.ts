import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarResumoPainel,
  faixaDoScore,
  type EntradaResumoPainel,
} from "../../lib/painel/resumo";

function base(): EntradaResumoPainel {
  return { searches: [], leads: [], vinculos: [], scores: [] };
}

test("faixaDoScore usa as mesmas faixas do filtro de leads (70/40)", () => {
  assert.equal(faixaDoScore(70), "bom");
  assert.equal(faixaDoScore(69), "medio");
  assert.equal(faixaDoScore(40), "medio");
  assert.equal(faixaDoScore(39), "ruim");
  assert.equal(faixaDoScore(0), "ruim");
  assert.equal(faixaDoScore(100), "bom");
});

test("sem nenhuma pesquisa: tudo zerado, nada quebra", () => {
  const r = montarResumoPainel(base());
  assert.equal(r.totalLeads, 0);
  assert.equal(r.leadsAnalisados, 0);
  assert.equal(r.boasOportunidades, 0);
  assert.equal(r.favoritos, 0);
  assert.equal(r.totalPesquisas, 0);
  assert.deepEqual(r.qualidade, { bons: 0, medios: 0, ruins: 0, totalClassificado: 0 });
  assert.deepEqual(r.porPesquisa, []);
  assert.equal(r.algumaPesquisaComOportunidade, false);
  assert.deepEqual(r.melhoresOportunidades, []);
  assert.deepEqual(r.pesquisasRecentes, []);
});

test("qualidade nao mistura 'nao analisado' com 'ruim'", () => {
  const entrada: EntradaResumoPainel = {
    searches: [],
    leads: [
      { id: "l1", nome: "A", categoria: null, endereco: null, favorito: false, criado_em: "2026-01-01" },
      { id: "l2", nome: "B", categoria: null, endereco: null, favorito: false, criado_em: "2026-01-02" },
    ],
    vinculos: [],
    scores: [{ lead_id: "l1", total: 80 }], // l2 nunca foi analisado
  };
  const r = montarResumoPainel(entrada);
  assert.equal(r.totalLeads, 2);
  assert.equal(r.leadsAnalisados, 1);
  assert.equal(r.naoAnalisados, 1);
  assert.deepEqual(r.qualidade, { bons: 1, medios: 0, ruins: 0, totalClassificado: 1 });
});

test("oportunidades por pesquisa: conta 'bons' por pesquisa, ordena por isso", () => {
  const entrada: EntradaResumoPainel = {
    searches: [
      { id: "sA", nicho: "Pet Shops", regiao_texto: "Iguape", raio_km: 10, status: "pronta", criada_em: "2026-01-01" },
      { id: "sB", nicho: "Advocacia", regiao_texto: "Iguape", raio_km: 10, status: "pronta", criada_em: "2026-01-02" },
    ],
    leads: [
      { id: "l1", nome: "A", categoria: null, endereco: null, favorito: false, criado_em: "2026-01-01" },
      { id: "l2", nome: "B", categoria: null, endereco: null, favorito: false, criado_em: "2026-01-01" },
      { id: "l3", nome: "C", categoria: null, endereco: null, favorito: false, criado_em: "2026-01-01" },
    ],
    vinculos: [
      { search_id: "sA", lead_id: "l1", visto_em: "2026-01-01" },
      { search_id: "sA", lead_id: "l2", visto_em: "2026-01-01" },
      { search_id: "sB", lead_id: "l3", visto_em: "2026-01-02" },
    ],
    scores: [
      { lead_id: "l1", total: 90 }, // sA: bom
      { lead_id: "l2", total: 50 }, // sA: medio
      { lead_id: "l3", total: 30 }, // sB: ruim
    ],
  };
  const r = montarResumoPainel(entrada);
  assert.equal(r.porPesquisa.length, 2);
  assert.equal(r.porPesquisa[0].searchId, "sA"); // 1 boa > 0 boas de sB
  assert.equal(r.porPesquisa[0].boas, 1);
  assert.equal(r.porPesquisa[0].analisados, 2);
  assert.equal(r.porPesquisa[0].aproveitamento, 50); // 1/2 * 100
  assert.equal(r.porPesquisa[1].searchId, "sB");
  assert.equal(r.porPesquisa[1].boas, 0);
  assert.equal(r.algumaPesquisaComOportunidade, true);
});

test("aproveitamento e null quando a pesquisa nao tem nenhum lead analisado ainda", () => {
  const entrada: EntradaResumoPainel = {
    searches: [{ id: "sA", nicho: "X", regiao_texto: "Y", raio_km: 5, status: "pronta", criada_em: "2026-01-01" }],
    leads: [{ id: "l1", nome: "A", categoria: null, endereco: null, favorito: false, criado_em: "2026-01-01" }],
    vinculos: [{ search_id: "sA", lead_id: "l1", visto_em: "2026-01-01" }],
    scores: [], // ninguem analisado ainda
  };
  const r = montarResumoPainel(entrada);
  assert.equal(r.porPesquisa[0].aproveitamento, null);
  assert.equal(r.algumaPesquisaComOportunidade, false);
});

test("melhores oportunidades: ordena por score desc e traz o nicho do primeiro vinculo", () => {
  const entrada: EntradaResumoPainel = {
    searches: [
      { id: "sA", nicho: "Pet Shops", regiao_texto: "Iguape", raio_km: 10, status: "pronta", criada_em: "2026-01-01" },
    ],
    leads: [
      { id: "l1", nome: "Fraco", categoria: "Pet", endereco: null, favorito: false, criado_em: "2026-01-01" },
      { id: "l2", nome: "Forte", categoria: "Pet", endereco: null, favorito: true, criado_em: "2026-01-01" },
    ],
    vinculos: [
      { search_id: "sA", lead_id: "l1", visto_em: "2026-01-01" },
      { search_id: "sA", lead_id: "l2", visto_em: "2026-01-01" },
    ],
    scores: [
      { lead_id: "l1", total: 20 },
      { lead_id: "l2", total: 95 },
    ],
  };
  const r = montarResumoPainel(entrada);
  assert.equal(r.melhoresOportunidades[0].leadId, "l2");
  assert.equal(r.melhoresOportunidades[0].score, 95);
  assert.equal(r.melhoresOportunidades[0].faixa, "bom");
  assert.equal(r.melhoresOportunidades[0].nicho, "Pet Shops");
  assert.equal(r.melhoresOportunidades[0].favorito, true);
  assert.equal(r.melhoresOportunidades[1].leadId, "l1");
});

test("melhores oportunidades: lead sem score nunca entra no ranking", () => {
  const entrada: EntradaResumoPainel = {
    searches: [],
    leads: [{ id: "l1", nome: "Sem score", categoria: null, endereco: null, favorito: false, criado_em: "2026-01-01" }],
    vinculos: [],
    scores: [],
  };
  const r = montarResumoPainel(entrada);
  assert.deepEqual(r.melhoresOportunidades, []);
});

test("topPorPesquisa/topOportunidades/topRecentes recortam e contam o restante", () => {
  const searches = Array.from({ length: 7 }, (_, i) => ({
    id: `s${i}`,
    nicho: `Nicho ${i}`,
    regiao_texto: "X",
    raio_km: 5,
    status: "pronta",
    criada_em: `2026-01-0${(i % 9) + 1}`,
  }));
  const r = montarResumoPainel(
    { searches, leads: [], vinculos: [], scores: [] },
    { topPorPesquisa: 3, topRecentes: 2 },
  );
  assert.equal(r.porPesquisa.length, 3);
  assert.equal(r.totalPesquisasForaDoTopo, 4);
  assert.equal(r.pesquisasRecentes.length, 2);
  assert.equal(r.totalPesquisasForaDasRecentes, 5);
});

test("favoritos conta so os leads com favorito=true, independente de score", () => {
  const entrada: EntradaResumoPainel = {
    searches: [],
    leads: [
      { id: "l1", nome: "A", categoria: null, endereco: null, favorito: true, criado_em: "2026-01-01" },
      { id: "l2", nome: "B", categoria: null, endereco: null, favorito: false, criado_em: "2026-01-01" },
      { id: "l3", nome: "C", categoria: null, endereco: null, favorito: true, criado_em: "2026-01-01" },
    ],
    vinculos: [],
    scores: [],
  };
  const r = montarResumoPainel(entrada);
  assert.equal(r.favoritos, 2);
});
