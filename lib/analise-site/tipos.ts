// Tipos da analise tecnica de site.

import type { RedesEncontradas } from "@/lib/analise-social/tipos";

export type SinaisResponsividade = {
  mediaQueries: boolean;
  srcset: boolean;
  larguraFixaSuspeita: boolean;
};

export type SinaisSite = {
  temViewport: boolean;
  viewportDeviceWidth: boolean;
  responsividade: SinaisResponsividade;
  temWhatsapp: boolean;
  temTelefone: boolean;
  temFormulario: boolean;
  temCta: boolean;
  temPaginaContato: boolean;
  temMetaPixel: boolean;
  temGa: boolean;
  temGtm: boolean;
  temGoogleAds: boolean;
  temDoubleclick: boolean;
  stack: string[];
  titulo: string | null;
  servidor: string | null;
  /** links de rede social achados no HTML do site (fonte primaria da Etapa 13) */
  redesSociais: RedesEncontradas;
  /** trechos que dispararam cada deteccao, para conferir depois */
  evidencias: Record<string, string[]>;
};

export type ResultadoPageSpeed = {
  performance: number | null;
  acessibilidade: number | null;
  boasPraticas: number | null;
  seo: number | null;
  lcpMs: number | null;
  cls: number | null;
  ttfbMs: number | null;
};

export type RespostaSite = {
  respondeu: boolean;
  status: number | null;
  urlFinal: string;
  redirects: number;
  html: string;
  contentType: string | null;
  tamanhoBytes: number;
  truncado: boolean;
  tlsOk: boolean;
  tlsErro: string | null;
  ttfbMs: number | null;
  headers: Record<string, string>;
  erro: string | null;
};

export type StatusAnalise =
  | "ok"
  | "sem-site"
  | "bloqueado-ssrf"
  | "site-falhou"
  | "pulado-cache";

export type ResultadoAnaliseSite = {
  status: StatusAnalise;
  leadId: string;
  erro?: string;
};
