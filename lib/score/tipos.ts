// Tipos do Score de Oportunidade.

export type Confianca = "alta" | "media" | "baixa";

/** Sinais tecnicos do site (do site_analyses). null = campo desconhecido. */
export type EntradaAnalise = {
  siteExiste: boolean | null;
  https: boolean | null;
  tlsOk: boolean | null;
  statusHttp: number | null;
  temViewport: boolean | null;
  notaMobile: number | null;
  notaDesempenho: number | null;
  pesoKb: number | null;
  ttfbMs: number | null;
  temWhatsapp: boolean | null;
  temFormulario: boolean | null;
  temCta: boolean | null;
  temPaginaContato: boolean | null;
  temMetaPixel: boolean | null;
  temGa: boolean | null;
  temGtm: boolean | null;
  temGoogleAds: boolean | null;
  temDoubleclick: boolean | null;
  erro: string | null;
};

export type EntradaScore = {
  statusNegocio: string | null;
  avaliacao: number | null;
  qtdAvaliacoes: number | null;
  telefone: string | null;
  siteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  /** null = site ainda nao analisado tecnicamente */
  analiseSite: EntradaAnalise | null;
};

export type FatorScore = {
  chave: string;
  rotulo: string;
  peso: number;
  /** 0..1 - o quanto do fator o lead "ganhou", ANTES dos moderadores */
  fracao: number;
  /** pontos que entram no total (DEPOIS dos moderadores) */
  pontos: number;
  /** pontos que o fator teria sem moderadores */
  pontosBrutos: number;
  confianca: Confianca;
  motivo: string;
};

export type ModeradorScore = {
  chave: string;
  rotulo: string;
  aplicado: boolean;
  /** multiplicador efetivo (1 = sem efeito) */
  fator: number;
  motivo: string;
};

export type ResultadoScore = {
  versao: string;
  calculadoEm: string;
  total: number;
  confianca: Confianca;
  fatores: FatorScore[];
  moderadores: ModeradorScore[];
};
