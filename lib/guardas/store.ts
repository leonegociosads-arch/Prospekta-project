// Interface minima do que as guardas precisam do banco.
//
// Os modulos (budget/cache/usage) dependem SO desta interface, nunca do
// Supabase direto. Assim:
//  - producao usa `criarStoreSupabase()` (store-supabase.ts)
//  - testes usam um fake em memoria (tests/guardas/fake-store.ts)

export type RegistroDeUso = {
  provedor: "google" | "ia" | "meta";
  /** text_search | place_details | geocoding | pagespeed | ia_diagnosis | meta_ad_library | ... */
  endpoint: string;
  searchId?: string | null;
  /** quantas "unidades" essa chamada consome (default 1) */
  unidades?: number;
  /** faixa de campos pedida na Places API, quando se aplica */
  faixaCampos?: "essentials" | "pro" | "enterprise" | "atmosphere" | null;
  /** custo estimado em USD, quando da para estimar (default 0) */
  custoEstimadoUsd?: number;
  obs?: string | null;
};

export type PesquisaOrcamento = {
  orcamento_chamadas: number;
  chamadas_feitas: number;
};

export type RegistroRegiao = {
  centro_lat: number;
  centro_lng: number;
  resolvido_em: string; // ISO
};

export type RegistroPlace = {
  resultado_busca: unknown;
  detalhes: unknown | null;
  busca_em: string; // ISO
  detalhes_em: string | null; // ISO
};

export interface GuardaStore {
  // ---- usage ----
  inserirUso(registro: RegistroDeUso & { em: string }): Promise<void>;
  /** soma o campo `unidades` de todos os api_usage com `em` >= inicioIso */
  somarUnidadesDesde(inicioIso: string): Promise<number>;

  // ---- budget ----
  lerOrcamentoPesquisa(searchId: string): Promise<PesquisaOrcamento | null>;
  /** incremento ATOMICO dos contadores da pesquisa (via funcao SQL, migration 0004) */
  registrarConsumoPesquisa(searchId: string, dChamadas: number, dCustoUsd: number): Promise<void>;

  // ---- cache: regiao ----
  lerRegiao(regiaoTexto: string): Promise<RegistroRegiao | null>;
  gravarRegiao(regiaoTexto: string, lat: number, lng: number): Promise<void>;

  // ---- cache: places ----
  lerPlace(placeId: string): Promise<RegistroPlace | null>;
  /** upsert por google_place_id: nao duplica linha se dois processos gravarem o mesmo */
  gravarBuscaPlace(placeId: string, resultadoBusca: unknown): Promise<void>;
  gravarDetalhesPlace(placeId: string, detalhes: unknown): Promise<void>;
}
