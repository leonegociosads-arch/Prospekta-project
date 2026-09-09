// Cria jobs "analisar_site" para leads que tem site_url e ainda nao tem
// um job de analise pendente/rodando. Nao dispara nada — so enfileira;
// quem processa e o worker.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ResultadoEnfileirar = {
  candidatos: number;
  enfileirados: number;
  jaTinhamJob: number;
  semSite: number;
};

export async function enfileirarAnalisesDeSite(
  db: SupabaseClient,
  opts: { searchId?: string } = {},
): Promise<ResultadoEnfileirar> {
  // 1. leads-alvo
  let leads: Array<{ id: string; site_url: string | null }> = [];
  if (opts.searchId) {
    const { data, error } = await db
      .from("search_leads")
      .select("leads(id, site_url)")
      .eq("search_id", opts.searchId);
    if (error) throw new Error(`search_leads: ${error.message}`);
    leads = (data ?? [])
      .map((v) => {
        const b = (v as Record<string, unknown>).leads;
        return (Array.isArray(b) ? b[0] : b) as { id: string; site_url: string | null } | null;
      })
      .filter((l): l is { id: string; site_url: string | null } => l != null);
  } else {
    const { data, error } = await db.from("leads").select("id, site_url");
    if (error) throw new Error(`leads: ${error.message}`);
    leads = data ?? [];
  }

  const comSite = leads.filter((l) => (l.site_url ?? "").trim() !== "");
  const semSite = leads.length - comSite.length;
  if (comSite.length === 0) {
    return { candidatos: 0, enfileirados: 0, jaTinhamJob: 0, semSite };
  }

  // 2. quais desses ja tem job aberto
  const ids = comSite.map((l) => l.id);
  const { data: jobsAbertos, error: errJobs } = await db
    .from("jobs")
    .select("lead_id")
    .eq("tipo", "analisar_site")
    .in("status", ["pendente", "rodando"])
    .in("lead_id", ids);
  if (errJobs) throw new Error(`jobs: ${errJobs.message}`);
  const jaComJob = new Set((jobsAbertos ?? []).map((j) => j.lead_id as string));

  const novos = comSite.filter((l) => !jaComJob.has(l.id));
  if (novos.length === 0) {
    return { candidatos: comSite.length, enfileirados: 0, jaTinhamJob: jaComJob.size, semSite };
  }

  // 3. insere
  const { error: errIns } = await db.from("jobs").insert(
    novos.map((l) => ({ tipo: "analisar_site", lead_id: l.id, status: "pendente", payload: {} })),
  );
  if (errIns) throw new Error(`jobs insert: ${errIns.message}`);

  return {
    candidatos: comSite.length,
    enfileirados: novos.length,
    jaTinhamJob: jaComJob.size,
    semSite,
  };
}
