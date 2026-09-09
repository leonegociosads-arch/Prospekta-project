"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { diagnosticarLeadAction, ESTADO_DIAGNOSTICO_INICIAL } from "./actions";

export function GerarDiagnostico({ leadId, temScore }: { leadId: string; temScore: boolean }) {
  const router = useRouter();
  const acao = diagnosticarLeadAction.bind(null, leadId);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_DIAGNOSTICO_INICIAL);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending || !temScore}
          title={temScore ? undefined : "Calcule o score primeiro"}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {pending ? "Consultando IA…" : "Gerar diagnóstico (IA)"}
        </button>
      </form>

      {pending && <p className="text-xs text-zinc-500">Uma chamada ao modelo — custa frações de centavo.</p>}

      {estado.status === "erro" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {estado.mensagem}
        </p>
      )}

      {estado.status === "ok" && (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="text-xs text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
        >
          {estado.resultado.status === "cache"
            ? "diagnóstico em cache"
            : estado.resultado.status === "erro-modelo"
              ? "modelo não retornou algo aproveitável"
              : estado.resultado.status === "nao-elegivel"
                ? "lead fora do critério"
                : `pronto · ${(estado.resultado.tokensEntrada ?? 0) + (estado.resultado.tokensSaida ?? 0)} tokens · US$ ${estado.resultado.custoUsd.toFixed(5)}`}{" "}
          — atualizar
        </button>
      )}
    </div>
  );
}
