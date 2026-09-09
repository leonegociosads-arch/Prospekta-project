import { test } from "node:test";
import assert from "node:assert/strict";

import { avaliarElegibilidade } from "../../lib/ia/elegibilidade";
import type { ConfigIa } from "../../lib/ia/config-ia";
import { criarFakeDbIa } from "./fake-db";

const CFG: ConfigIa = {
  modelo: "gemini-2.0-flash",
  scoreMinimo: 70,
  topN: 5,
  tetoMensalUsd: 5,
  ttlDias: 30,
  temperatura: 0,
};

test("elegibilidade: sem score -> nao elegivel", async () => {
  const { db } = criarFakeDbIa({});
  const v = await avaliarElegibilidade(db, "L", null, CFG);
  assert.equal(v.elegivel, false);
});

test("elegibilidade: score >= minimo -> elegivel (sem olhar ranking)", async () => {
  const { db } = criarFakeDbIa({});
  const v = await avaliarElegibilidade(db, "L", 74, CFG);
  assert.equal(v.elegivel, true);
  assert.match(v.motivo, /74/);
});

test("elegibilidade: score baixo mas dentro do top N -> elegivel", async () => {
  const { db } = criarFakeDbIa({
    searchLeads: [
      { search_id: "S1", lead_id: "La" },
      { search_id: "S1", lead_id: "Lb" },
      { search_id: "S1", lead_id: "Lc" },
    ],
    scoresRanking: [
      { lead_id: "Lb", total: 90 },
      { lead_id: "Lc", total: 80 },
      { lead_id: "La", total: 50 },
    ],
  });
  const v = await avaliarElegibilidade(db, "La", 50, CFG);
  assert.equal(v.elegivel, true);
  assert.equal(v.posicao, 3);
});

test("elegibilidade: score baixo e fora do top N -> nao elegivel", async () => {
  const { db } = criarFakeDbIa({
    searchLeads: [
      { search_id: "S1", lead_id: "La" },
      { search_id: "S1", lead_id: "Lb" },
      { search_id: "S1", lead_id: "Lc" },
    ],
    scoresRanking: [
      { lead_id: "Lb", total: 90 },
      { lead_id: "Lc", total: 80 },
      { lead_id: "La", total: 50 },
    ],
  });
  const v = await avaliarElegibilidade(db, "La", 50, { ...CFG, topN: 2 });
  assert.equal(v.elegivel, false);
});
