// Tipos e valores iniciais das acoes da pagina da pesquisa.
// Fica FORA do actions.ts porque um arquivo "use server" so pode exportar
// funcoes async - constantes/objetos como os ESTADO_*_INICIAL quebram o build.

import type { ResumoDescoberta } from "@/lib/descoberta/executar";
import type { ResultadoEnfileirarDiagnostico } from "@/lib/ia/enfileirar";

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

/** O que o card do lead pode pedir para analisar. */
export type SelecaoLead = {
  site: boolean;
  redes: boolean;
  anuncio: boolean;
  score: boolean;
  ia: boolean;
};

export type EstadoProcessarLead =
  | { status: "idle" }
  | { status: "ok"; enfileirados: number }
  | { status: "erro"; mensagem: string };

export const ESTADO_PROCESSAR_LEAD_INICIAL: EstadoProcessarLead = { status: "idle" };

export type EstadoEnfileirarDiagnostico =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoEnfileirarDiagnostico }
  | { status: "erro"; mensagem: string };

export const ESTADO_ENFILEIRAR_DIAGNOSTICO_INICIAL: EstadoEnfileirarDiagnostico = { status: "idle" };
