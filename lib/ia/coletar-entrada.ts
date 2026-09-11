// Monta o DOSSIE (EntradaDiagnostico) que vai para o modelo, a partir do que o
// Prospekta ja coletou por codigo. Campo sem dado vira "nao_avaliado" de forma
// EXPLICITA - assim o modelo nao confunde "nao coletamos" com "nao existe".

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarDetalhes } from "@/lib/enriquecimento/normalizar";
import type { FatorScore, ModeradorScore } from "@/lib/score/tipos";
import { NAO_AVALIADO, type EntradaDiagnostico, type Talvez } from "./tipos";

/** Datas dos dados-fonte: se algum for mais novo que o diagnostico, o cache expira. */
export type MarcosFrescor = {
  score: string | null;
  site: string | null;
  social: string | null;
  enriquecido: string | null;
};

export type EntradaColetada = {
  nome: string;
  entrada: EntradaDiagnostico;
  marcos: MarcosFrescor;
  scoreTotal: number | null;
};

function ou<T>(v: T | null | undefined): Talvez<T> {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "")
    ? NAO_AVALIADO
    : v;
}
function ouBool(v: boolean | null | undefined): Talvez<boolean> {
  return v === null || v === undefined ? NAO_AVALIADO : v;
}

export async function coletarEntradaDiagnostico(
  db: SupabaseClient,
  leadId: string,
): Promise<EntradaColetada | null> {
  const { data: lead, error } = await db
    .from("leads")
    .select(
      "id, nome, categoria, endereco, telefone, telefone_internacional, status_negocio, avaliacao, qtd_avaliacoes, site_url, instagram_url, facebook_url, horarios, google_place_id, enriquecido_em",
    )
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(`leads: ${error.message}`);
  if (!lead) return null;

  const { data: score, error: errS } = await db
    .from("scores")
    .select("total, detalhamento, calculado_em")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (errS) throw new Error(`scores: ${errS.message}`);

  const { data: site, error: errA } = await db
    .from("site_analyses")
    .select("*")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (errA) throw new Error(`site_analyses: ${errA.message}`);

  const { data: sociais, error: errSoc } = await db
    .from("social_analyses")
    .select("plataforma, status, seguidores, verificado_em")
    .eq("lead_id", leadId)
    .order("verificado_em", { ascending: false });
  if (errSoc) throw new Error(`social_analyses: ${errSoc.message}`);

  let reviews: EntradaDiagnostico["avaliacoes_recentes"] = NAO_AVALIADO;
  if (lead.google_place_id) {
    const { data: pc } = await db
      .from("places_cache")
      .select("detalhes")
      .eq("google_place_id", lead.google_place_id)
      .maybeSingle();
    if (pc?.detalhes) {
      const det = normalizarDetalhes(pc.detalhes);
      if (det.reviews.length > 0) {
        reviews = det.reviews.slice(0, 3).map((r) => ({
          nota: r.nota,
          texto: (r.texto ?? "").slice(0, 300),
        }));
      }
    }
  }

  const entrada: EntradaDiagnostico = {
    empresa: {
      nome: String(lead.nome),
      categoria: ou(lead.categoria),
      endereco: ou(lead.endereco),
      telefone: ou(lead.telefone ?? lead.telefone_internacional),
      situacao: ou(lead.status_negocio),
      avaliacao_media: ou(lead.avaliacao),
      qtd_avaliacoes: ou(lead.qtd_avaliacoes),
      site: ou(lead.site_url),
      instagram: ou(lead.instagram_url),
      facebook: ou(lead.facebook_url),
      horarios:
        Array.isArray(lead.horarios) && lead.horarios.length > 0
          ? (lead.horarios as string[])
          : NAO_AVALIADO,
    },
    score: montarScore(score),
    site: montarSite(site),
    presenca_social:
      (sociais ?? []).length > 0
        ? (sociais ?? []).map((s) => ({
            plataforma: String(s.plataforma),
            status: String(s.status ?? "desconhecido"),
            seguidores: ou<number>(s.seguidores as number | null),
          }))
        : NAO_AVALIADO,
    avaliacoes_recentes: reviews,
  };

  return {
    nome: String(lead.nome),
    entrada,
    scoreTotal: score?.total ?? null,
    marcos: {
      score: score?.calculado_em ?? null,
      site: site?.verificado_em ?? null,
      social: (sociais ?? [])[0]?.verificado_em ?? null,
      enriquecido: lead.enriquecido_em ?? null,
    },
  };
}

function montarScore(
  row: { total: number; detalhamento: unknown } | null,
): EntradaDiagnostico["score"] {
  if (!row) return NAO_AVALIADO;
  const det = (row.detalhamento ?? {}) as {
    confianca?: string;
    fatores?: FatorScore[];
    moderadores?: ModeradorScore[];
  };
  return {
    total: row.total,
    confianca: det.confianca ?? "media",
    fatores: (det.fatores ?? []).map((f) => ({
      rotulo: f.rotulo,
      pontos: f.pontos,
      peso: f.peso,
      motivo: f.motivo,
    })),
    ajustes_aplicados: (det.moderadores ?? [])
      .filter((m) => m.aplicado)
      .map((m) => `${m.rotulo}: ${m.motivo}`),
  };
}

function montarSite(a: Record<string, unknown> | null): EntradaDiagnostico["site"] {
  if (!a) return NAO_AVALIADO;
  const b = (k: string) => ouBool(a[k] as boolean | null);
  const n = (k: string) => ou<number>(a[k] as number | null);
  return {
    responde: b("site_existe"),
    https_valido: a.https === false || a.tls_ok === false ? false : b("https"),
    adaptado_celular: b("tem_viewport"),
    nota_mobile: n("nota_mobile"),
    nota_desempenho: n("nota_desempenho"),
    tem_whatsapp: b("tem_whatsapp"),
    tem_telefone: b("tem_telefone"),
    tem_formulario: b("tem_formulario"),
    tem_cta: b("tem_cta"),
    tem_pagina_contato: b("tem_pagina_contato"),
    tem_meta_pixel: b("tem_meta_pixel"),
    tem_google_analytics: b("tem_ga"),
    tem_tag_manager: b("tem_gtm"),
    tem_tag_google_ads: b("tem_google_ads"),
    tem_remarketing_doubleclick: b("tem_doubleclick"),
    erro_ao_analisar: (a.erro as string | null) ?? null,
    resumo_textual: ou(resumoTextualDoSite(a.sinais)),
  };
}

/** O boletim guarda o texto da home dentro do jsonb `sinais` (etapa 22). */
function resumoTextualDoSite(sinais: unknown): string | null {
  if (!sinais || typeof sinais !== "object") return null;
  const v = (sinais as { resumoTextual?: unknown }).resumoTextual;
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** ISO mais recente entre os marcos (ou null se nenhum). */
export function marcoMaisRecente(m: MarcosFrescor): string | null {
  const datas = [m.score, m.site, m.social, m.enriquecido].filter((x): x is string => !!x);
  if (datas.length === 0) return null;
  return datas.reduce((a, b) => (a > b ? a : b));
}
