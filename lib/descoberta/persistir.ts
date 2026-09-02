// Grava um LeadDescoberto: places_cache -> dedup -> leads -> search_leads.
// Isolado por lead: se um falha, o orquestrador continua com os outros.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadDescoberto } from "@/lib/sources/types";
import { chaveNomeEndereco } from "./dedup";

export type ResultadoPersistencia = {
  resultado: "novo" | "ja-existia" | "erro";
  leadId?: string;
  erro?: string;
};

export async function persistirLead(
  db: SupabaseClient,
  searchId: string,
  lead: LeadDescoberto,
): Promise<ResultadoPersistencia> {
  try {
    // 1. places_cache: upsert por google_place_id (nao duplica linha)
    if (lead.placeId) {
      const { error } = await db.from("places_cache").upsert({
        google_place_id: lead.placeId,
        resultado_busca: lead.bruto,
        busca_em: new Date().toISOString(),
      });
      if (error) return { resultado: "erro", erro: `places_cache: ${error.message}` };
    }

    // 2. dedup primaria: Place ID
    let leadIdExistente: string | null = null;
    if (lead.placeId) {
      const { data, error } = await db
        .from("leads")
        .select("id")
        .eq("google_place_id", lead.placeId)
        .maybeSingle();
      if (error) return { resultado: "erro", erro: `leads(place_id): ${error.message}` };
      leadIdExistente = data?.id ?? null;
    }

    // 3. dedup secundaria: nome + endereco (para fontes sem Place ID / entre fontes)
    if (!leadIdExistente) {
      const alvo = chaveNomeEndereco(lead.nome, lead.endereco);
      const { data, error } = await db.from("leads").select("id, nome, endereco");
      if (error) return { resultado: "erro", erro: `leads(dedup): ${error.message}` };
      const match = (data ?? []).find(
        (l: { nome: string; endereco: string | null }) =>
          chaveNomeEndereco(l.nome, l.endereco) === alvo,
      ) as { id: string } | undefined;
      leadIdExistente = match?.id ?? null;
    }

    // 4a. ja existe -> so vincula
    if (leadIdExistente) {
      const { error } = await db
        .from("search_leads")
        .upsert({ search_id: searchId, lead_id: leadIdExistente });
      if (error) return { resultado: "erro", erro: `search_leads: ${error.message}` };
      return { resultado: "ja-existia", leadId: leadIdExistente };
    }

    // 4b. lead novo
    const { data: novo, error: errIns } = await db
      .from("leads")
      .insert({
        google_place_id: lead.placeId,
        fonte: lead.fonte,
        fonte_ref: lead.fonteRef,
        nome: lead.nome,
        categoria: lead.categoria,
        endereco: lead.endereco,
        lat: lead.lat,
        lng: lead.lng,
        telefone: lead.telefone,
        site_url: lead.siteUrl,
        instagram_url: lead.instagramUrl,
        facebook_url: lead.facebookUrl,
        avaliacao: lead.avaliacao,
        qtd_avaliacoes: lead.qtdAvaliacoes,
        status_negocio: lead.statusNegocio,
        bruto: lead.bruto,
      })
      .select("id")
      .single();

    if (errIns || !novo) {
      // corrida: outro processo inseriu o mesmo place_id no meio-tempo
      if (lead.placeId && errIns?.code === "23505") {
        const { data } = await db
          .from("leads")
          .select("id")
          .eq("google_place_id", lead.placeId)
          .maybeSingle();
        if (data?.id) {
          await db.from("search_leads").upsert({ search_id: searchId, lead_id: data.id });
          return { resultado: "ja-existia", leadId: data.id };
        }
      }
      return { resultado: "erro", erro: `leads insert: ${errIns?.message ?? "sem id"}` };
    }

    const { error: errLink } = await db
      .from("search_leads")
      .upsert({ search_id: searchId, lead_id: novo.id });
    if (errLink) return { resultado: "erro", erro: `search_leads: ${errLink.message}` };

    return { resultado: "novo", leadId: novo.id };
  } catch (e) {
    return { resultado: "erro", erro: e instanceof Error ? e.message : String(e) };
  }
}
