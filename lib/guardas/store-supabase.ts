// Implementacao real do GuardaStore em cima do Supabase.
//
// Recebe um SupabaseClient ja pronto (nao importa lib/supabase/server aqui,
// para que este arquivo tambem possa ser usado por um script fora do Next).
// No app, chame: criarStoreSupabase(supabaseServer())

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GuardaStore,
  PesquisaOrcamento,
  RegistroDeUso,
  RegistroPlace,
  RegistroRegiao,
} from "./store";

export function criarStoreSupabase(db: SupabaseClient): GuardaStore {
  return {
    async inserirUso(r: RegistroDeUso & { em: string }) {
      const { error } = await db.from("api_usage").insert({
        em: r.em,
        provedor: r.provedor,
        endpoint: r.endpoint,
        search_id: r.searchId ?? null,
        unidades: r.unidades ?? 1,
        faixa_campos: r.faixaCampos ?? null,
        custo_estimado_usd: r.custoEstimadoUsd ?? 0,
        obs: r.obs ?? null,
      });
      if (error) throw new Error(`api_usage insert: ${error.message}`);
    },

    async somarUnidadesDesde(inicioIso: string) {
      const { data, error } = await db
        .from("api_usage")
        .select("unidades")
        .gte("em", inicioIso);
      if (error) throw new Error(`api_usage select: ${error.message}`);
      return (data ?? []).reduce((s: number, row: { unidades: number | null }) => s + (row.unidades ?? 0), 0);
    },

    async lerOrcamentoPesquisa(searchId: string): Promise<PesquisaOrcamento | null> {
      const { data, error } = await db
        .from("searches")
        .select("orcamento_chamadas, chamadas_feitas")
        .eq("id", searchId)
        .maybeSingle();
      if (error) throw new Error(`searches select: ${error.message}`);
      return data ?? null;
    },

    async registrarConsumoPesquisa(searchId: string, dChamadas: number, dCustoUsd: number) {
      const { error } = await db.rpc("registrar_chamada_pesquisa", {
        p_search_id: searchId,
        p_chamadas: dChamadas,
        p_custo: dCustoUsd,
      });
      if (error) {
        throw new Error(
          `rpc registrar_chamada_pesquisa: ${error.message}. ` +
            `A migration 0004 (funcao SQL) ja foi aplicada no Supabase?`,
        );
      }
    },

    async lerRegiao(regiaoTexto: string): Promise<RegistroRegiao | null> {
      const { data, error } = await db
        .from("region_cache")
        .select("centro_lat, centro_lng, resolvido_em")
        .eq("regiao_texto", regiaoTexto)
        .maybeSingle();
      if (error) throw new Error(`region_cache select: ${error.message}`);
      return data ?? null;
    },

    async gravarRegiao(regiaoTexto: string, lat: number, lng: number) {
      const { error } = await db.from("region_cache").upsert({
        regiao_texto: regiaoTexto,
        centro_lat: lat,
        centro_lng: lng,
        resolvido_em: new Date().toISOString(),
      });
      if (error) throw new Error(`region_cache upsert: ${error.message}`);
    },

    async lerPlace(placeId: string): Promise<RegistroPlace | null> {
      const { data, error } = await db
        .from("places_cache")
        .select("resultado_busca, detalhes, busca_em, detalhes_em")
        .eq("google_place_id", placeId)
        .maybeSingle();
      if (error) throw new Error(`places_cache select: ${error.message}`);
      return data ?? null;
    },

    async gravarBuscaPlace(placeId: string, resultadoBusca: unknown) {
      // upsert por google_place_id (PK) -> dois processos gravando o mesmo
      // Place nao criam linha duplicada.
      const { error } = await db.from("places_cache").upsert({
        google_place_id: placeId,
        resultado_busca: resultadoBusca,
        busca_em: new Date().toISOString(),
      });
      if (error) throw new Error(`places_cache upsert(busca): ${error.message}`);
    },

    async gravarDetalhesPlace(placeId: string, detalhes: unknown) {
      // update (nao upsert): os detalhes sempre vem DEPOIS da busca, entao a
      // linha ja existe. resultado_busca e NOT NULL, um upsert sem ele quebraria.
      const { error } = await db
        .from("places_cache")
        .update({ detalhes, detalhes_em: new Date().toISOString() })
        .eq("google_place_id", placeId);
      if (error) throw new Error(`places_cache update(detalhes): ${error.message}`);
    },
  };
}
