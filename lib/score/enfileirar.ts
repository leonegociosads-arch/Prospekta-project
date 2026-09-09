// Cria jobs "calcular_score" para leads que ainda nao tem um job aberto.
// Score nao faz chamada externa - e barato - mas passa pela fila para
// ser processado em segundo plano como o resto do pipeline.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ResultadoEnfileirarScore = {
  candidatos: number;
  enfileirados: number;
  jaTinhamJob: number;
};

export async function enfileirarScores(
  db: SupabaseClient,
  opts: { searchId?: string; leadIds?: string[] } = {},
): Promise<ResultadoEnfileirarScore> {
  let ids: string[];

  if (opts.leadIds) {
    ids = [...new Set(opts.leadIds)];
  } else if (opts.searchId) {
    const { data, error } = await db
      .from("search_leads")
      .select("lead_id")
      .eq("search_id", opts.searchId);
    if (error) throw new Error(`search_leads: ${error.message}`);
    ids = (data ?? []).map((r) => r.lead_id as string);
  } else {
    const { data, error } = await db.from("leads").select("id");
    if (error) throw new Error(`leads: ${error.message}`);
    ids = (data ?? []).map((r) => r.id as string);
  }

  if (ids.length === 0) return { candidatos: 0, enfileirados: 0, jaTinhamJob: 0 };

  const { data: abertos, error: errJobs } = await db
    .from("jobs")
    .select("lead_id")
    .eq("tipo", "calcular_score")
    .in("status", ["pendente", "rodando"])
    .in("lead_id", ids);
  if (errJobs) throw new Error(`jobs: ${errJobs.message}`);
  const jaComJob = new Set((abertos ?? []).map((j) => j.lead_id as string));

  const novos = ids.filter((id) => !jaComJob.has(id));
  if (novos.length === 0) {
    return { candidatos: ids.length, enfileirados: 0, jaTinhamJob: jaComJob.size };
  }

  const { error: errIns } = await db
    .from("jobs")
    .insert(novos.map((id) => ({ tipo: "calcular_score", lead_id: id, status: "pendente", payload: {} })));
  if (errIns) throw new Error(`jobs insert: ${errIns.message}`);

  return { candidatos: ids.length, enfileirados: novos.length, jaTinhamJob: jaComJob.size };
}
