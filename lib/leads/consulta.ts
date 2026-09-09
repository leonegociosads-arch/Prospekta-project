// Carrega os leads de uma pesquisa ja "enriquecidos" (com score, flags do site
// e diagnostico) numa unica passada. Usado pela pagina /pesquisa/[id] e pela
// rota de exportacao CSV - as duas precisam exatamente dos mesmos dados.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadEnriquecido } from "./tipos";

type LeadRow = {
  id: string;
  nome: string;
  categoria: string | null;
  endereco: string | null;
  telefone: string | null;
  site_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  avaliacao: number | null;
  qtd_avaliacoes: number | null;
  status_negocio: string | null;
  favorito: boolean | null;
  criado_em: string;
};

export async function carregarLeadsDaPesquisa(
  db: SupabaseClient,
  searchId: string,
): Promise<LeadEnriquecido[]> {
  const { data: vinculos, error } = await db
    .from("search_leads")
    .select(
      "leads(id, nome, categoria, endereco, telefone, site_url, instagram_url, facebook_url, avaliacao, qtd_avaliacoes, status_negocio, favorito, criado_em)",
    )
    .eq("search_id", searchId);
  if (error) throw new Error(`search_leads: ${error.message}`);

  const leads: LeadRow[] = (vinculos ?? [])
    .map((v) => {
      const b = (v as Record<string, unknown>).leads;
      return (Array.isArray(b) ? b[0] : b) as LeadRow | null;
    })
    .filter((l): l is LeadRow => l != null);

  const ids = leads.map((l) => l.id);
  if (ids.length === 0) return [];

  const [{ data: scores }, { data: sites }, { data: diags }, { data: ads }] = await Promise.all([
    db.from("scores").select("lead_id, total").in("lead_id", ids),
    db
      .from("site_analyses")
      .select("lead_id, tem_meta_pixel, tem_google_ads, tem_doubleclick")
      .in("lead_id", ids),
    db.from("ai_diagnoses").select("lead_id, erro").in("lead_id", ids),
    db.from("ad_signals").select("lead_id, veredito").in("lead_id", ids),
  ]);

  const scorePorLead = new Map<string, number>();
  for (const s of scores ?? []) scorePorLead.set(s.lead_id as string, s.total as number);

  // sinal de anuncio: o veredito de ad_signals manda; se nao houver, cai nas
  // tags cruas do site (leads analisados antes da etapa 12)
  const vereditoPorLead = new Map<string, string | null>();
  for (const a of ads ?? []) vereditoPorLead.set(a.lead_id as string, (a.veredito as string | null) ?? null);

  const sitePorLead = new Map<string, boolean | null>();
  for (const a of sites ?? []) {
    const sinal =
      a.tem_meta_pixel === true || a.tem_google_ads === true || a.tem_doubleclick === true
        ? true
        : a.tem_meta_pixel === false && a.tem_google_ads === false && a.tem_doubleclick === false
          ? false
          : null;
    sitePorLead.set(a.lead_id as string, sinal);
  }

  const sinalAnuncio = (id: string): boolean | null => {
    const v = vereditoPorLead.get(id);
    if (v === "forte" || v === "alguns") return true;
    if (v === "nenhum") return false;
    return sitePorLead.has(id) ? (sitePorLead.get(id) ?? null) : null;
  };

  const comDiagnostico = new Set(
    (diags ?? []).filter((d) => !d.erro).map((d) => d.lead_id as string),
  );

  return leads.map((l) => ({
    id: l.id,
    nome: l.nome,
    categoria: l.categoria,
    endereco: l.endereco,
    telefone: l.telefone,
    site_url: l.site_url,
    instagram_url: l.instagram_url,
    facebook_url: l.facebook_url,
    avaliacao: l.avaliacao,
    qtd_avaliacoes: l.qtd_avaliacoes,
    status_negocio: l.status_negocio,
    favorito: l.favorito === true,
    criado_em: l.criado_em,
    score: scorePorLead.get(l.id) ?? null,
    siteAnalisado: sitePorLead.has(l.id),
    temSinalAnuncio: sinalAnuncio(l.id),
    temDiagnostico: comDiagnostico.has(l.id),
  }));
}
