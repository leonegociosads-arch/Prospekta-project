import { test } from "node:test";
import assert from "node:assert/strict";

import {
  derivarSinaisObjetivos,
  type DadosLeadSinais,
} from "../../lib/leads/sinais-objetivos";

function dados(over: Partial<DadosLeadSinais> = {}): DadosLeadSinais {
  return {
    lead: {
      telefone: null,
      site_url: null,
      instagram_url: null,
      facebook_url: null,
      avaliacao: null,
      qtd_avaliacoes: null,
      status_negocio: null,
      ...(over.lead ?? {}),
    },
    site: over.site ?? null,
    ads: over.ads ?? null,
    sociais: over.sociais ?? [],
  };
}

const textos = (lista: Array<{ texto: string }>) => lista.map((s) => s.texto).join(" | ");

test("reputacao: nota alta com volume vira ponto forte; nota baixa vira ponto fraco", () => {
  const bom = derivarSinaisObjetivos(
    dados({ lead: { avaliacao: 4.6, qtd_avaliacoes: 312 } as DadosLeadSinais["lead"] }),
  );
  assert.match(textos(bom.fortes), /Reputação boa/);
  assert.match(textos(bom.fortes), /Volume alto/);

  const ruim = derivarSinaisObjetivos(
    dados({ lead: { avaliacao: 3.2, qtd_avaliacoes: 40 } as DadosLeadSinais["lead"] }),
  );
  assert.match(textos(ruim.fracos), /Nota abaixo/);
});

test("lead sem site: vira ponto fraco GRAVE e nao inventa nada sobre o site", () => {
  const r = derivarSinaisObjetivos(dados());
  const semSite = r.fracos.find((f) => /Sem site/.test(f.texto));
  assert.ok(semSite, "esperava o item 'Sem site'");
  assert.equal(semSite?.grave, true);
  // sem boletim de site, nao pode aparecer nada sobre CTA/pixel/whatsapp
  assert.doesNotMatch(textos(r.fracos), /CTA|pixel|WhatsApp/);
});

test("site fora do ar: grave, com o HTTP como evidencia", () => {
  const r = derivarSinaisObjetivos(
    dados({
      lead: { site_url: "https://x.com" } as DadosLeadSinais["lead"],
      site: {
        site_existe: false,
        status_http: 522,
        ttfb_ms: null,
        nota_mobile: null,
        tem_viewport: null,
        tem_whatsapp: null,
        tem_formulario: null,
        tem_cta: null,
        tem_meta_pixel: null,
        tem_ga: null,
        erro: "timeout",
      },
    }),
  );
  const item = r.fracos.find((f) => /não respondeu/.test(f.texto));
  assert.ok(item);
  assert.equal(item?.grave, true);
  assert.equal(item?.evidencia, "HTTP 522");
});

test("site bom: WhatsApp, CTA e mobile viram pontos fortes", () => {
  const r = derivarSinaisObjetivos(
    dados({
      lead: { site_url: "https://x.com" } as DadosLeadSinais["lead"],
      site: {
        site_existe: true,
        status_http: 200,
        ttfb_ms: 300,
        nota_mobile: 90,
        tem_viewport: true,
        tem_whatsapp: true,
        tem_formulario: true,
        tem_cta: true,
        tem_meta_pixel: true,
        tem_ga: true,
        erro: null,
      },
    }),
  );
  assert.match(textos(r.fortes), /Site no ar/);
  assert.match(textos(r.fortes), /WhatsApp no site/);
  assert.match(textos(r.fortes), /chamada para ação/);
  assert.match(textos(r.fortes), /adaptado para celular/);
});

test("anuncios: 'nenhum' nunca vira 'nao anuncia'", () => {
  const r = derivarSinaisObjetivos(dados({ ads: { veredito: "nenhum", confianca: "baixa" } }));
  const item = r.fracos.find((f) => /indício de tráfego pago/.test(f.texto));
  assert.ok(item);
  assert.match(item!.texto, /não confirma que não anuncia/);
});

test("anuncios: veredito forte vira ponto forte com a confianca como evidencia", () => {
  const r = derivarSinaisObjetivos(dados({ ads: { veredito: "forte", confianca: "alta" } }));
  const item = r.fortes.find((f) => /tráfego pago/.test(f.texto));
  assert.ok(item);
  assert.equal(item?.evidencia, "confiança alta");
});

test("redes: perfil encontrado vale mais que so ter o link", () => {
  const comPerfil = derivarSinaisObjetivos(
    dados({
      lead: { instagram_url: "https://instagram.com/x" } as DadosLeadSinais["lead"],
      sociais: [{ plataforma: "instagram", status: "encontrado" }],
    }),
  );
  assert.match(textos(comPerfil.fortes), /Instagram encontrado/);

  const soLink = derivarSinaisObjetivos(
    dados({ lead: { instagram_url: "https://instagram.com/x" } as DadosLeadSinais["lead"] }),
  );
  assert.match(textos(soLink.fortes), /Tem link de Instagram/);
});

test("pontos fracos graves vem antes dos de atencao", () => {
  const r = derivarSinaisObjetivos(
    dados({
      lead: { site_url: "https://x.com", avaliacao: 3.0, qtd_avaliacoes: 50 } as DadosLeadSinais["lead"],
      site: {
        site_existe: false,
        status_http: null,
        ttfb_ms: null,
        nota_mobile: null,
        tem_viewport: null,
        tem_whatsapp: null,
        tem_formulario: null,
        tem_cta: null,
        tem_meta_pixel: null,
        tem_ga: null,
        erro: "conexao recusada",
      },
    }),
  );
  assert.equal(r.fracos[0].grave, true);
});
