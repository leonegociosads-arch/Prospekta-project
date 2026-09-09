import { test } from "node:test";
import assert from "node:assert/strict";

import { extrairSinais, notaMobile } from "../../lib/analise-site/sinais";

const HTML_RICO = `<!doctype html><html><head>
<title>Advocacia Exemplo - Direito Trabalhista</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="WordPress 6.4">
<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABCD123"></script>
<script>gtag('config', 'G-ABC123');</script>
<script src="https://connect.facebook.net/en_US/fbevents.js"></script>
<script>fbq('init','111');</script>
<link rel="stylesheet" href="/wp-content/themes/x/style.css">
<style>@media (max-width: 600px){ .x{display:none} }</style>
</head><body>
<a href="https://wa.me/5513999998888">WhatsApp</a>
<a href="tel:+551338411234">Ligue</a>
<a href="/contato">Fale conosco</a>
<form action="/enviar"><input name="nome"></form>
<button>Solicite um orçamento</button>
<img src="a.jpg" srcset="a-2x.jpg 2x">
<script src="https://www.googleadservices.com/pagead/conversion.js"></script>
<script src="https://securepubads.g.doubleclick.net/tag.js"></script>
</body></html>`;

const HTML_POBRE = `<html><head><title>So isso</title></head><body><p>oi</p></body></html>`;

test("extrairSinais: pagina rica -> tudo detectado", () => {
  const s = extrairSinais(HTML_RICO, "https://exemplo.com", { server: "nginx" });
  assert.equal(s.temViewport, true);
  assert.equal(s.viewportDeviceWidth, true);
  assert.equal(s.responsividade.mediaQueries, true);
  assert.equal(s.responsividade.srcset, true);
  assert.equal(s.temWhatsapp, true);
  assert.equal(s.temTelefone, true);
  assert.equal(s.temPaginaContato, true);
  assert.equal(s.temFormulario, true);
  assert.equal(s.temCta, true);
  assert.equal(s.temMetaPixel, true);
  assert.equal(s.temGa, true);
  assert.equal(s.temGtm, true);
  assert.equal(s.temGoogleAds, true);
  assert.equal(s.temDoubleclick, true);
  assert.ok(s.stack.includes("WordPress"));
  assert.equal(s.titulo, "Advocacia Exemplo - Direito Trabalhista");
  assert.equal(s.servidor, "nginx");
  assert.ok(notaMobile(s) >= 90);
});

test("extrairSinais: pagina pobre -> quase nada", () => {
  const s = extrairSinais(HTML_POBRE, "https://exemplo.com");
  assert.equal(s.temViewport, false);
  assert.equal(s.temWhatsapp, false);
  assert.equal(s.temFormulario, false);
  assert.equal(s.temMetaPixel, false);
  assert.equal(s.temGa, false);
  assert.equal(s.temGtm, false);
  assert.equal(s.temGoogleAds, false);
  assert.equal(s.temDoubleclick, false);
  assert.deepEqual(s.stack, []);
  assert.equal(notaMobile(s), 0);
});

test("extrairSinais: nao confunde GA com GTM", () => {
  const soGa = extrairSinais(
    `<script src="https://www.google-analytics.com/analytics.js"></script>`,
    "x",
  );
  assert.equal(soGa.temGa, true);
  assert.equal(soGa.temGtm, false);
});

test("extrairSinais: HTML vazio nao quebra", () => {
  const s = extrairSinais("", "x");
  assert.equal(s.temViewport, false);
  assert.equal(s.titulo, null);
});
