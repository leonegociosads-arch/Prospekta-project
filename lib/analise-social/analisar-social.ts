// Presenca social objetiva de UM lead. COMPLEMENTAR:
//  - so lanca em erro de BANCO (o job dela sozinha faz retry);
//  - qualquer falha de rede social vira status "desconhecido" e segue;
//  - nunca toca em analise de site nem em score.
//
// Fonte dos links: 1) o proprio site do lead (site_analyses.sinais.redesSociais,
// ou um download do site se ainda nao analisado);  2) leads.instagram_url / facebook_url.

import type { SupabaseClient } from "@supabase/supabase-js";
import { carregarGuardaConfig } from "@/lib/guardas";
import { baixarPagina, type OpcoesBaixar } from "@/lib/analise-site/baixar";
import { extrairRedesDoHtml, normalizarUrlInstagram, normalizarUrlFacebook } from "./extrair-redes";
import { classificarResposta } from "./classificar";
import { extrairSinaisInstagram, extrairSinaisFacebook } from "./sinais-social";
import {
  SINAIS_VAZIOS,
  type OrigemLink,
  type Plataforma,
  type RedesEncontradas,
  type ResultadoAnaliseSocial,
  type ResultadoPlataforma,
  type SinaisPerfil,
} from "./tipos";

export type DepsAnaliseSocial = {
  db: SupabaseClient;
  fetchImpl?: typeof fetch;
  baixarOpts?: OpcoesBaixar;
  agora?: () => Date;
};

const MS_DIA = 86_400_000;
const PLATAFORMAS: Plataforma[] = ["instagram", "facebook"];

export async function analisarSocial(
  deps: DepsAnaliseSocial,
  leadId: string,
  opts: { forcar?: boolean } = {},
): Promise<ResultadoAnaliseSocial> {
  const { db } = deps;
  const agora = deps.agora ? deps.agora() : new Date();
  const config = carregarGuardaConfig();

  const { data: lead, error } = await db
    .from("leads")
    .select("id, site_url, instagram_url, facebook_url")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(`leads: ${error.message}`);
  if (!lead) return { leadId, status: "lead-nao-encontrado", plataformas: [] };

  // cache
  if (!opts.forcar) {
    const { data: ant } = await db
      .from("social_analyses")
      .select("verificado_em")
      .eq("lead_id", leadId)
      .order("verificado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ant?.verificado_em) {
      const dias = (agora.getTime() - new Date(ant.verificado_em).getTime()) / MS_DIA;
      if (dias < config.ttlSocialDias) return { leadId, status: "pulado-cache", plataformas: [] };
    }
  }

  const { doSite } = await coletarLinks(db, leadId, lead, deps);

  const plataformas: ResultadoPlataforma[] = [];
  for (const plataforma of PLATAFORMAS) {
    const r = await analisarUma(plataforma, doSite, lead, deps).catch(
      (e): ResultadoPlataforma => ({
        plataforma,
        status: "desconhecido",
        url: null,
        origem: null,
        sinais: { ...SINAIS_VAZIOS },
        motivo: `falha inesperada, tratada como desconhecido: ${e instanceof Error ? e.message : String(e)}`,
      }),
    );
    plataformas.push(r);
    await gravar(db, leadId, agora, r); // erro de banco aqui SIM relanca (retry do job)
  }

  return { leadId, status: "ok", plataformas };
}

// ------------------------------------------------------------ links

async function coletarLinks(
  db: SupabaseClient,
  leadId: string,
  lead: { site_url: string | null },
  deps: DepsAnaliseSocial,
): Promise<{ doSite: RedesEncontradas }> {
  let doSite: RedesEncontradas = { instagram: null, facebook: null, outras: [] };

  // 1) do site_analyses ja gravado
  const { data: sa } = await db
    .from("site_analyses")
    .select("sinais")
    .eq("lead_id", leadId)
    .maybeSingle();
  const guardado = (sa?.sinais as { redesSociais?: RedesEncontradas } | null)?.redesSociais;
  if (guardado) {
    doSite = {
      instagram: guardado.instagram ?? null,
      facebook: guardado.facebook ?? null,
      outras: Array.isArray(guardado.outras) ? guardado.outras : [],
    };
  } else if ((lead.site_url ?? "").trim()) {
    // 2) site ainda nao analisado -> 1 download so para pegar os links
    try {
      const resp = await baixarPagina(lead.site_url!.trim(), {
        fetchImpl: deps.fetchImpl,
        ...deps.baixarOpts,
      });
      if (resp.respondeu && resp.html) doSite = extrairRedesDoHtml(resp.html);
    } catch {
      /* site fora do ar nao impede a analise social */
    }
  }

  return { doSite };
}

function escolherUrl(
  plataforma: Plataforma,
  doSite: RedesEncontradas,
  lead: { instagram_url: string | null; facebook_url: string | null },
): { url: string | null; origem: OrigemLink | null } {
  if (plataforma === "instagram") {
    if (doSite.instagram) return { url: doSite.instagram, origem: "site" };
    const gp = lead.instagram_url ? normalizarUrlInstagram(lead.instagram_url) : null;
    return gp ? { url: gp, origem: "google_places" } : { url: null, origem: null };
  }
  if (doSite.facebook) return { url: doSite.facebook, origem: "site" };
  const gp = lead.facebook_url ? normalizarUrlFacebook(lead.facebook_url) : null;
  return gp ? { url: gp, origem: "google_places" } : { url: null, origem: null };
}

// ------------------------------------------------------------ 1 plataforma

async function analisarUma(
  plataforma: Plataforma,
  doSite: RedesEncontradas,
  lead: { instagram_url: string | null; facebook_url: string | null },
  deps: DepsAnaliseSocial,
): Promise<ResultadoPlataforma> {
  const { url, origem } = escolherUrl(plataforma, doSite, lead);
  if (!url) {
    return {
      plataforma,
      status: "sem_link",
      url: null,
      origem: null,
      sinais: { ...SINAIS_VAZIOS },
      motivo: "nenhum link para esta plataforma no site nem no Google (nao significa que a empresa nao tenha)",
    };
  }

  const resp = await baixarPagina(url, {
    fetchImpl: deps.fetchImpl,
    timeoutMs: 10_000,
    maxRedirects: 4,
    ...deps.baixarOpts,
  });

  const { status, motivo } = classificarResposta(resp, plataforma);

  let sinais: SinaisPerfil = { ...SINAIS_VAZIOS };
  if (status === "encontrado") {
    sinais =
      plataforma === "instagram"
        ? extrairSinaisInstagram(resp.html)
        : extrairSinaisFacebook(resp.html);
  }

  return { plataforma, status, url, origem, sinais, motivo };
}

// ------------------------------------------------------------ persistencia

async function gravar(
  db: SupabaseClient,
  leadId: string,
  agora: Date,
  r: ResultadoPlataforma,
): Promise<void> {
  const { error } = await db.from("social_analyses").upsert(
    {
      lead_id: leadId,
      plataforma: r.plataforma,
      verificado_em: agora.toISOString(),
      status: r.status,
      perfil_existe: r.status === "encontrado" ? true : r.status === "nao_encontrado" ? false : null,
      perfil_url: r.url,
      seguidores: r.sinais.seguidores,
      ultimo_post_em: r.sinais.ultimoPostEm,
      posts_recentes: r.sinais.posts,
      tem_bio: r.status === "encontrado" ? r.sinais.bio != null : null,
      tem_link: r.status === "encontrado" ? r.sinais.linkExterno != null : null,
      objetivo: {
        origem: r.origem,
        bio: r.sinais.bio,
        link_externo: r.sinais.linkExterno,
        motivo: r.motivo,
      },
      avaliacao_ia: null,
      erro: r.status === "encontrado" ? null : r.motivo,
    },
    { onConflict: "lead_id,plataforma" },
  );
  if (error) throw new Error(`social_analyses upsert: ${error.message}`);
}
