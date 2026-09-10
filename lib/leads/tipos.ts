// Um lead "enriquecido" para a lista da pesquisa: junta o lead com o resumo do
// score, do boletim de site, do veredito de anuncio e do diagnostico, no
// formato que a tabela e o CSV usam.

/** Situacao resumida do site, para a coluna da tabela. */
export type SiteSituacao =
  | "sem-site" // o lead nao tem site_url
  | "nao-analisado" // tem site mas o worker ainda nao analisou
  | "ok" // site no ar, responde bem
  | "instavel" // responde, mas lento ou com status de erro
  | "fora-do-ar"; // nao respondeu / falha de conexao / TLS

/** Veredito de trafego pago (nunca "nao anuncia" - so o que os dados mostram). */
export type VereditoAnuncioLead = "forte" | "alguns" | "nenhum" | null;

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
  /** situacao resumida do site para a tabela */
  siteSituacao: SiteSituacao;
  /** o site tem link de WhatsApp em destaque? null quando o site nao foi analisado */
  temWhatsapp: boolean | null;
  /** true/false quando o site foi analisado; null quando ainda nao foi */
  temSinalAnuncio: boolean | null;
  /** veredito de anuncio do modulo ads (forte/alguns/nenhum) ou null */
  vereditoAnuncio: VereditoAnuncioLead;
  /** true quando ha link de Instagram ou Facebook */
  temRedeSocial: boolean;
  /** true quando a presenca social ja foi verificada pelo worker */
  socialAnalisado: boolean;
  /** true quando ha diagnostico de IA sem erro */
  temDiagnostico: boolean;
};
