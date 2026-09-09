import { test } from "node:test";
import assert from "node:assert/strict";

import { analisarSocial } from "../../lib/analise-social/analisar-social";
import { criarFakeDb } from "./fake-db";

const resolver = async () => [{ address: "93.184.216.34", family: 4 }];

const IG_PERFIL = `<meta property="og:title" content="Adv A (@adv_a) - Instagram photos and videos">
<meta property="og:description" content="1,234 Followers, 88 Following, 267 Posts - See Instagram photos and videos from Adv A (@adv_a)">`;

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/html" } });
}

function fetchRoteado(rotas: Array<[RegExp, () => Response | Promise<Response>]>) {
  return (async (u: string) => {
    const s = String(u);
    for (const [re, fn] of rotas) if (re.test(s)) return fn();
    return html("<html><body>?</body></html>");
  }) as unknown as typeof fetch;
}

test("site com links: IG encontrado (com seguidores), FB 404 -> nao_encontrado", async () => {
  const { db, social } = criarFakeDb({
    lead: { id: "L1", site_url: "https://site-a.exemplo", instagram_url: null, facebook_url: null },
  });
  const fetchImpl = fetchRoteado([
    [/site-a\.exemplo/, () => html(`<a href="https://instagram.com/adv_a">i</a><a href="https://facebook.com/AdvA">f</a>`)],
    [/instagram\.com\/adv_a/, () => html(IG_PERFIL)],
    [/facebook\.com\/AdvA/, () => html("<html>Sorry, this page isn't available</html>", 404)],
  ]);

  const r = await analisarSocial({ db, fetchImpl, baixarOpts: { resolver } }, "L1", { forcar: true });
  assert.equal(r.status, "ok");

  const ig = social.find((x) => x.plataforma === "instagram")!;
  const fb = social.find((x) => x.plataforma === "facebook")!;
  assert.equal(ig.status, "encontrado");
  assert.equal(ig.seguidores, 1234);
  assert.equal(ig.posts_recentes, 267);
  assert.equal((ig.objetivo as { origem: string }).origem, "site");
  assert.equal(fb.status, "nao_encontrado");
  assert.equal(fb.perfil_existe, false);
});

test("sem site; instagram_url do Google cai no login -> desconhecido; FB sem link -> sem_link", async () => {
  const { db, social } = criarFakeDb({
    lead: { id: "L2", site_url: null, instagram_url: "https://instagram.com/perfil_b", facebook_url: null },
  });
  const fetchImpl = fetchRoteado([
    [/instagram\.com\/accounts\/login/, () => html("<html>faca login</html>")],
    [/instagram\.com\/perfil_b/, () => new Response(null, { status: 302, headers: { location: "https://www.instagram.com/accounts/login/?next=/perfil_b/" } })],
  ]);

  const r = await analisarSocial({ db, fetchImpl, baixarOpts: { resolver } }, "L2", { forcar: true });
  assert.equal(r.status, "ok");
  assert.equal(social.find((x) => x.plataforma === "instagram")!.status, "desconhecido");
  assert.equal(social.find((x) => x.plataforma === "facebook")!.status, "sem_link");
});

test("falha inesperada de rede -> desconhecido, e analisarSocial NAO lanca", async () => {
  const { db, social } = criarFakeDb({
    lead: { id: "L3", site_url: null, instagram_url: "https://instagram.com/quebra", facebook_url: null },
  });
  const fetchImpl = fetchRoteado([[/instagram\.com\/quebra/, () => { throw new Error("ECONNRESET"); }]]);

  const r = await analisarSocial({ db, fetchImpl, baixarOpts: { resolver } }, "L3", { forcar: true });
  assert.equal(r.status, "ok");
  assert.equal(social.length, 2);
  assert.equal(social.find((x) => x.plataforma === "instagram")!.status, "desconhecido");
});

test("cache: analise recente -> pulado-cache", async () => {
  const { db } = criarFakeDb({
    lead: { id: "L4", site_url: null, instagram_url: null, facebook_url: null },
    socialRows: [{ lead_id: "L4", plataforma: "instagram", verificado_em: new Date().toISOString(), status: "sem_link" }],
  });
  const r = await analisarSocial({ db }, "L4");
  assert.equal(r.status, "pulado-cache");
});

test("lead inexistente -> lead-nao-encontrado", async () => {
  const { db } = criarFakeDb({ lead: null });
  const r = await analisarSocial({ db }, "nope");
  assert.equal(r.status, "lead-nao-encontrado");
});

test("prioriza o link do site sobre o do Google", async () => {
  const { db, social } = criarFakeDb({
    lead: { id: "L5", site_url: null, instagram_url: "https://instagram.com/do_google", facebook_url: null },
    siteAnalysis: { sinais: { redesSociais: { instagram: "https://www.instagram.com/do_site/", facebook: null, outras: [] } } },
  });
  const fetchImpl = fetchRoteado([[/instagram\.com\/do_site/, () => html(IG_PERFIL)]]);

  await analisarSocial({ db, fetchImpl, baixarOpts: { resolver } }, "L5", { forcar: true });
  const ig = social.find((x) => x.plataforma === "instagram")!;
  assert.equal(ig.perfil_url, "https://www.instagram.com/do_site/");
  assert.equal((ig.objetivo as { origem: string }).origem, "site");
});
