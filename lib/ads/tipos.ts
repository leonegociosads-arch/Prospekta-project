// Tipos da deteccao de indicios de trafego pago (etapa 12).
//
// Regra de ouro (plano, secao 12): NUNCA afirmar "nao anuncia". O maximo que
// dizemos e "nenhum indicio", sempre com nivel de confianca.

export type VereditoAds = "forte" | "alguns" | "nenhum";
export type ConfiancaAds = "alta" | "media" | "baixa";
export type MetaAdsEncontrado = "sim" | "nao" | "desconhecido";

/** Um sinal isolado, com peso e a evidencia textual que o sustenta. */
export type SinalAds = {
  chave: string;
  rotulo: string;
  /** 0..1 - quanto esse sinal empurra para "anuncia" */
  peso: number;
  evidencia: string;
};

/** Sinais tirados do proprio site (site_analyses). null = site nao analisado. */
export type SinaisNoSite = {
  temTagConversaoGoogle: boolean;
  temRemarketingDoubleclick: boolean;
  temMetaPixel: boolean;
  temGtm: boolean;
  temParametrosCampanha: boolean;
  sinais: SinalAds[];
};

export type ResultadoMetaAdLibrary = {
  encontrado: MetaAdsEncontrado;
  quantidade: number | null;
  /** de onde veio: chamada real, cache, ou "nao configurado" */
  fonte: "api" | "cache" | "nao-configurado" | "erro";
  detalhe: string | null;
};

export type Diagnostico = {
  veredito: VereditoAds | null; // null = sem base para opinar (site nao analisado)
  confianca: ConfiancaAds;
  evidencias: string[];
  resumo: string;
};

export type StatusDetecaoAds =
  | "ok"
  | "pulado-cache"
  | "lead-nao-encontrado";

export type ResultadoDetecaoAds = {
  status: StatusDetecaoAds;
  leadId: string;
  veredito: VereditoAds | null;
  confianca: ConfiancaAds | null;
  metaAds: MetaAdsEncontrado | null;
};
