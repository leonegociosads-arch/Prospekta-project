// Carrega os leads de uma pesquisa ja "enriquecidos" (com score, situacao do
// site, veredito de anuncio e diagnostico) numa unica passada. Usado pela
// pagina /pesquisa/[id] e pela rota de exportacao CSV - as duas precisam
// exatamente dos mesmos dados.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadEnriquecido, SiteSituacao, VereditoAnuncioLead } from "./tipos";

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

type SiteRow = {
  lead_id: string;
  site_existe: boolean | null;
  status_http: number | null;
  ttfb_ms: number | null;
  erro: string | null;
  tem_whatsapp: boolean | null;
  tem_meta_pixel: boolean | null;
  tem_google_ads: boolean | null;
  tem_doubleclick: boolean | null;
};

/** TTFB (tempo ate o primeiro byte) acima disso conta como site "instavel". */
const TTFB_LENTO_MS = 2500;

/** Situacao resumida do site a partir do boletim. Exportada: o card do lead reusa. */
export function situacaoDoSite(
  temUrl: boolean,
  s:
    | {
        site_existe: boolean | null;
        status_http: number | null;
        ttfb_ms: number | null;
        erro: string | null;
      }
    | undefined
    | null,
): SiteSituacao {
  if (!temUrl) return "sem-site";
  if (!s) return "nao-analisado";
  if (s.erro != null || s.site_existe === false) return "fora-do-ar";
  if (s.status_http != null && s.status_http >= 400) return "instavel";
  if (s.ttfb_ms != null && s.ttfb_ms > TTFB_LENTO_MS) return "instavel";
  return "ok";
}

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

  const [{ data: scores }, { data: sites }, { data: diags }, { data: ads }, { data: socials }] =
    await Promise.all([
      db.from("scores").select("lead_id, total").in("lead_id", ids),
      db
        .from("site_analyses")
        .select(
          "lead_id, site_existe, status_http, ttfb_ms, erro, tem_whatsapp, tem_meta_pixel, tem_google_ads, tem_doubleclick",
        )
        .in("lead_id", ids),
      db.from("ai_diagnoses").select("lead_id, erro").in("lead_id", ids),
      db.from("ad_signals").select("lead_id, veredito").in("lead_id", ids),
      db.from("social_analyses").select("lead_id").in("lead_id", ids),
    ]);

  const scorePorLead = new Map<string, number>();
  for (const s of scores ?? []) scorePorLead.set(s.lead_id as string, s.total as number);

  const sitePorLead = new Map<string, SiteRow>();
  for (const s of (sites ?? []) as SiteRow[]) sitePorLead.set(s.lead_id, s);

  // veredito de anuncio do modulo ads (etapa 12)
  const vereditoPorLead = new Map<string, VereditoAnuncioLead>();
  const adsAnalisados = new Set<string>();
  for (const a of ads ?? []) {
    const id = a.lead_id as string;
    adsAnalisados.add(id); // ha linha -> o worker ja checou (mesmo que sem base)
    const v = a.veredito as string | null;
    vereditoPorLead.set(id, v === "forte" || v === "alguns" || v === "nenhum" ? v : null);
  }

  // sinal de anuncio (true/false/null) para os filtros: o veredito manda; se nao
  // houver, cai nas tags cruas do site (leads analisados antes da etapa 12).
  const sinalAnuncio = (id: string): boolean | null => {
    const v = vereditoPorLead.get(id);
    if (v === "forte" || v === "alguns") return true;
    if (v === "nenhum") return false;
    const s = sitePorLead.get(id);
    if (!s) return null;
    if (s.tem_meta_pixel === true || s.tem_google_ads === true || s.tem_doubleclick === true) return true;
    if (s.tem_meta_pixel === false && s.tem_google_ads === false && s.tem_doubleclick === false) return false;
    return null;
  };

  const comDiagnostico = new Set(
    (diags ?? []).filter((d) => !d.erro).map((d) => d.lead_id as string),
  );

  const comSocial = new Set((socials ?? []).map((s) => s.lead_id as string));

  return leads.map((l) => {
    const temUrl = (l.site_url ?? "").trim() !== "";
    const s = sitePorLead.get(l.id);
    return {
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
      siteSituacao: situacaoDoSite(temUrl, s),
      temWhatsapp: s ? (s.tem_whatsapp ?? null) : null,
      temSinalAnuncio: sinalAnuncio(l.id),
      vereditoAnuncio: vereditoPorLead.get(l.id) ?? null,
      adsAnalisado: adsAnalisados.has(l.id),
      temRedeSocial: (l.instagram_url ?? "").trim() !== "" || (l.facebook_url ?? "").trim() !== "",
      socialAnalisado: comSocial.has(l.id),
      temDiagnostico: comDiagnostico.has(l.id),
    };
  });
}
