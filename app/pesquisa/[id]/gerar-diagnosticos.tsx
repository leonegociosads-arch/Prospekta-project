"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  enfileirarDiagnosticosAction,
  ESTADO_ENFILEIRAR_DIAGNOSTICO_INICIAL,
} from "./actions";

export function GerarDiagnosticos({
  searchId,
  progresso,
}: {
  searchId: string;
  progresso: { elegiveis: number; comDiagnostico: number; naFila: number; criterio: string };
}) {
  const router = useRouter();
  const acao = enfileirarDiagnosticosAction.bind(null, searchId);
  const [estado, formAction, pending] = useActionState(
    acao,
    ESTADO_ENFILEIRAR_DIAGNOSTICO_INICIAL,
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Diagnóstico comercial (IA)</p>
          <p className="text-xs text-zinc-500">
            {progresso.comDiagnostico}/{progresso.elegiveis} leads elegíveis com diagnóstico
            {progresso.naFila > 0 ? ` · ${progresso.naFila} na fila` : ""}
          </p>
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending || progresso.elegiveis === 0}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "Enfileirando…" : "Gerar diagnósticos do topo"}
          </button>
        </form>
      </div>

      <p className="text-xs text-zinc-500">
        Elegível: {progresso.criterio}. Só enfileira — deixe <span className="font-mono">npm run worker</span>{" "}
        rodando. Custo por lead: frações de centavo (Gemini Flash). Teto mensal de gasto configurável.
      </p>

      {estado.status === "erro" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {estado.mensagem}
        </p>
      )}

      {estado.status === "ok" && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <p>
            {estado.resultado.enfileirados} enfileirado(s) · {estado.resultado.elegiveis} elegíveis ·{" "}
            {estado.resultado.jaDiagnosticados} já feitos · {estado.resultado.jaTinhamJob} já na fila
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
