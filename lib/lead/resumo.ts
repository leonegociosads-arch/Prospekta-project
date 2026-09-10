// Resumo de 1 lead para o card da tabela: score, situacao do site, veredito de
// anuncio, redes e diagnostico de IA + quantas tarefas dele ainda estao na fila.
// Usado pela rota GET /lead/[id]/resumo (que o card consulta enquanto processa).

import type { SupabaseClient } from "@supabase/supabase-js";
import { situacaoDoSite } from "@/lib/leads/consulta";
import type { SiteSituacao, VereditoAnuncioLead } from "@/lib/leads/tipos";

/** Tipos de job que o card dispara/observa para 1 lead. */
export const TIPOS_JOB_LEAD = [
  "analisar_site",
  "calcular_score",
  "analisar_social",
  "detectar_ads",
  "diagnosticar_ia",
] as const;

export type ItemResumo = "feito" | "processando" | "nao-feito";

export type ResumoLead = {
  id: string;
  nome: string;
  score: number | null;
  siteSituacao: SiteSituacao;
  temSite: boolean;
  vereditoAnuncio: VereditoAnuncioLead;
  temRedeSocial: boolean;
  redesAnalisadas: boolean;
  diagnostico: {
    resumo: string | null;
    servicoSugerido: string | null;
    anguloComercial: string | null;
    confianca: string | null;
    erro: string | null;
  } | null;
  /** total de jobs pendentes/rodando do lead (para o card saber que ainda processa) */
  jobsAbertos: number;
  /** situacao item a item, para o card mostrar o andamento */
  itens: {
    site: ItemResumo;
    redes: ItemResumo;
    anuncio: ItemResumo;
    score: ItemResumo;
    ia: ItemResumo;
  };
};

function item(feito: boolean, naFila: boolean): ItemResumo {
  if (feito) return "feito";
  if (naFila) return "processando";
  return "nao-feito";
}

export async function carregarResumoLead(
  db: SupabaseClient,
  leadId: string,
): Promise<ResumoLead | null> {
  const { data: lead, error } = await db
    .from("leads")
    .select("id, nome, site_url, instagram_url, facebook_url")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(`leads: ${error.message}`);
  if (!lead) return null;

  const [{ data: score }, { data: site }, { data: ad }, { data: socials }, { data: diag }, { data: jobs }] =
    await Promise.all([
      db.from("scores").select("total").eq("lead_id", leadId).maybeSingle(),
      db
        .from("site_analyses")
        .select("site_existe, status_http, ttfb_ms, erro")
        .eq("lead_id", leadId)
        .maybeSingle(),
      db.from("ad_signals").select("veredito").eq("lead_id", leadId).maybeSingle(),
      db.from("social_analyses").select("id").eq("lead_id", leadId).limit(1),
      db
        .from("ai_diagnoses")
        .select("resumo, servico_sugerido, angulo_comercial, confianca, erro")
        .eq("lead_id", leadId)
        .maybeSingle(),
      db
        .from("jobs")
        .select("tipo")
        .eq("lead_id", leadId)
        .in("tipo", TIPOS_JOB_LEAD as unknown as string[])
        .in("status", ["pendente", "rodando"]),
    ]);

  const temSite = (lead.site_url ?? "").trim() !== "";
  const naFila = new Set((jobs ?? []).map((j) => j.tipo as string));

  const v = ad?.veredito as string | null;
  const vereditoAnuncio: VereditoAnuncioLead =
    v === "forte" || v === "alguns" || v === "nenhum" ? v : null;

  const temRedeSocial =
    (lead.instagram_url ?? "").trim() !== "" || (lead.facebook_url ?? "").trim() !== "";
  const redesAnalisadas = (socials ?? []).length > 0;

  const diagnostico = diag
    ? {
        resumo: (diag.resumo as string | null) ?? null,
        servicoSugerido: (diag.servico_sugerido as string | null) ?? null,
        anguloComercial: (diag.angulo_comercial as string | null) ?? null,
        confianca: (diag.confianca as string | null) ?? null,
        erro: (diag.erro as string | null) ?? null,
      }
    : null;

  return {
    id: lead.id as string,
    nome: lead.nome as string,
    score: (score?.total as number | null) ?? null,
    siteSituacao: situacaoDoSite(temSite, site),
    temSite,
    vereditoAnuncio,
    temRedeSocial,
    redesAnalisadas,
    diagnostico,
    jobsAbertos: jobs?.length ?? 0,
    itens: {
      site: item(!!site, naFila.has("analisar_site")),
      redes: item(redesAnalisadas, naFila.has("analisar_social")),
      anuncio: item(vereditoAnuncio != null, naFila.has("detectar_ads")),
      score: item(score?.total != null, naFila.has("calcular_score")),
      ia: item(diagnostico != null && !diagnostico.erro, naFila.has("diagnosticar_ia")),
    },
  };
}
