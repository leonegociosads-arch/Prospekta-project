import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseNumeroSocial,
  extrairSinaisInstagram,
  extrairSinaisFacebook,
} from "../../lib/analise-social/sinais-social";

test("parseNumeroSocial: milhar, decimal, K/M, pt-BR", () => {
  assert.equal(parseNumeroSocial("1,234"), 1234);
  assert.equal(parseNumeroSocial("12.345"), 12345);
  assert.equal(parseNumeroSocial("1.2K"), 1200);
  assert.equal(parseNumeroSocial("3,5 mil"), 3500);
  assert.equal(parseNumeroSocial("2M"), 2_000_000);
  assert.equal(parseNumeroSocial("1,2 mi"), 1_200_000);
  assert.equal(parseNumeroSocial("nada"), null);
});

test("extrairSinaisInstagram: le seguidores/posts/bio da og:description", () => {
  // IG codifica as aspas internas como &quot; (HTML), igual ao real
  const html = `<meta property="og:description" content="1,234 Followers, 88 Following, 267 Posts - See Instagram photos and videos from Adv A (@adv_a): &quot;Direito trabalhista&quot;">`;
  const s = extrairSinaisInstagram(html);
  assert.equal(s.seguidores, 1234);
  assert.equal(s.posts, 267);
  assert.equal(s.bio, "Direito trabalhista");
});

test("extrairSinaisInstagram: formato pt-BR (seguidores/publicacoes)", () => {
  const html = `<meta property="og:description" content="2.500 seguidores, 120 seguindo, 340 publicações - Adv B (@adv_b) no Instagram">`;
  const s = extrairSinaisInstagram(html);
  assert.equal(s.seguidores, 2500);
  assert.equal(s.posts, 340);
});

test("extrairSinaisInstagram: sem og:description -> tudo null, nao inventa", () => {
  const s = extrairSinaisInstagram("<html><body>bloqueado</body></html>");
  assert.equal(s.seguidores, null);
  assert.equal(s.posts, null);
  assert.equal(s.bio, null);
  assert.equal(s.ultimoPostEm, null);
});

test("extrairSinaisFacebook: pega curtidas/seguidores quando presentes", () => {
  const html = `<meta property="og:description" content="1.234 pessoas curtiram isso · Advocacia especializada">`;
  const s = extrairSinaisFacebook(html);
  assert.equal(s.seguidores, 1234);
});
