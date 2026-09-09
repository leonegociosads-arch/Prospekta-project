"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { enfileirarAnalisesAction, ESTADO_ENFILEIRAR_INICIAL } from "./actions";

export function AnalisarSites({
  searchId,
  progresso,
}: {
  searchId: string;
  progresso: { comSite: number; analisados: number; naFila: number };
}) {
  const router = useRouter();
  const acao = enfileirarAnalisesAction.bind(null, searchId);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_ENFILEIRAR_INICIAL);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Análise técnica dos sites</p>
          <p className="text-xs text-zinc-500">
            {progresso.analisados}/{progresso.comSite} sites analisados
            {progresso.naFila > 0 ? ` · ${progresso.naFila} na fila` : ""}
          </p>
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending || progresso.comSite === 0}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "Enfileirando…" : "Analisar sites dos leads"}
          </button>
        </form>
      </div>

      <p className="text-xs text-zinc-500">
        Isto só enfileira os jobs. Deixe <span className="font-mono">npm run worker</span> rodando
        para processá-los.
      </p>

      {estado.status === "erro" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {estado.mensagem}
        </p>
      )}

      {estado.status === "ok" && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <p>
            {estado.resultado.enfileirados} enfileirado(s) ·{" "}
            {estado.resultado.jaTinhamJob} já na fila · {estado.resultado.semSite} sem site
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
