// Fila de jobs FALSA, em memoria, imitando o pedaco do supabase-js que o
// worker usa. Serve para testar o laco sem banco real e sem internet.
//
// Modela o essencial: a reivindicacao (rpc) e sincrona -> atomica, do mesmo
// jeito que "FOR UPDATE SKIP LOCKED" garante no Postgres real.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "@/lib/db-types";

export type SeedJob = Partial<Job> & { id: string; tipo: string };

function normalizar(seed: SeedJob[]): Job[] {
  return seed.map((j, i) => ({
    id: j.id,
    tipo: j.tipo,
    search_id: j.search_id ?? null,
    lead_id: j.lead_id ?? null,
    payload: j.payload ?? {},
    status: j.status ?? "pendente",
    tentativas: j.tentativas ?? 0,
    max_tentativas: j.max_tentativas ?? 3,
    ultimo_erro: j.ultimo_erro ?? null,
    agendado_para: j.agendado_para ?? new Date(0).toISOString(),
    criado_em: j.criado_em ?? new Date(i + 1).toISOString(),
    atualizado_em: j.atualizado_em ?? new Date().toISOString(),
  }));
}

type Filtro = (j: Job) => boolean;

function criarQuery(jobs: Job[]) {
  const filtros: Filtro[] = [];
  let patch: Partial<Job> | null = null;
  let projetar = false;

  const q = {
    update(p: Partial<Job>) {
      patch = p;
      return q;
    },
    eq(col: keyof Job, val: unknown) {
      filtros.push((j) => j[col] === val);
      return q;
    },
    lt(col: keyof Job, val: string) {
      filtros.push((j) => String(j[col]) < val);
      return q;
    },
    select() {
      projetar = true;
      return q;
    },
    then(
      resolve: (r: { data: Array<{ id: string }> | null; error: null }) => void,
    ) {
      const alvo = jobs.filter((j) => filtros.every((f) => f(j)));
      if (patch) for (const j of alvo) Object.assign(j, patch);
      resolve({ data: projetar ? alvo.map((j) => ({ id: j.id })) : null, error: null });
    },
  };
  return q;
}

export function criarFakeDb(seed: SeedJob[] = []): { db: SupabaseClient; jobs: Job[] } {
  const jobs = normalizar(seed);

  const fake = {
    jobs, // exposto para asserts (nao existe no supabase real)
    async rpc(nome: string) {
      if (nome !== "reivindicar_proximo_job") {
        return { data: null, error: { message: `rpc ${nome} desconhecida no fake` } };
      }
      const agora = Date.now();
      const cand = jobs
        .filter((j) => j.status === "pendente" && Date.parse(j.agendado_para) <= agora)
        .sort(
          (a, b) =>
            a.agendado_para.localeCompare(b.agendado_para) ||
            a.criado_em.localeCompare(b.criado_em),
        )[0];
      if (!cand) return { data: [], error: null };
      cand.status = "rodando";
      cand.tentativas += 1;
      cand.atualizado_em = new Date().toISOString();
      return { data: [{ ...cand }], error: null };
    },
    from(tabela: string) {
      if (tabela !== "jobs") throw new Error(`fake-db: tabela nao suportada: ${tabela}`);
      return criarQuery(jobs);
    },
  };

  return { db: fake as unknown as SupabaseClient, jobs };
}
