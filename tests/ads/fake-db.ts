// Fake minimo do Supabase para testar o orquestrador de deteccao de anuncios.

import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

class Builder {
  private filtros: Array<(r: Row) => boolean> = [];
  constructor(private rows: Row[]) {}
  select() {
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
  private aplicar() {
    return this.rows.filter((r) => this.filtros.every((f) => f(r)));
  }
  async maybeSingle() {
    return { data: this.aplicar()[0] ?? null, error: null };
  }
  then(resolve: (v: { data: Row[]; error: null }) => unknown) {
    return Promise.resolve({ data: this.aplicar(), error: null }).then(resolve);
  }
  insert(rowOrRows: Row | Row[]) {
    const arr = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
    for (const r of arr) this.rows.push({ ...r });
    return { then: (res: (v: { error: null }) => unknown) => Promise.resolve({ error: null }).then(res) };
  }
  async upsert(row: Row, opts?: { onConflict?: string }) {
    const keys = (opts?.onConflict ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const i = keys.length ? this.rows.findIndex((x) => keys.every((k) => x[k] === row[k])) : -1;
    if (i >= 0) this.rows[i] = { ...this.rows[i], ...row };
    else this.rows.push({ ...row });
    return { error: null };
  }
}

export type SeedAds = {
  lead?: Row | null;
  site?: Row | null;
  adSignal?: Row | null;
  apiUsage?: Row[];
};

export function criarFakeDbAds(seed: SeedAds = {}) {
  const tabelas: Record<string, Row[]> = {
    leads: seed.lead ? [seed.lead] : [],
    site_analyses: seed.site ? [seed.site] : [],
    ad_signals: seed.adSignal ? [seed.adSignal] : [],
    api_usage: [...(seed.apiUsage ?? [])],
    searches: [],
  };
  const db = {
    from(t: string) {
      if (!tabelas[t]) tabelas[t] = [];
      return new Builder(tabelas[t]) as unknown as ReturnType<SupabaseClient["from"]>;
    },
    async rpc() {
      return { data: null, error: null };
    },
  };
  return { db: db as unknown as SupabaseClient, tabelas };
}
