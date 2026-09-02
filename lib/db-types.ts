// Tipos das tabelas do banco (ver supabase/migrations/).
// Escritos a mao por enquanto; da pra gerar automaticamente depois.

type Json = Record<string, unknown>;

export type StatusPesquisa = "nova" | "descobrindo" | "pronta" | "erro";
export type StatusJob = "pendente" | "rodando" | "feito" | "erro";
export type VeredictoAds = "forte" | "alguns" | "nenhum";
export type ConfiancaAds = "alta" | "media" | "baixa";
export type Plataforma = "instagram" | "facebook";

export type Search = {
  id: string;
  criada_em: string;
  regiao_texto: string;
  centro_lat: number | null;
  centro_lng: number | null;
  raio_km: number;
  nicho: string;
  filtros: Json;
  limite_leads: number;
  orcamento_chamadas: number;
  chamadas_feitas: number;
  custo_estimado_usd: number;
  status: StatusPesquisa;
};

export type Lead = {
  id: string;
  google_place_id: string | null;
  fonte: string;
  fonte_ref: string | null;
  nome: string;
  categoria: string | null;
  endereco: string | null;
  lat: number | null;
  lng: number | null;
  telefone: string | null;
  site_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  avaliacao: number | null;
  qtd_avaliacoes: number | null;
  status_negocio: string | null;
  bruto: Json | null;
  criado_em: string;
  atualizado_em: string;
};

export type SearchLead = {
  search_id: string;
  lead_id: string;
  visto_em: string;
};

export type PlaceCache = {
  google_place_id: string;
  resultado_busca: Json;
  detalhes: Json | null;
  busca_em: string;
  detalhes_em: string | null;
};

export type RegionCache = {
  regiao_texto: string;
  centro_lat: number;
  centro_lng: number;
  resolvido_em: string;
};

export type ApiUsage = {
  id: string;
  em: string;
  provedor: string;
  endpoint: string;
  faixa_campos: string | null;
  search_id: string | null;
  unidades: number;
  custo_estimado_usd: number;
  obs: string | null;
};

export type SiteAnalysis = {
  id: string;
  lead_id: string;
  verificado_em: string;
  site_existe: boolean | null;
  url_final: string | null;
  https: boolean | null;
  status_http: number | null;
  tem_viewport: boolean | null;
  nota_mobile: number | null;
  nota_desempenho: number | null;
  peso_kb: number | null;
  ttfb_ms: number | null;
  tem_whatsapp: boolean | null;
  tem_telefone: boolean | null;
  tem_formulario: boolean | null;
  tem_cta: boolean | null;
  tem_pagina_contato: boolean | null;
  tem_meta_pixel: boolean | null;
  tem_ga: boolean | null;
  tem_gtm: boolean | null;
  tem_google_ads: boolean | null;
  stack: Json | null;
  sinais: Json | null;
  erro: string | null;
};

export type AdSignal = {
  id: string;
  lead_id: string;
  verificado_em: string;
  meta_ads_encontrado: "sim" | "nao" | "desconhecido" | null;
  meta_ads_qtd: number | null;
  google_ads_no_site: boolean | null;
  sinais: Json | null;
  veredito: VeredictoAds | null;
  confianca: ConfiancaAds | null;
  evidencias: Json | null;
  erro: string | null;
};

export type SocialAnalysis = {
  id: string;
  lead_id: string;
  plataforma: Plataforma;
  verificado_em: string;
  perfil_existe: boolean | null;
  perfil_url: string | null;
  seguidores: number | null;
  ultimo_post_em: string | null;
  posts_recentes: number | null;
  tem_bio: boolean | null;
  tem_link: boolean | null;
  objetivo: Json | null;
  avaliacao_ia: Json | null;
  erro: string | null;
};

export type Score = {
  id: string;
  lead_id: string;
  calculado_em: string;
  total: number;
  detalhamento: Json;
  versao_formula: string;
};

export type AiDiagnosis = {
  id: string;
  lead_id: string;
  criado_em: string;
  modelo: string;
  versao_prompt: string;
  resumo: string | null;
  problemas: Json | null;
  angulo_de_entrada: string | null;
  tokens_entrada: number | null;
  tokens_saida: number | null;
  custo_usd: number;
};

export type Job = {
  id: string;
  tipo: string;
  search_id: string | null;
  lead_id: string | null;
  payload: Json;
  status: StatusJob;
  tentativas: number;
  max_tentativas: number;
  ultimo_erro: string | null;
  agendado_para: string;
  criado_em: string;
  atualizado_em: string;
};
