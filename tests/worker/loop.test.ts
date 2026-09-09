import { test } from "node:test";
import assert from "node:assert/strict";

import { rodarWorker } from "../../worker/loop";
import type { Handler, RegistroDeHandlers } from "../../worker/tipos";
import { criarFakeDb, type SeedJob } from "./fake-db";

const semDormir = async () => {};
const semLog = () => {};

const eco: Handler = async () => {};

function pend(id: string, tipo: string, over: Partial<SeedJob> = {}): SeedJob {
  return { id, tipo, status: "pendente", ...over };
}

test("job normal -> feito", async () => {
  const { db, jobs } = criarFakeDb([pend("j1", "eco")]);
  const r = await rodarWorker({
    db,
    registro: { eco },
    sinal: { parar: false },
    once: true,
    dormir: semDormir,
    log: semLog,
  });
  assert.equal(r.feitos, 1);
  assert.equal(jobs[0].status, "feito");
});

test("job que falha reagenda; quando esgota, vira erro definitivo", async () => {
  const { db, jobs } = criarFakeDb([pend("j1", "ruim", { max_tentativas: 2 })]);
  const registro: RegistroDeHandlers = {
    ruim: async () => {
      throw new Error("nao deu");
    },
  };
  const base = {
    db,
    registro,
    dormir: semDormir,
    log: semLog,
    backoffBaseMs: 1_000_000,
    backoffTetoMs: 1_000_000,
  };

  const r1 = await rodarWorker({ ...base, sinal: { parar: false }, once: true });
  assert.equal(r1.reagendados, 1);
  assert.equal(jobs[0].status, "pendente");
  assert.equal(jobs[0].tentativas, 1);

  jobs[0].agendado_para = new Date(0).toISOString(); // "vence" o backoff
  const r2 = await rodarWorker({ ...base, sinal: { parar: false }, once: true });
  assert.equal(r2.esgotados, 1);
  assert.equal(jobs[0].status, "erro");
  assert.equal(jobs[0].ultimo_erro, "nao deu");
  assert.equal(jobs[0].tentativas, 2);
});

test("tipo desconhecido -> erro na hora, sem novas tentativas", async () => {
  const { db, jobs } = criarFakeDb([pend("j1", "fantasma")]);
  const r = await rodarWorker({
    db,
    registro: {},
    sinal: { parar: false },
    once: true,
    dormir: semDormir,
    log: semLog,
  });
  assert.equal(r.ignorados, 1);
  assert.equal(jobs[0].status, "erro");
  assert.equal(jobs[0].tentativas, 1); // so a reivindicacao incrementou
});

test("fila vazia (nenhum job) -> nao processa nada, nao trava", async () => {
  const { db } = criarFakeDb([]);
  const r = await rodarWorker({
    db,
    registro: {},
    sinal: { parar: false },
    once: true,
    dormir: semDormir,
    log: semLog,
  });
  assert.equal(r.processados, 0);
});

test("handler 'sem internet' -> falha tratada, laco continua para o proximo", async () => {
  const { db, jobs } = criarFakeDb([
    pend("j1", "rede", { criado_em: new Date(1).toISOString() }),
    pend("j2", "eco", { criado_em: new Date(2).toISOString() }),
  ]);
  const registro: RegistroDeHandlers = {
    rede: async () => {
      throw new Error("fetch failed");
    },
    eco,
  };
  const r = await rodarWorker({
    db,
    registro,
    sinal: { parar: false },
    once: true,
    dormir: semDormir,
    log: semLog,
    backoffBaseMs: 1_000_000,
  });
  assert.equal(r.processados, 2);
  assert.equal(r.feitos, 1);
  assert.equal(r.reagendados, 1);
  assert.equal(jobs.find((j) => j.id === "j1")!.status, "pendente");
  assert.equal(jobs.find((j) => j.id === "j2")!.status, "feito");
});

test("sinal de parada: termina o job atual e NAO pega o proximo", async () => {
  const { db, jobs } = criarFakeDb([
    pend("j1", "para", { criado_em: new Date(1).toISOString() }),
    pend("j2", "para", { criado_em: new Date(2).toISOString() }),
  ]);
  const sinal = { parar: false };
  const registro: RegistroDeHandlers = {
    para: async () => {
      sinal.parar = true; // simula Ctrl+C durante o job
    },
  };
  const r = await rodarWorker({ db, registro, sinal, dormir: semDormir, log: semLog });
  assert.equal(r.processados, 1);
  assert.equal(r.feitos, 1);
  assert.equal(jobs.find((j) => j.id === "j1")!.status, "feito");
  assert.equal(jobs.find((j) => j.id === "j2")!.status, "pendente");
});

test("maxJobs limita a execucao", async () => {
  const { db } = criarFakeDb(
    [1, 2, 3, 4, 5].map((n) =>
      pend(`j${n}`, "eco", { criado_em: new Date(n).toISOString() }),
    ),
  );
  const r = await rodarWorker({
    db,
    registro: { eco },
    sinal: { parar: false },
    maxJobs: 2,
    dormir: semDormir,
    log: semLog,
  });
  assert.equal(r.processados, 2);
});

test("dois workers concorrentes: cada job roda exatamente 1x", async () => {
  const N = 20;
  const { db, jobs } = criarFakeDb(
    Array.from({ length: N }, (_, i) =>
      pend(`j${i}`, "eco", { criado_em: new Date(i + 1).toISOString() }),
    ),
  );
  const execucoes: string[] = [];
  const registro: RegistroDeHandlers = {
    eco: async ({ job }) => {
      execucoes.push(job.id);
      await new Promise((r) => setTimeout(r, 1)); // forca intercalacao
    },
  };
  const comum = { db, registro, once: true, dormir: semDormir, log: semLog };

  await Promise.all([
    rodarWorker({ ...comum, sinal: { parar: false } }),
    rodarWorker({ ...comum, sinal: { parar: false } }),
  ]);

  assert.equal(execucoes.length, N);
  assert.equal(new Set(execucoes).size, N); // nenhum job repetido
  assert.ok(jobs.every((j) => j.status === "feito"));
});
