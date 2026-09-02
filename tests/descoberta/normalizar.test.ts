import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizarPlace } from "../../lib/descoberta/normalizar";

test("place completo -> lead completo", () => {
  const l = normalizarPlace({
    id: "places/ChIJabc",
    displayName: { text: "Advocacia Silva" },
    formattedAddress: "R. X, 100 - Iguape, SP",
    location: { latitude: -24.7, longitude: -47.55 },
    primaryTypeDisplayName: { text: "Advogado" },
    types: ["lawyer", "point_of_interest"],
    businessStatus: "OPERATIONAL",
    rating: 4.6,
    userRatingCount: 12,
    websiteUri: "https://advocaciasilva.com.br",
    nationalPhoneNumber: "(13) 3841-0000",
  });
  assert.ok(l);
  assert.equal(l.placeId, "places/ChIJabc");
  assert.equal(l.nome, "Advocacia Silva");
  assert.equal(l.categoria, "Advogado");
  assert.equal(l.lat, -24.7);
  assert.equal(l.avaliacao, 4.6);
  assert.equal(l.qtdAvaliacoes, 12);
  assert.equal(l.siteUrl, "https://advocaciasilva.com.br");
  assert.equal(l.telefone, "(13) 3841-0000");
  assert.equal(l.statusNegocio, "OPERATIONAL");
});

test("campos opcionais ausentes -> null, sem quebrar", () => {
  const l = normalizarPlace({ id: "x", displayName: { text: "So o nome" } });
  assert.ok(l);
  assert.equal(l.categoria, null);
  assert.equal(l.endereco, null);
  assert.equal(l.lat, null);
  assert.equal(l.telefone, null);
  assert.equal(l.siteUrl, null);
  assert.equal(l.avaliacao, null);
  assert.equal(l.qtdAvaliacoes, null);
});

test("sem nome -> null (nao vira lead)", () => {
  assert.equal(normalizarPlace({ id: "x" }), null);
  assert.equal(normalizarPlace({ id: "x", displayName: { text: "" } }), null);
  assert.equal(normalizarPlace(null), null);
  assert.equal(normalizarPlace("texto"), null);
  assert.equal(normalizarPlace(42), null);
});

test("empresa fechada e mantida, com o status", () => {
  const l = normalizarPlace({
    id: "x",
    displayName: { text: "Fechou" },
    businessStatus: "CLOSED_PERMANENTLY",
  });
  assert.equal(l?.statusNegocio, "CLOSED_PERMANENTLY");
});

test("website do instagram/facebook vai para o campo certo", () => {
  const ig = normalizarPlace({ id: "x", displayName: { text: "A" }, websiteUri: "https://www.instagram.com/loja" });
  assert.equal(ig?.instagramUrl, "https://www.instagram.com/loja");
  assert.equal(ig?.siteUrl, null);

  const fb = normalizarPlace({ id: "x", displayName: { text: "A" }, websiteUri: "https://facebook.com/loja" });
  assert.equal(fb?.facebookUrl, "https://facebook.com/loja");
  assert.equal(fb?.siteUrl, null);
});

test("tipos errados nos campos numericos viram null", () => {
  const l = normalizarPlace({
    id: "x",
    displayName: { text: "A" },
    rating: "quatro",
    userRatingCount: null,
    location: { latitude: "-24", longitude: undefined },
  });
  assert.equal(l?.avaliacao, null);
  assert.equal(l?.qtdAvaliacoes, null);
  assert.equal(l?.lat, null);
});

test("displayName como string simples tambem funciona", () => {
  const l = normalizarPlace({ id: "x", displayName: "Nome Direto" });
  assert.equal(l?.nome, "Nome Direto");
});
