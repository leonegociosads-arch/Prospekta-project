// Agregacoes da HOME / painel principal (etapa 31). Funcao PURA e testavel:
// recebe os dados ja carregados (uma consulta por tabela, sem N+1) e devolve
// tudo que a home precisa - KPIs, distribuicao de qualidade, ranking por
// pesquisa, melhores oportunidades e as pesquisas recentes.
//
// Nao inventa metrica nenhuma: so soma, conta e ordena o que ja existe.
// A classificacao BOM/MEDIO/RUIM usa as MESMAS faixas do resto do sistema
// (lib/leads/filtros.ts) - nao e um criterio novo.

import { FAIXA_SCORE_ALTO, FAIXA_SCORE_MEDIO } from "@/lib/leads/filtros";

export type FaixaQualidade = "bom" | "medio" | "ruim";

export function faixaDoScore(score: number): FaixaQualidade {
  if (score >= FAIXA_SCORE_ALTO) return "bom";
  if (score >= FAIXA_SCORE_MEDIO) return "medio";
  return "ruim";
}

export type LeadParaResumo = {
  id: string;
  nome: string;
  categoria: string | null;
  endereco: string | null;
  favorito: boolean;
  criado_em: string;
};

export type SearchParaResumo = {
  id: string;
  nicho: string;
  regiao_texto: string;
  raio_km: number;
  status: string;
  criada_em: string;
};

export type VinculoParaResumo = {
  search_id: string;
  lead_id: string;
  visto_em: string;
};

export type ScoreParaResumo = {
  lead_id: string;
  total: number;
};

export type EntradaResumoPainel = {
  searches: SearchParaResumo[];
  leads: LeadParaResumo[];
  vinculos: VinculoParaResumo[];
  scores: ScoreParaResumo[];
};

export type OpcoesResumoPainel = {
  /** quantas pesquisas entram no grafico de barras (as demais ficam de fora, com link "ver todas") */
  topPorPesquisa?: number;
  /** quantos leads entram no ranking de melhores oportunidades */
  topOportunidades?: number;
  /** quantas pesquisas entram em "pesquisas recentes" */
  topRecentes?: number;
};

export type QualidadeLeads = {
  bons: number;
  medios: number;
  ruins: number;
  totalClassificado: number;
};

export type OportunidadePorPesquisa = {
  searchId: string;
  nicho: string;
  regiaoTexto: string;
  totalLeads: number;
  analisados: number;
  boas: number;
  /** boas / analisados * 100, arredondado; null se ainda nao ha lead analisado nessa pesquisa */
  aproveitamento: number | null;
};

export type MelhorOportunidade = {
  leadId: string;
  nome: string;
  categoria: string | null;
  endereco: string | null;
  favorito: boolean;
  score: number;
  faixa: FaixaQualidade;
  /** da primeira pesquisa (por data) a que o lead pertence - null se nao houver vinculo */
  nicho: string | null;
  regiaoTexto: string | null;
};

export type PesquisaRecente = {
  id: string;
  nicho: string;
  regiaoTexto: string;
  raioKm: number;
  status: string;
  criadaEm: string;
  totalLeads: number;
};

export type ResumoPainel = {
  totalLeads: number;
  leadsAnalisados: number;
  naoAnalisados: number;
  boasOportunidades: number;
  favoritos: number;
  totalPesquisas: number;
  qualidade: QualidadeLeads;
  /** ordenado por boas oportunidades desc; ja limitado a topPorPesquisa */
  porPesquisa: OportunidadePorPesquisa[];
  /** true quando ALGUMA pesquisa ja tem >=1 boa oportunidade - decide se vale desenhar o grafico */
  algumaPesquisaComOportunidade: boolean;
  totalPesquisasForaDoTopo: number;
  /** ordenado por score desc; ja limitado a topOportunidades */
  melhoresOportunidades: MelhorOportunidade[];
  /** ordenado por criada_em desc; ja limitado a topRecentes */
  pesquisasRecentes: PesquisaRecente[];
  totalPesquisasForaDasRecentes: number;
};

const PADRAO: Required<OpcoesResumoPainel> = {
  topPorPesquisa: 5,
  topOportunidades: 5,
  topRecentes: 5,
};

export function montarResumoPainel(
  entrada: EntradaResumoPainel,
  opcoes: OpcoesResumoPainel = {},
): ResumoPainel {
  const { topPorPesquisa, topOportunidades, topRecentes } = { ...PADRAO, ...opcoes };
  const { searches, leads, vinculos, scores } = entrada;

  const scorePorLead = new Map<string, number>();
  for (const s of scores) scorePorLead.set(s.lead_id, s.total);

  // qualidade: so entre quem ja tem score (nao mistura "sem analise" com "ruim")
  const qualidade: QualidadeLeads = { bons: 0, medios: 0, ruins: 0, totalClassificado: 0 };
  for (const total of scorePorLead.values()) {
    qualidade.totalClassificado++;
    const f = faixaDoScore(total);
    if (f === "bom") qualidade.bons++;
    else if (f === "medio") qualidade.medios++;
    else qualidade.ruins++;
  }

  // leads por pesquisa (para o total exibido em "pesquisas recentes") e o
  // primeiro vinculo de cada lead (por visto_em), para atribuir nicho/regiao
  // as "melhores oportunidades" sem escolher arbitrariamente.
  const leadsPorSearch = new Map<string, string[]>();
  const primeiroVinculoPorLead = new Map<string, VinculoParaResumo>();
  for (const v of vinculos) {
    const lista = leadsPorSearch.get(v.search_id) ?? [];
    lista.push(v.lead_id);
    leadsPorSearch.set(v.search_id, lista);

    const atual = primeiroVinculoPorLead.get(v.lead_id);
    if (!atual || v.visto_em < atual.visto_em) primeiroVinculoPorLead.set(v.lead_id, v);
  }

  const searchPorId = new Map(searches.map((s) => [s.id, s]));

  // ------------------------------------------------- oportunidades por pesquisa
  const porPesquisaCompleto: OportunidadePorPesquisa[] = searches.map((s) => {
    const idsLeads = leadsPorSearch.get(s.id) ?? [];
    let analisados = 0;
    let boas = 0;
    for (const id of idsLeads) {
      const total = scorePorLead.get(id);
      if (total == null) continue;
      analisados++;
      if (faixaDoScore(total) === "bom") boas++;
    }
    return {
      searchId: s.id,
      nicho: s.nicho,
      regiaoTexto: s.regiao_texto,
      totalLeads: idsLeads.length,
      analisados,
      boas,
      aproveitamento: analisados > 0 ? Math.round((boas / analisados) * 100) : null,
    };
  });

  porPesquisaCompleto.sort((a, b) => {
    if (b.boas !== a.boas) return b.boas - a.boas;
    if (b.totalLeads !== a.totalLeads) return b.totalLeads - a.totalLeads;
    return a.nicho.localeCompare(b.nicho, "pt-BR");
  });

  const porPesquisa = porPesquisaCompleto.slice(0, topPorPesquisa);

  // -------------------------------------------------------- melhores leads
  const comScore = leads.filter((l) => scorePorLead.has(l.id));
  comScore.sort((a, b) => {
    const diff = (scorePorLead.get(b.id) ?? 0) - (scorePorLead.get(a.id) ?? 0);
    if (diff !== 0) return diff;
    return b.criado_em.localeCompare(a.criado_em); // empate: o mais recente primeiro
  });

  const melhoresOportunidades: MelhorOportunidade[] = comScore.slice(0, topOportunidades).map((l) => {
    const score = scorePorLead.get(l.id) ?? 0;
    const vinculo = primeiroVinculoPorLead.get(l.id);
    const search = vinculo ? searchPorId.get(vinculo.search_id) : undefined;
    return {
      leadId: l.id,
      nome: l.nome,
      categoria: l.categoria,
      endereco: l.endereco,
      favorito: l.favorito,
      score,
      faixa: faixaDoScore(score),
      nicho: search?.nicho ?? null,
      regiaoTexto: search?.regiao_texto ?? null,
    };
  });

  // ---------------------------------------------------- pesquisas recentes
  const searchesOrdenadas = [...searches].sort((a, b) => b.criada_em.localeCompare(a.criada_em));
  const pesquisasRecentes: PesquisaRecente[] = searchesOrdenadas.slice(0, topRecentes).map((s) => ({
    id: s.id,
    nicho: s.nicho,
    regiaoTexto: s.regiao_texto,
    raioKm: s.raio_km,
    status: s.status,
    criadaEm: s.criada_em,
    totalLeads: (leadsPorSearch.get(s.id) ?? []).length,
  }));

  return {
    totalLeads: leads.length,
    leadsAnalisados: scorePorLead.size,
    naoAnalisados: Math.max(0, leads.length - scorePorLead.size),
    boasOportunidades: qualidade.bons,
    favoritos: leads.filter((l) => l.favorito).length,
    totalPesquisas: searches.length,
    qualidade,
    porPesquisa,
    algumaPesquisaComOportunidade: porPesquisaCompleto.some((p) => p.boas > 0),
    totalPesquisasForaDoTopo: Math.max(0, porPesquisaCompleto.length - porPesquisa.length),
    melhoresOportunidades,
    pesquisasRecentes,
    totalPesquisasForaDasRecentes: Math.max(0, searches.length - pesquisasRecentes.length),
  };
}
