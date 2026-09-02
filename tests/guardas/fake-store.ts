// Store em memoria para os testes das guardas. Nao toca em rede nem no Supabase.

import type {
  GuardaStore,
  PesquisaOrcamento,
  RegistroDeUso,
  RegistroPlace,
  RegistroRegiao,
} from "../../lib/guardas/store";

type Seed = {
  pesquisas?: Record<string, PesquisaOrcamento>;
  regioes?: Record<string, RegistroRegiao>;
  places?: Record<string, RegistroPlace>;
  usos?: Array<RegistroDeUso & { em: string }>;
};

type Opcoes = {
  /** cenario 5: simula o banco falhando ao gravar api_usage */
  falharInserirUso?: boolean;
};

export function criarFakeStore(seed: Seed = {}, opcoes: Opcoes = {}) {
  const pesquisas = new Map<string, PesquisaOrcamento>(Object.entries(seed.pesquisas ?? {}));
  const regioes = new Map<string, RegistroRegiao>(Object.entries(seed.regioes ?? {}));
  const places = new Map<string, RegistroPlace>(Object.entries(seed.places ?? {}));
  const usos: Array<RegistroDeUso & { em: string }> = [...(seed.usos ?? [])];

  const contadores = { inserirUso: 0, lerPlace: 0, registrarConsumoPesquisa: 0 };

  const store: GuardaStore = {
    async inserirUso(registro) {
      contadores.inserirUso++;
      if (opcoes.falharInserirUso) {
        throw new Error("fake: banco indisponivel ao inserir em api_usage");
      }
      usos.push(registro);
    },

    async somarUnidadesDesde(inicioIso) {
      return usos
        .filter((u) => u.em >= inicioIso)
        .reduce((s, u) => s + (u.unidades ?? 1), 0);
    },

    async lerOrcamentoPesquisa(searchId) {
      const p = pesquisas.get(searchId);
      return p ? { ...p } : null;
    },

    async registrarConsumoPesquisa(searchId, dChamadas) {
      contadores.registrarConsumoPesquisa++;
      const p = pesquisas.get(searchId);
      if (!p) throw new Error("fake: pesquisa nao encontrada");
      pesquisas.set(searchId, {
        orcamento_chamadas: p.orcamento_chamadas,
        chamadas_feitas: p.chamadas_feitas + dChamadas,
      });
    },

    async lerRegiao(regiaoTexto) {
      const r = regioes.get(regiaoTexto);
      return r ? { ...r } : null;
    },

    async gravarRegiao(regiaoTexto, lat, lng) {
      regioes.set(regiaoTexto, {
        centro_lat: lat,
        centro_lng: lng,
        resolvido_em: new Date().toISOString(),
      });
    },

    async lerPlace(placeId) {
      contadores.lerPlace++;
      const p = places.get(placeId);
      return p ? { ...p } : null;
    },

    async gravarBuscaPlace(placeId, resultadoBusca) {
      const atual = places.get(placeId);
      places.set(placeId, {
        resultado_busca: resultadoBusca,
        detalhes: atual?.detalhes ?? null,
        busca_em: new Date().toISOString(),
        detalhes_em: atual?.detalhes_em ?? null,
      });
    },

    async gravarDetalhesPlace(placeId, detalhes) {
      const atual = places.get(placeId);
      if (!atual) throw new Error("fake: place sem registro de busca");
      places.set(placeId, { ...atual, detalhes, detalhes_em: new Date().toISOString() });
    },
  };

  return { store, pesquisas, regioes, places, usos, contadores };
}

/** Data ISO de N dias atras - util para testar TTL. */
export function diasAtras(n: number, base: Date = new Date()): string {
  return new Date(base.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}
