// Laco principal do worker.
//
// Recebe tudo por parametro (db, registro de handlers, sinal de parada, opcoes)
// para poder ser testado sem banco real e sem internet.
//
// Regras:
//  - pega 1 job por vez, de forma atomica (reivindicarProximoJob);
//  - executa o handler do tipo; sucesso -> 'feito'; erro -> retry com backoff
//    ate `max_tentativas`, depois 'erro' definitivo;
//  - tipo sem handler -> 'erro' na hora (retry nao adiantaria);
//  - a falha de um job NUNCA derruba o laco: segue para o proximo;
//  - encerramento gracioso: ao ver `sinal.parar`, termina o job atual e sai
//    (nao aborta um job no meio).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job, RegistroDeHandlers } from "./tipos";
import {
  concluirJob,
  falharJobDefinitivo,
  recuperarJobsTravados,
  registrarResultadoFalha,
  reivindicarProximoJob,
} from "./fila";
import { criarLog, curto, type CamposLog } from "./log";

export type SinalParada = { parar: boolean };

export type OpcoesWorker = {
  db: SupabaseClient;
  registro: RegistroDeHandlers;
  /** objeto mutavel; quando `.parar` vira true, o laco encerra apos o job atual */
  sinal: SinalParada;
  /** processa a fila ate esvaziar e entao sai (nao fica em espera) */
  once?: boolean;
  /** limite duro de jobs nesta execucao (protecao extra contra laco sem fim) */
  maxJobs?: number;
  /** espera quando a fila esta vazia e nao e `once` (default 5000ms) */
  intervaloOciosoMs?: number;
  backoffBaseMs?: number;
  backoffTetoMs?: number;
  /** recupera jobs presos em 'rodando' ha mais de X min, no inicio. null = nao recupera */
  recuperarTravadosMin?: number | null;
  /** injetaveis para teste */
  log?: (evento: string, campos?: CamposLog) => void;
  dormir?: (ms: number, sinal: SinalParada) => Promise<void>;
  agora?: () => number;
};

export type ResumoWorker = {
  processados: number;
  feitos: number;
  reagendados: number;
  esgotados: number;
  ignorados: number; // tipo desconhecido
};

async function dormirInterrompivel(ms: number, sinal: SinalParada): Promise<void> {
  const passo = 200;
  let restante = ms;
  while (restante > 0 && !sinal.parar) {
    await new Promise((r) => setTimeout(r, Math.min(passo, restante)));
    restante -= passo;
  }
}

export async function rodarWorker(opts: OpcoesWorker): Promise<ResumoWorker> {
  const {
    db,
    registro,
    sinal,
    once = false,
    maxJobs = Infinity,
    intervaloOciosoMs = 5_000,
    recuperarTravadosMin = null,
    backoffBaseMs,
    backoffTetoMs,
  } = opts;
  const log = opts.log ?? criarLog();
  const dormir = opts.dormir ?? dormirInterrompivel;
  const agora = opts.agora ?? Date.now;

  const resumo: ResumoWorker = {
    processados: 0,
    feitos: 0,
    reagendados: 0,
    esgotados: 0,
    ignorados: 0,
  };

  if (recuperarTravadosMin != null) {
    const n = await recuperarJobsTravados(db, recuperarTravadosMin);
    if (n > 0) log("jobs travados reenfileirados", { qtd: n });
  }

  while (!sinal.parar && resumo.processados < maxJobs) {
    let job: Job | null = null;
    try {
      job = await reivindicarProximoJob(db);
    } catch (e) {
      // erro ao FALAR com a fila (rede/config). Nao trava: espera e tenta de novo,
      // a menos que seja --once (ai sai).
      log("falha ao reivindicar job", { erro: msg(e) });
      if (once) break;
      await dormir(intervaloOciosoMs, sinal);
      continue;
    }

    if (!job) {
      if (once) break;
      await dormir(intervaloOciosoMs, sinal);
      continue;
    }

    resumo.processados++;
    const tags: CamposLog = {
      job: curto(job.id),
      tipo: job.tipo,
      search: curto(job.search_id),
      lead: curto(job.lead_id),
    };
    const inicio = agora();

    const handler = registro[job.tipo];
    if (!handler) {
      await falharJobDefinitivo(db, job.id, `tipo de job desconhecido: "${job.tipo}"`);
      resumo.ignorados++;
      log("job ignorado", { ...tags, resultado: "erro", erro: "tipo desconhecido" });
      continue;
    }

    try {
      await handler({ db, job, log });
      await concluirJob(db, job.id);
      resumo.feitos++;
      log("job concluido", { ...tags, resultado: "feito", duracao: `${agora() - inicio}ms` });
    } catch (e) {
      const r = await registrarResultadoFalha(db, job, msg(e), {
        baseMs: backoffBaseMs,
        tetoMs: backoffTetoMs,
        agora,
      });
      if (r === "reagendado") resumo.reagendados++;
      else resumo.esgotados++;
      log("job falhou", {
        ...tags,
        resultado: r === "reagendado" ? "reagendado" : "erro",
        duracao: `${agora() - inicio}ms`,
        erro: msg(e),
        tentativas: `${job.tentativas}/${job.max_tentativas}`,
      });
    }
  }

  if (sinal.parar) log("encerrando (sinal de parada)", { ...resumoTags(resumo) });
  return resumo;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function resumoTags(r: ResumoWorker): CamposLog {
  return {
    processados: r.processados,
    feitos: r.feitos,
    reagendados: r.reagendados,
    esgotados: r.esgotados,
    ignorados: r.ignorados,
  };
}
