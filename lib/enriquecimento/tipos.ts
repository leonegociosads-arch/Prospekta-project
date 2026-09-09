// Tipos do enriquecimento profundo (Place Details).

export type ReviewNormalizada = {
  autor: string | null;
  nota: number | null;
  texto: string | null;
  /** ex.: "há 2 meses" (relativePublishTimeDescription) */
  quando: string | null;
  publicadoEm: string | null;
};

export type DetalhesNormalizados = {
  telefoneInternacional: string | null;
  telefoneNacional: string | null;
  siteUrl: string | null;
  mapsUri: string | null;
  /** regularOpeningHours.weekdayDescriptions */
  horarios: string[];
  abertoAgora: boolean | null;
  statusNegocio: string | null;
  nota: number | null;
  qtdAvaliacoes: number | null;
  reviews: ReviewNormalizada[];
};

export type ResultadoEnriquecimento = {
  status: "enriquecido" | "cache" | "sem-place-id" | "lead-nao-encontrado";
  /** de onde vieram os detalhes nesta execucao */
  fonte: "google" | "cache" | null;
  detalhes: DetalhesNormalizados | null;
  /** true so quando houve chamada real ao Google (e portanto registro em api_usage) */
  registradoUso: boolean;
  incluiuReviews: boolean;
};
