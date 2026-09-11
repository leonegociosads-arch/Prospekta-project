// Tipos e valores iniciais das acoes da pagina da pesquisa.
// Fica FORA do actions.ts porque um arquivo "use server" so pode exportar
// funcoes async - constantes/objetos como os ESTADO_*_INICIAL quebram o build.

import type { ResumoDescoberta } from "@/lib/descoberta/executar";
import type { ResultadoEnfileirarDiagnostico } from "@/lib/ia/enfileirar";
import type { AdSignal, Score, SiteAnalysis, SocialAnalysis } from "@/lib/db-types";
import type { SinaisObjetivos } from "@/lib/leads/sinais-objetivos";

export type EstadoDescoberta =
  | { status: "idle" }
  | { status: "ok"; resumo: ResumoDescoberta }
  | { status: "erro"; mensagem: string };

export const ESTADO_DESCOBERTA_INICIAL: EstadoDescoberta = { status: "idle" };

export type EstadoReprocessar =
  | { status: "idle" }
  | { status: "ok"; enfileirados: number }
  | { status: "erro"; mensagem: string };

export const ESTADO_REPROCESSAR_INICIAL: EstadoReprocessar = { status: "idle" };

/** Acao em lote na tabela: aplicar a varios leads de uma vez. */
export type AcaoEmLote = "reprocessar" | "diagnostico";

export type EstadoLote =
  | { status: "idle" }
  | { status: "ok"; enfileirados: number; leads: number }
  | { status: "erro"; mensagem: string };

export const ESTADO_LOTE_INICIAL: EstadoLote = { status: "idle" };

export type EstadoEnfileirarDiagnostico =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoEnfileirarDiagnostico }
  | { status: "erro"; mensagem: string };

export const ESTADO_ENFILEIRAR_DIAGNOSTICO_INICIAL: EstadoEnfileirarDiagnostico = { status: "idle" };

/** Avaliacao do Google ja guardada no cache local (nao custa chamada nova). */
export type ReviewLead = {
  nota: number | null;
  autor: string | null;
  quando: string | null;
  texto: string | null;
};

/**
 * Tudo que existe sobre um lead SEM a IA: os pontos fortes/fracos derivados
 * do que foi medido, mais os dados crus de site, score, anuncios e redes.
 * Carregado sob demanda quando o card abre - a lista nao paga por isso.
 */
export type DetalhesLead = {
  sinais: SinaisObjetivos;
  site: SiteAnalysis | null;
  score: Score | null;
  ads: AdSignal | null;
  sociais: SocialAnalysis[];
  reviews: ReviewLead[];
  horarios: string[];
  mapsUri: string | null;
  telefoneInternacional: string | null;
  enriquecidoEm: string | null;
};

export type EstadoDetalhes =
  | { status: "carregando" }
  | { status: "ok"; detalhes: DetalhesLead }
  | { status: "erro"; mensagem: string };
