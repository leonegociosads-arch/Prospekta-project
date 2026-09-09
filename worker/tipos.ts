// Tipos do worker.
//
// Um "handler" e a funcao que sabe executar UM tipo de job (ex.: "descobrir").
// O laco do worker (loop.ts) nao conhece nenhum tipo especifico — ele so
// consulta o REGISTRO (registro.ts) e chama o handler certo.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "@/lib/db-types";

export type { Job };

export type ContextoJob = {
  db: SupabaseClient;
  job: Job;
  /** log com tags legiveis; ver worker/log.ts */
  log: (evento: string, campos?: Record<string, string | number | undefined>) => void;
};

/**
 * Executa a tarefa.
 *  - retorna normalmente  -> o laco marca o job como 'feito'
 *  - lanca um erro        -> o laco decide: reagendar (retry) ou desistir ('erro')
 *
 * O handler NAO deve mexer no status do job na tabela `jobs` — isso e
 * responsabilidade do laco. (excecao historica: o handler "descobrir"
 * chama executarDescoberta, que ainda escreve o proprio status; o laco
 * escreve o estado final por ultimo e prevalece.)
 */
export type Handler = (ctx: ContextoJob) => Promise<void>;

/** mapa: tipo do job -> handler que o executa */
export type RegistroDeHandlers = Record<string, Handler>;
