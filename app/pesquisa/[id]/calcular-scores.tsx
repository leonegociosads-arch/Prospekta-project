"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { enfileirarScoresAction } from "./actions";
import { ESTADO_ENFILEIRAR_SCORE_INICIAL } from "./estado";

export function CalcularScores({
  searchId,
  progresso,
}: {
  searchId: string;
  progresso: { total: number; comScore: number; naFila: number };
}) {
  const router = useRouter();
  const acao = enfileirarScoresAction.bind(null, searchId);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_ENFILEIRAR_SCORE_INICIAL);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Score de Oportunidade</p>
          <p className="text-xs text-zinc-500">
            {progresso.comScore}/{progresso.total} leads pontuados
            {progresso.naFila > 0 ? ` · ${progresso.naFila} na fila` : ""}
          </p>
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending || progresso.total === 0}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "Enfileirando…" : "Calcular scores dos leads"}
          </button>
        </form>
      </div>

      <p className="text-xs text-zinc-500">
        Só enfileira. Deixe <span className="font-mono">npm run worker</span> rodando. O score também
        é recalculado sozinho quando o site de um lead é analisado.
      </p>

      {estado.status === "erro" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {estado.mensagem}
        </p>
      )}

      {estado.status === "ok" && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <p>
            {estado.resultado.enfileirados} enfileirado(s) · {estado.resultado.jaTinhamJob} já na fila
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-1 underline underline-offset-2"
          >
            Atualizar
          </button>
        </div>
      )}
    </div>
  );
}
