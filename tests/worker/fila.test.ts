import { test } from "node:test";
import assert from "node:assert/strict";

import {
  calcularBackoffMs,
  concluirJob,
  recuperarJobsTravados,
  registrarResultadoFalha,
} from "../../worker/fila";
import { criarFakeDb } from "./fake-db";

test("calcularBackoffMs: exponencial com teto, sem explodir em 0", () => {
  assert.equal(calcularBackoffMs(1, 1000, 100000), 1000);
  assert.equal(calcularBackoffMs(2, 1000, 100000), 2000);
  assert.equal(calcularBackoffMs(3, 1000, 100000), 4000);
  assert.equal(calcularBackoffMs(20, 1000, 5000), 5000); // bate no teto
  assert.equal(calcularBackoffMs(0, 1000, 100000), 1000);
});

test("registrarResultadoFalha: ainda ha tentativas -> reagenda no futuro", async () => {
  const { db, jobs } = criarFakeDb([
    { id: "j1", tipo: "x", status: "rodando", tentativas: 1, max_tentativas: 3 },
  ]);
  const r = await registrarResultadoFalha(
    db,
    { id: "j1", tentativas: 1, max_tentativas: 3 },
    "falhou feio",
    { baseMs: 1000, agora: () => 10_000 },
  );
  assert.equal(r, "reagendado");
  assert.equal(jobs[0].status, "pendente");
  assert.equal(jobs[0].ultimo_erro, "falhou feio");
  assert.equal(Date.parse(jobs[0].agendado_para), 11_000);
});

test("registrarResultadoFalha: tentativas esgotadas -> erro definitivo", async () => {
  const { db, jobs } = criarFakeDb([
    { id: "j1", tipo: "x", status: "rodando", tentativas: 3, max_tentativas: 3 },
  ]);
  const r = await registrarResultadoFalha(
    db,
    { id: "j1", tentativas: 3, max_tentativas: 3 },
    "desisto",
  );
  assert.equal(r, "esgotado");
  assert.equal(jobs[0].status, "erro");
  assert.equal(jobs[0].ultimo_erro, "desisto");
});

test("concluirJob: marca feito e limpa ultimo_erro", async () => {
  const { db, jobs } = criarFakeDb([
    { id: "j1", tipo: "x", status: "rodando", ultimo_erro: "erro antigo" },
  ]);
  await concluirJob(db, "j1");
  assert.equal(jobs[0].status, "feito");
  assert.equal(jobs[0].ultimo_erro, null);
});

test("recuperarJobsTravados: so reenfileira 'rodando' parado ha tempo", async () => {
  const antigo = new Date(Date.now() - 60 * 60_000).toISOString();
  const agora = new Date().toISOString();
  const { db, jobs } = criarFakeDb([
    { id: "velho", tipo: "x", status: "rodando", atualizado_em: antigo },
    { id: "recente", tipo: "x", status: "rodando", atualizado_em: agora },
    { id: "ja-pendente", tipo: "x", status: "pendente", atualizado_em: antigo },
  ]);
  const n = await recuperarJobsTravados(db, 15);
  assert.equal(n, 1);
  assert.equal(jobs.find((j) => j.id === "velho")!.status, "pendente");
  assert.equal(jobs.find((j) => j.id === "recente")!.status, "rodando");
});
