"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProgressoPesquisa } from "@/lib/leads/progresso";
import { reprocessarPendentesAction } from "./actions";
import { ESTADO_REPROCESSAR_INICIAL } from "./estado";

const INTERVALO_MS = 4000;
const MAX_ATUALIZACOES = 90; // ~6 min de auto-atualizacao, depois para sozinho

export function Progresso({
  searchId,
  progresso,
}: {
  searchId: string;
  progresso: ProgressoPesquisa;
}) {
  const router = useRouter();
  const [autoParou, setAutoParou] = useState(false);
  const contador = useRef(0);
  const acao = reprocessarPendentesAction.bind(null, searchId);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_REPROCESSAR_INICIAL);

  // Enquanto ha tarefas na fila, atualiza a pagina sozinha para mostrar o
  // worker avancando. Para quando a fila zera ou depois do limite de tempo.
  useEffect(() => {
    if (progresso.naFila === 0 || autoParou) return;
    const t = setInterval(() => {
      contador.current += 1;
      if (contador.current > MAX_ATUALIZACOES) {
        setAutoParou(true);
        return;
      }
      router.refresh();
    }, INTERVALO_MS);
    return () => clearInterval(t);
  }, [progresso.naFila, autoParou, router]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Processamento dos leads</p>
          <p className="text-xs text-zinc-500">
            {progresso.concluido ? (
              "Tudo processado."
            ) : progresso.naFila > 0 ? (
              <>
                {progresso.naFila} tarefa(s) na fila. Deixe{" "}
                <span className="font-mono">npm run worker</span> rodando no seu PC.
              </>
            ) : (
              "Alguns leads ainda não foram processados."
            )}
          </p>
        </div>
        {!progresso.concluido && (
          <form action={formAction}>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {pending ? "Reagendando…" : "Reprocessar pendentes"}
            </button>
          </form>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {progresso.etapas.map((e) => {
          const pct = e.total === 0 ? 100 : Math.round((e.feito / e.total) * 100);
          return (
            <li key={e.rotulo} className="flex items-center gap-3 text-xs">
              <span className="w-32 shrink-0 text-zinc-600 dark:text-zinc-300">{e.rotulo}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right tabular-nums text-zinc-500">
                {e.total === 0 ? "—" : `${e.feito}/${e.total}`}
              </span>
            </li>
          );
        })}
      </ul>

      {progresso.naFila > 0 && !autoParou && (
        <p className="text-xs text-zinc-400">
          Esta página se atualiza sozinha enquanto há tarefas na fila.
        </p>
      )}
      {autoParou && (
        <button
          type="button"
          onClick={() => {
            setAutoParou(false);
            contador.current = 0;
            router.refresh();
          }}
          className="self-start text-xs text-zinc-500 underline underline-offset-2"
        >
          Retomar atualização automática
        </button>
      )}

      {estado.status === "erro" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {estado.mensagem}
        </p>
      )}
      {estado.status === "ok" && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {estado.enfileirados} tarefa(s) reagendada(s).
        </p>
      )}
    </div>
  );
}
