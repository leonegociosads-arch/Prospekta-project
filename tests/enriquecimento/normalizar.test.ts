import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizarDetalhes } from "../../lib/enriquecimento/normalizar";

const RAW = {
  id: "P1",
  displayName: { text: "Advocacia X" },
  formattedAddress: "Rua 1, Iguape",
  googleMapsUri: "https://maps.google.com/?cid=1",
  internationalPhoneNumber: "+55 13 3841-1234",
  nationalPhoneNumber: "(13) 3841-1234",
  websiteUri: "https://x.exemplo",
  regularOpeningHours: {
    openNow: false,
    weekdayDescriptions: ["segunda: 09:00 – 18:00", "terca: 09:00 – 18:00"],
  },
  businessStatus: "OPERATIONAL",
  rating: 4.7,
  userRatingCount: 52,
  reviews: [
    { authorAttribution: { displayName: "Ana" }, rating: 5, text: { text: "Excelente" }, relativePublishTimeDescription: "ha 2 meses", publishTime: "2026-07-01T00:00:00Z" },
    { authorAttribution: { displayName: "Bruno" }, rating: 2, originalText: { text: "Demorou" }, relativePublishTimeDescription: "ha 1 ano" },
    { rating: 4 },
    { texto: "sem nota nem texto valido" },
  ],
};

test("normaliza os campos principais", () => {
  const d = normalizarDetalhes(RAW);
  assert.equal(d.telefoneInternacional, "+55 13 3841-1234");
  assert.equal(d.telefoneNacional, "(13) 3841-1234");
  assert.equal(d.siteUrl, "https://x.exemplo");
  assert.equal(d.mapsUri, "https://maps.google.com/?cid=1");
  assert.deepEqual(d.horarios, ["segunda: 09:00 – 18:00", "terca: 09:00 – 18:00"]);
  assert.equal(d.abertoAgora, false);
  assert.equal(d.nota, 4.7);
  assert.equal(d.qtdAvaliacoes, 52);
});

test("reviews: extrai autor/nota/texto/quando; descarta review sem nada util", () => {
  const d = normalizarDetalhes(RAW);
  assert.equal(d.reviews.length, 3); // a 4a (sem nota e sem texto) e descartada
  assert.deepEqual(d.reviews[0], {
    autor: "Ana", nota: 5, texto: "Excelente", quando: "ha 2 meses", publicadoEm: "2026-07-01T00:00:00Z",
  });
  assert.equal(d.reviews[1].texto, "Demorou"); // usa originalText
  assert.equal(d.reviews[2].autor, null);
});

test("limita reviews a 5", () => {
  const muitas = { reviews: Array.from({ length: 9 }, (_, i) => ({ rating: 4, text: { text: `r${i}` } })) };
  assert.equal(normalizarDetalhes(muitas).reviews.length, 5);
});

test("campos ausentes -> null / listas vazias, nao quebra", () => {
  const d = normalizarDetalhes({});
  assert.equal(d.telefoneInternacional, null);
  assert.equal(d.mapsUri, null);
  assert.equal(d.abertoAgora, null);
  assert.deepEqual(d.horarios, []);
  assert.deepEqual(d.reviews, []);
});

test("normalizarDetalhes(null) e (string) nao quebram", () => {
  assert.deepEqual(normalizarDetalhes(null).reviews, []);
  assert.deepEqual(normalizarDetalhes("nada").horarios, []);
});
