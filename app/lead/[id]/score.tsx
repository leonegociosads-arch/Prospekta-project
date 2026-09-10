"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { calcularScoreAction } from "./actions";
import { ESTADO_SCORE_INICIAL } from "./estado";

export function RecalcularScore({ leadId }: { leadId: string }) {
  const router = useRouter();
  const acao = calcularScoreAction.bind(null, leadId);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_SCORE_INICIAL);

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {pending ? "Calculando…" : "Recalcular score"}
        </button>
      </form>

      {estado.status === "erro" && (
        <p className="text-xs text-red-600 dark:text-red-400">{estado.mensagem}</p>
      )}
      {estado.status === "ok" && (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="text-xs text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
        >
          Score {estado.total} — atualizar a página
        </button>
      )}
    </div>
  );
}
