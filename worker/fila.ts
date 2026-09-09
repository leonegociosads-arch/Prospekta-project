// Operacoes de fila: reivindicar, concluir, tratar falha, recuperar travados.
//
// Todas recebem um SupabaseClient pronto (nao importam lib/supabase/server,
// para poderem rodar tambem fora do Next, via script).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "@/lib/db-types";

/** espera antes de tentar de novo um job que falhou: 30s, 60s, 120s... ate um teto */
export function calcularBackoffMs(
  tentativas: number,
  baseMs = 30_000,
  tetoMs = 15 * 60_000,
): number {
  const expo = baseMs * 2 ** Math.max(0, tentativas - 1);
  return Math.min(expo, tetoMs);
}

/**
 * Reivindica o proximo job da fila de forma ATOMICA (funcao SQL da migration
 * 0006). Marca 'rodando' e incrementa `tentativas`. Retorna o job ou null se
 * a fila estiver vazia.
 */
export async function reivindicarProximoJob(db: SupabaseClient): Promise<Job | null> {
  const { data, error } = await db.rpc("reivindicar_proximo_job");
  if (error) {
    if (/reivindicar_proximo_job|does not exist|not find|schema cache/i.test(error.message)) {
      throw new Error(
        `A funcao SQL reivindicar_proximo_job() nao existe. ` +
          `Aplique a migration supabase/migrations/0006_worker_fila.sql no SQL Editor do Supabase. ` +
          `(erro original: ${error.message})`,
      );
    }
    throw new Error(`rpc reivindicar_proximo_job: ${error.message}`);
  }
  const linhas = (data ?? []) as Job[];
  return linhas[0] ?? null;
}

/** marca um job como concluido com sucesso */
export async function concluirJob(db: SupabaseClient, jobId: string): Promise<void> {
  const { error } = await db
    .from("jobs")
    .update({ status: "feito", ultimo_erro: null, atualizado_em: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw new Error(`concluirJob(${jobId}): ${error.message}`);
}

export type ResultadoFalha = "reagendado" | "esgotado";

/**
 * Registra a falha de um job.
 *  - ainda ha tentativas (`tentativas` < `max_tentativas`): volta para 'pendente'
 *    com `agendado_para` no futuro (backoff). Sera reprocessado depois.
 *  - tentativas esgotadas: status 'erro' definitivo. NAO tenta mais — e assim
 *    que o worker "nunca fica tentando infinitamente".
 *
 * `job.tentativas` aqui ja vem incrementado (a reivindicacao somou 1).
 */
export async function registrarResultadoFalha(
  db: SupabaseClient,
  job: Pick<Job, "id" | "tentativas" | "max_tentativas">,
  mensagemErro: string,
  opts: { baseMs?: number; tetoMs?: number; agora?: () => number } = {},
): Promise<ResultadoFalha> {
  const agora = opts.agora ? opts.agora() : Date.now();
  const erro = mensagemErro.slice(0, 2000);

  if (job.tentativas >= job.max_tentativas) {
    const { error } = await db
      .from("jobs")
      .update({ status: "erro", ultimo_erro: erro, atualizado_em: new Date(agora).toISOString() })
      .eq("id", job.id);
    if (error) throw new Error(`registrarResultadoFalha/esgotado(${job.id}): ${error.message}`);
    return "esgotado";
  }

  const espera = calcularBackoffMs(job.tentativas, opts.baseMs, opts.tetoMs);
  const { error } = await db
    .from("jobs")
    .update({
      status: "pendente",
      ultimo_erro: erro,
      agendado_para: new Date(agora + espera).toISOString(),
      atualizado_em: new Date(agora).toISOString(),
    })
    .eq("id", job.id);
  if (error) throw new Error(`registrarResultadoFalha/reagendado(${job.id}): ${error.message}`);
  return "reagendado";
}

/** marca um job como erro definitivo, sem retry (ex.: tipo desconhecido) */
export async function falharJobDefinitivo(
  db: SupabaseClient,
  jobId: string,
  mensagemErro: string,
): Promise<void> {
  const { error } = await db
    .from("jobs")
    .update({
      status: "erro",
      ultimo_erro: mensagemErro.slice(0, 2000),
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) throw new Error(`falharJobDefinitivo(${jobId}): ${error.message}`);
}

/**
 * Reenfileira jobs que ficaram presos em 'rodando' (worker morto abruptamente,
 * sem chance de tratar). So mexe nos que estao parados ha mais de `limiteMinutos`,
 * para nao roubar um job de um worker que ainda esta trabalhando nele.
 * Retorna quantos foram recuperados.
 */
export async function recuperarJobsTravados(
  db: SupabaseClient,
  limiteMinutos = 15,
): Promise<number> {
  const corte = new Date(Date.now() - limiteMinutos * 60_000).toISOString();
  const { data, error } = await db
    .from("jobs")
    .update({
      status: "pendente",
      ultimo_erro: "worker anterior encerrou sem concluir; reenfileirado",
      atualizado_em: new Date().toISOString(),
    })
    .eq("status", "rodando")
    .lt("atualizado_em", corte)
    .select("id");
  if (error) throw new Error(`recuperarJobsTravados: ${error.message}`);
  return (data ?? []).length;
}
