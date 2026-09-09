// Fake em memoria do Supabase para os testes do diagnostico com IA.
// Suporta o subconjunto de chamadas que lib/ia usa (+ criarStoreSupabase).

import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Tabelas = Record<string, Row[]>;

type Filtro = (r: Row) => boolean;

class Builder {
  private filtros: Filtro[] = [];
  constructor(
    private rows: Row[],
    private onConflictKeys: string[] = [],
  ) {}

  select() {
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filtros.push((r) => r[col] === val);
    return this;
  }
  gte(col: string, val: unknown) {
    this.filtros.push((r) => String(r[col] ?? "") >= String(val));
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filtros.push((r) => vals.includes(r[col]));
    return this;
  }
  private aplicar(): Row[] {
    return this.rows.filter((r) => this.filtros.every((f) => f(r)));
  }
  async maybeSingle() {
    const f = this.aplicar();
    return { data: f[0] ?? null, error: null };
  }
  async single() {
    const f = this.aplicar();
    return { data: f[0] ?? null, error: f[0] ? null : { message: "no rows" } };
  }
  then(
    resolve: (v: { data: Row[]; error: null }) => unknown,
    reject?: (e: unknown) => unknown,
  ) {
    return Promise.resolve({ data: this.aplicar(), error: null }).then(resolve, reject);
  }

  // escrita
  insert(rowOrRows: Row | Row[]) {
    const arr = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
    for (const r of arr) this.rows.push({ ...r });
    const inseridos = arr.map((r) => ({ ...r, id: r.id ?? cryptoId() }));
    // permite .select().single() depois do insert
    return {
      select: () => ({
        single: async () => ({ data: inseridos[0], error: null }),
      }),
      then: (res: (v: { error: null }) => unknown) => Promise.resolve({ error: null }).then(res),
    };
  }
  async upsert(rowOrRows: Row | Row[], opts?: { onConflict?: string }) {
    const keys = opts?.onConflict ? opts.onConflict.split(",").map((s) => s.trim()) : this.onConflictKeys;
    const arr = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
    for (const r of arr) {
      const i =
        keys.length > 0 ? this.rows.findIndex((x) => keys.every((k) => x[k] === r[k])) : -1;
      if (i >= 0) this.rows[i] = { ...this.rows[i], ...r };
      else this.rows.push({ ...r });
    }
    return { error: null };
  }
}

function cryptoId() {
  return "id_" + Math.random().toString(36).slice(2);
}

export type SeedIa = {
  lead?: Row | null;
  score?: Row | null;
  site?: Row | null;
  sociais?: Row[];
  diagnostico?: Row | null;
  apiUsage?: Row[];
  searchLeads?: Row[];
  scoresRanking?: Row[]; // scores de outros leads da mesma pesquisa
};

export function criarFakeDbIa(seed: SeedIa = {}) {
  const tabelas: Tabelas = {
    leads: seed.lead ? [seed.lead] : [],
    scores: [
      ...(seed.score ? [seed.score] : []),
      ...(seed.scoresRanking ?? []),
    ],
    site_analyses: seed.site ? [seed.site] : [],
    social_analyses: [...(seed.sociais ?? [])],
    ai_diagnoses: seed.diagnostico ? [seed.diagnostico] : [],
    api_usage: [...(seed.apiUsage ?? [])],
    search_leads: [...(seed.searchLeads ?? [])],
    places_cache: [],
    searches: [],
    jobs: [],
  };

  const db = {
    from(tabela: string) {
      if (!tabelas[tabela]) tabelas[tabela] = [];
      return new Builder(tabelas[tabela]) as unknown as ReturnType<SupabaseClient["from"]>;
    },
    async rpc() {
      return { data: null, error: null };
    },
  };

  return { db: db as unknown as SupabaseClient, tabelas };
}
