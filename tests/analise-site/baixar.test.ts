import { test } from "node:test";
import assert from "node:assert/strict";

import { baixarPagina } from "../../lib/analise-site/baixar";

const pub = async () => [{ address: "93.184.216.34", family: 4 }];

function html(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html", ...(init.headers ?? {}) },
    ...init,
  });
}

test("resposta 200 HTML -> respondeu, html capturado", async () => {
  const fetchFake = (async () => html("<html><title>ok</title></html>")) as unknown as typeof fetch;
  const r = await baixarPagina("https://example.com", { fetchImpl: fetchFake, resolver: pub });
  assert.equal(r.respondeu, true);
  assert.equal(r.status, 200);
  assert.match(r.html, /<title>ok<\/title>/);
  assert.equal(r.erro, null);
});

test("segue redirect e atualiza urlFinal / redirects", async () => {
  const fetchFake = (async (u: string) => {
    if (u.includes("/start")) {
      return new Response(null, { status: 301, headers: { location: "https://example.com/final" } });
    }
    return html("<html><title>final</title></html>");
  }) as unknown as typeof fetch;
  const r = await baixarPagina("https://example.com/start", { fetchImpl: fetchFake, resolver: pub });
  assert.equal(r.redirects, 1);
  assert.match(r.urlFinal, /\/final$/);
  assert.equal(r.respondeu, true);
});

test("redirect para IP interno -> bloqueado por seguranca", async () => {
  const fetchFake = (async (u: string) => {
    if (u.includes("example.com")) {
      return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } });
    }
    return html("<html>interno</html>");
  }) as unknown as typeof fetch;
  const r = await baixarPagina("https://example.com", { fetchImpl: fetchFake, resolver: pub });
  assert.equal(r.respondeu, false);
  assert.match(r.erro ?? "", /seguran|SSRF|interno/i);
});

test("redirects demais -> erro", async () => {
  let n = 0;
  const fetchFake = (async () => {
    n++;
    return new Response(null, { status: 301, headers: { location: `https://example.com/r${n}` } });
  }) as unknown as typeof fetch;
  const r = await baixarPagina("https://example.com/r0", {
    fetchImpl: fetchFake,
    resolver: pub,
    maxRedirects: 3,
  });
  assert.match(r.erro ?? "", /redirects demais/i);
});

test("content-length acima do limite -> nao baixa", async () => {
  const fetchFake = (async () =>
    html("x".repeat(20), { headers: { "content-length": "9999999" } })) as unknown as typeof fetch;
  const r = await baixarPagina("https://example.com", {
    fetchImpl: fetchFake,
    resolver: pub,
    maxBytes: 1000,
  });
  assert.match(r.erro ?? "", /grande demais/i);
  assert.equal(r.truncado, true);
});

test("corpo maior que maxBytes -> truncado", async () => {
  const fetchFake = (async () => html("a".repeat(5000))) as unknown as typeof fetch;
  const r = await baixarPagina("https://example.com", {
    fetchImpl: fetchFake,
    resolver: pub,
    maxBytes: 1000,
  });
  assert.equal(r.respondeu, true);
  assert.equal(r.truncado, true);
  assert.ok(r.html.length <= 1000);
});

test("timeout -> erro de timeout, sem excecao", async () => {
  const fetchFake = (async (_u: string, init: RequestInit) => {
    return new Promise<Response>((_res, rej) => {
      (init.signal as AbortSignal).addEventListener("abort", () => {
        const e = new Error("aborted");
        e.name = "AbortError";
        rej(e);
      });
    });
  }) as unknown as typeof fetch;
  const r = await baixarPagina("https://example.com", {
    fetchImpl: fetchFake,
    resolver: pub,
    timeoutMs: 20,
  });
  assert.equal(r.respondeu, false);
  assert.match(r.erro ?? "", /timeout/i);
});

test("conteudo nao-HTML -> html vazio + aviso", async () => {
  const fetchFake = (async () =>
    new Response("%PDF-1.4", {
      status: 200,
      headers: { "content-type": "application/pdf" },
    })) as unknown as typeof fetch;
  const r = await baixarPagina("https://example.com/x.pdf", { fetchImpl: fetchFake, resolver: pub });
  assert.equal(r.html, "");
  assert.match(r.erro ?? "", /nao e HTML/i);
});

test("URL invalida / esquema proibido -> erro de seguranca, sem fetch", async () => {
  let chamou = false;
  const fetchFake = (async () => {
    chamou = true;
    return html("x");
  }) as unknown as typeof fetch;
  const r = await baixarPagina("file:///etc/passwd", { fetchImpl: fetchFake, resolver: pub });
  assert.equal(chamou, false);
  assert.equal(r.respondeu, false);
  assert.match(r.erro ?? "", /seguran/i);
});
