import { test } from "node:test";
import assert from "node:assert/strict";

import { classificarResposta } from "../../lib/analise-social/classificar";
import type { RespostaSite } from "../../lib/analise-site/tipos";

function resp(over: Partial<RespostaSite>): RespostaSite {
  return {
    respondeu: true, status: 200, urlFinal: "https://www.instagram.com/x/", redirects: 0,
    html: "", contentType: "text/html", tamanhoBytes: 10, truncado: false,
    tlsOk: true, tlsErro: null, ttfbMs: 5, headers: {}, erro: null, ...over,
  };
}

test("200 com og + nome da plataforma -> encontrado", () => {
  const r = classificarResposta(
    resp({ html: `<meta property="og:title" content="X - Instagram">` }),
    "instagram",
  );
  assert.equal(r.status, "encontrado");
});

test("404 -> nao_encontrado", () => {
  assert.equal(classificarResposta(resp({ status: 404 }), "instagram").status, "nao_encontrado");
});

test("429 / 403 -> desconhecido (bloqueio)", () => {
  assert.equal(classificarResposta(resp({ status: 429 }), "instagram").status, "desconhecido");
  assert.equal(classificarResposta(resp({ status: 403 }), "facebook").status, "desconhecido");
});

test("redirecionado para login -> desconhecido", () => {
  const r = classificarResposta(
    resp({ urlFinal: "https://www.instagram.com/accounts/login/?next=/x/" }),
    "instagram",
  );
  assert.equal(r.status, "desconhecido");
});

test("nao respondeu (rede) -> desconhecido, nunca 'nao existe'", () => {
  const r = classificarResposta(resp({ respondeu: false, status: null, erro: "ECONNRESET" }), "facebook");
  assert.equal(r.status, "desconhecido");
});

test("200 sem dados de perfil legiveis -> desconhecido (provavel bloqueio)", () => {
  const r = classificarResposta(resp({ html: "<html><body>carregando…</body></html>" }), "instagram");
  assert.equal(r.status, "desconhecido");
});
