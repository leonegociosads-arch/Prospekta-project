// Cria jobs "diagnosticar_ia" para os leads ELEGIVEIS de uma pesquisa.
//
// Elegivel = score >= scoreMinimo OU entre os topN da pesquisa.
// NUNCA e disparado automaticamente pela analise de site nem pelo score -
// so por acao explicita (botao "Gerar diagnosticos" ou `npm run ia`).
//
// Nao enfileira quem ja tem diagnostico valido (mesmo modelo + versao de
// prompt, dentro do TTL, sem erro) nem quem ja tem um job aberto.

import type { SupabaseClient } from "@supabase/supabase-js";
import { carregarConfigIa, type ConfigIa } from "./config-ia";
import { PROMPT_VERSAO } from "./prompt";

const MS_DIA = 86_400_000;

export type ResultadoEnfileirarDiagnostico = {
  candidatos: number;
  elegiveis: number;
  enfileirados: number;
  jaTinhamJob: number;
  jaDiagnosticados: number;
};

export async function enfileirarDiagnosticos(
  db: SupabaseClient,
  opts: {
    searchId?: string;
    leadIds?: string[];
    config?: ConfigIa;
    /** pedido manual (card do lead): ignora o filtro de elegibilidade.
     *  O teto de gasto e o cache continuam valendo no processamento. */
    forcar?: boolean;
  } = {},
): Promise<ResultadoEnfileirarDiagnostico> {
  const config = opts.config ?? carregarConfigIa();

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
  if (ids.length === 0) {
    return { candidatos: 0, elegiveis: 0, enfileirados: 0, jaTinhamJob: 0, jaDiagnosticados: 0 };
  }

  // scores dos candidatos
  const { data: scores, error: errSc } = await db
    .from("scores")
    .select("lead_id, total")
    .in("lead_id", ids);
  if (errSc) throw new Error(`scores: ${errSc.message}`);
  const scorePorLead = new Map<string, number>();
  for (const s of scores ?? []) scorePorLead.set(s.lead_id as string, s.total as number);

  // ranking (so quando ha uma pesquisa de referencia)
  const topLeads = new Set<string>();
  if (opts.searchId && config.topN > 0) {
    const ordenado = [...scorePorLead.entries()]
      .filter(([id]) => ids.includes(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, config.topN)
      .map(([id]) => id);
    for (const id of ordenado) topLeads.add(id);
  }

  const elegiveis = opts.forcar
    ? ids
    : ids.filter((id) => {
        const total = scorePorLead.get(id);
        if (total == null) return false;
        return total >= config.scoreMinimo || topLeads.has(id);
      });
  if (elegiveis.length === 0) {
    return {
      candidatos: ids.length,
      elegiveis: 0,
      enfileirados: 0,
      jaTinhamJob: 0,
      jaDiagnosticados: 0,
    };
  }

  // ja tem diagnostico valido?
  const { data: diags, error: errD } = await db
    .from("ai_diagnoses")
    .select("lead_id, modelo, versao_prompt, atualizado_em, erro")
    .in("lead_id", elegiveis);
  if (errD) throw new Error(`ai_diagnoses: ${errD.message}`);
  const agora = Date.now();
  const jaValido = new Set(
    (diags ?? [])
      .filter(
        (d) =>
          !d.erro &&
          d.modelo === config.modelo &&
          d.versao_prompt === PROMPT_VERSAO &&
          d.atualizado_em &&
          (agora - new Date(d.atualizado_em as string).getTime()) / MS_DIA < config.ttlDias,
      )
      .map((d) => d.lead_id as string),
  );

  // ja tem job aberto?
  const { data: abertos, error: errJ } = await db
    .from("jobs")
    .select("lead_id")
    .eq("tipo", "diagnosticar_ia")
    .in("status", ["pendente", "rodando"])
    .in("lead_id", elegiveis);
  if (errJ) throw new Error(`jobs: ${errJ.message}`);
  const comJob = new Set((abertos ?? []).map((j) => j.lead_id as string));

  const novos = elegiveis.filter((id) => !jaValido.has(id) && !comJob.has(id));
  if (novos.length > 0) {
    const { error: errIns } = await db.from("jobs").insert(
      novos.map((id) => ({
        tipo: "diagnosticar_ia",
        lead_id: id,
        status: "pendente",
        // ja passaram pelo filtro de elegibilidade aqui
        payload: { ignorarElegibilidade: true },
      })),
    );
    if (errIns) throw new Error(`jobs insert: ${errIns.message}`);
  }

  return {
    candidatos: ids.length,
    elegiveis: elegiveis.length,
    enfileirados: novos.length,
    jaTinhamJob: comJob.size,
    jaDiagnosticados: jaValido.size,
  };
}
