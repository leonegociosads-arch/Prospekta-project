// Tipos das tabelas do banco (ver supabase/migrations/).
// Escritos a mao por enquanto; da pra gerar automaticamente depois.

export type StatusPesquisa = "nova" | "descobrindo" | "pronta" | "erro";

export type Search = {
  id: string;
  criada_em: string;
  regiao_texto: string;
  centro_lat: number | null;
  centro_lng: number | null;
  raio_km: number;
  nicho: string;
  filtros: Record<string, unknown>;
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
  bruto: Record<string, unknown> | null;
  criado_em: string;
  atualizado_em: string;
};
