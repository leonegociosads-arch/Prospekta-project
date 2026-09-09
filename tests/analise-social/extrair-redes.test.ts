import { test } from "node:test";
import assert from "node:assert/strict";

import {
  extrairRedesDoHtml,
  normalizarUrlInstagram,
  normalizarUrlFacebook,
} from "../../lib/analise-social/extrair-redes";

test("normalizarUrlInstagram: aceita perfil, rejeita post/share/root", () => {
  assert.equal(normalizarUrlInstagram("https://instagram.com/advocacia.iguape"), "https://www.instagram.com/advocacia.iguape/");
  assert.equal(normalizarUrlInstagram("http://www.instagram.com/Escritorio_X/?hl=pt"), "https://www.instagram.com/Escritorio_X/");
  assert.equal(normalizarUrlInstagram("https://instagram.com/p/ABC123/"), null);
  assert.equal(normalizarUrlInstagram("https://instagram.com/"), null);
  assert.equal(normalizarUrlInstagram("https://instagram.com/explore/tags/x"), null);
  assert.equal(normalizarUrlInstagram("https://example.com/instagram"), null);
});

test("normalizarUrlFacebook: perfil, profile.php, rejeita sharer/plugins", () => {
  assert.equal(normalizarUrlFacebook("https://facebook.com/AdvocaciaIguape"), "https://www.facebook.com/AdvocaciaIguape");
  assert.equal(normalizarUrlFacebook("https://www.facebook.com/profile.php?id=100088776655"), "https://www.facebook.com/profile.php?id=100088776655");
  assert.equal(normalizarUrlFacebook("https://facebook.com/sharer/sharer.php?u=x"), null);
  assert.equal(normalizarUrlFacebook("https://facebook.com/plugins/like.php"), null);
  assert.equal(normalizarUrlFacebook("https://facebook.com/tr?id=123"), null);
});

test("extrairRedesDoHtml: pega os links do HTML, escolhe o mais frequente", () => {
  const html = `
    <a href="https://instagram.com/oficial_adv">insta</a>
    <a href="https://www.instagram.com/oficial_adv/">insta rodape</a>
    <a href="https://instagram.com/p/xyz">um post</a>
    <a href="https://facebook.com/OficialAdv">face</a>
    <a href="https://facebook.com/sharer/sharer.php?u=algo">compartilhar</a>
    <a href="https://www.linkedin.com/company/oficial-adv">linkedin</a>
  `;
  const r = extrairRedesDoHtml(html);
  assert.equal(r.instagram, "https://www.instagram.com/oficial_adv/");
  assert.equal(r.facebook, "https://www.facebook.com/OficialAdv");
  assert.ok(r.outras.some((o) => o.startsWith("linkedin:")));
});

test("extrairRedesDoHtml: sem links -> tudo null", () => {
  const r = extrairRedesDoHtml("<html><body>nada aqui</body></html>");
  assert.equal(r.instagram, null);
  assert.equal(r.facebook, null);
  assert.deepEqual(r.outras, []);
});
