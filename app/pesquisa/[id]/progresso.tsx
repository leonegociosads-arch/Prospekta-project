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
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden="true" className="grid size-7 place-items-center rounded-xl bg-soft text-sm">⚙️</span>
            Processamento dos leads
          </p>
          <p className="mt-1 text-xs text-muted">
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
              className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-medium hover:bg-soft disabled:opacity-60"
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
              <span className="w-32 shrink-0 text-muted">{e.rotulo}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right tabular-nums text-muted">
                {e.total === 0 ? "—" : `${e.feito}/${e.total}`}
              </span>
            </li>
          );
        })}
      </ul>

      {progresso.naFila > 0 && !autoParou && (
        <p className="text-xs text-faint">
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
          className="self-start text-xs text-muted underline underline-offset-2"
        >
          Retomar atualização automática
        </button>
      )}

      {estado.status === "erro" && (
        <p className="rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">
          {estado.mensagem}
        </p>
      )}
      {estado.status === "ok" && (
        <p className="rounded-xl bg-ok-soft px-3 py-2 text-xs text-ok">
          {estado.enfileirados} tarefa(s) reagendada(s).
        </p>
      )}
    </div>
  );
}
