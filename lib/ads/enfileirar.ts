// Cria jobs "detectar_ads" para leads que ainda nao tem um job aberto.
// E barato (sinais do site; Meta so se houver token) e faz parte do pipeline:
// o handler de analisar_site ja enfileira este junto com o score.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ResultadoEnfileirarAds = {
  candidatos: number;
  enfileirados: number;
  jaTinhamJob: number;
};

export async function enfileirarDetecaoAds(
  db: SupabaseClient,
  opts: { searchId?: string; leadIds?: string[]; semSiteApenas?: boolean } = {},
): Promise<ResultadoEnfileirarAds> {
  let ids: string[];
  if (opts.leadIds) {
    ids = [...new Set(opts.leadIds)];
  } else if (opts.searchId && opts.semSiteApenas) {
    // Leads SEM site nunca passam pela analise de site, entao nunca teriam
    // deteccao de anuncio. Aqui agendamos so para eles; os leads COM site
    // herdam a deteccao do fim do job "analisar_site" (quando os sinais do
    // proprio site ja existem).
    const { data, error } = await db
      .from("search_leads")
      .select("leads(id, site_url)")
      .eq("search_id", opts.searchId);
    if (error) throw new Error(`search_leads: ${error.message}`);
    ids = (data ?? [])
      .map((v) => {
        const b = (v as Record<string, unknown>).leads;
        return (Array.isArray(b) ? b[0] : b) as { id: string; site_url: string | null } | null;
      })
      .filter((l): l is { id: string; site_url: string | null } => l != null)
      .filter((l) => (l.site_url ?? "").trim() === "")
      .map((l) => l.id);
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
    .eq("tipo", "detectar_ads")
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
    .insert(novos.map((id) => ({ tipo: "detectar_ads", lead_id: id, status: "pendente", payload: {} })));
  if (errIns) throw new Error(`jobs insert: ${errIns.message}`);

  return { candidatos: ids.length, enfileirados: novos.length, jaTinhamJob: jaComJob.size };
}
