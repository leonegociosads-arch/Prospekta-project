// Um lead "enriquecido" para a lista da pesquisa: junta o lead com o resumo do
// score, do boletim de site e do diagnostico, no formato que a tabela e o CSV usam.

export type LeadEnriquecido = {
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
  favorito: boolean;
  criado_em: string;
  /** score total (0-100) ou null se ainda nao calculado */
  score: number | null;
  /** true quando ha boletim de site gravado */
  siteAnalisado: boolean;
  /** true/false quando o site foi analisado; null quando ainda nao foi */
  temSinalAnuncio: boolean | null;
  /** true quando ha diagnostico de IA sem erro */
  temDiagnostico: boolean;
};
