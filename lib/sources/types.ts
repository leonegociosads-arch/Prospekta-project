// Arquitetura de fonte de dados PLUGAVEL.
//
// Uma "fonte" (Google Places hoje; OSM, CNPJ ou entrada manual amanha) recebe
// parametros de descoberta e devolve leads normalizados. Ela NAO fala com o
// banco e NAO gasta chamada externa sem passar pelo `ctx.chamarComGuardas`.

import type { PlanoDeChamada } from "@/lib/guardas";

/** Um lead como veio de uma fonte, ja normalizado (antes de gravar no banco). */
export type LeadDescoberto = {
  fonte: string; // "google_places"
  fonteRef: string | null; // id da fonte (= placeId no Google)
  placeId: string | null; // google_place_id; null em fontes sem Place ID
  nome: string;
  categoria: string | null;
  endereco: string | null;
  lat: number | null;
  lng: number | null;
  telefone: string | null;
  siteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  avaliacao: number | null;
  qtdAvaliacoes: number | null;
  statusNegocio: string | null; // OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY | ...
  bruto: unknown; // resposta crua da fonte, por lead
};

export type ParametrosDescoberta = {
  regiaoTexto: string;
  /** null quando a geocodificacao nao esta disponivel -> a fonte busca so por texto */
  centro: { lat: number; lng: number } | null;
  raioKm: number;
  nicho: string;
  limiteLeads: number;
};

/** O que a fonte pode fazer com o "mundo externo": so chamadas guardadas. */
export type ContextoDescoberta = {
  chamarComGuardas<T>(plano: PlanoDeChamada, executar: () => Promise<T>): Promise<T>;
};

export type ResultadoDescoberta = {
  status: "ok" | "zero-resultados";
  leads: LeadDescoberto[];
};

export interface FonteDeDados {
  readonly nome: string;
  descobrir(
    params: ParametrosDescoberta,
    ctx: ContextoDescoberta,
  ): Promise<ResultadoDescoberta>;
}
