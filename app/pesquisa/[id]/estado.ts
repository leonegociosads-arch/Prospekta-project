// Tipos e valores iniciais das acoes da pagina da pesquisa.
// Fica FORA do actions.ts porque um arquivo "use server" so pode exportar
// funcoes async - constantes/objetos como os ESTADO_*_INICIAL quebram o build.

import type { ResumoDescoberta } from "@/lib/descoberta/executar";
import type { ResultadoEnfileirar } from "@/lib/analise-site/enfileirar";
import type { ResultadoEnfileirarScore } from "@/lib/score/enfileirar";
import type { ResultadoEnfileirarDiagnostico } from "@/lib/ia/enfileirar";

export type EstadoDescoberta =
  | { status: "idle" }
  | { status: "ok"; resumo: ResumoDescoberta }
  | { status: "erro"; mensagem: string };

export const ESTADO_DESCOBERTA_INICIAL: EstadoDescoberta = { status: "idle" };

export type EstadoEnfileirar =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoEnfileirar }
  | { status: "erro"; mensagem: string };

export const ESTADO_ENFILEIRAR_INICIAL: EstadoEnfileirar = { status: "idle" };

export type EstadoEnfileirarScore =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoEnfileirarScore }
  | { status: "erro"; mensagem: string };

export const ESTADO_ENFILEIRAR_SCORE_INICIAL: EstadoEnfileirarScore = { status: "idle" };

export type EstadoEnfileirarDiagnostico =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoEnfileirarDiagnostico }
  | { status: "erro"; mensagem: string };

export const ESTADO_ENFILEIRAR_DIAGNOSTICO_INICIAL: EstadoEnfileirarDiagnostico = { status: "idle" };
