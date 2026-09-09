"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { enriquecerLeadAction, ESTADO_ENRIQUECIMENTO_INICIAL } from "./actions";

export function EnriquecerLead({ leadId, temPlaceId }: { leadId: string; temPlaceId: boolean }) {
  const router = useRouter();
  const acao = enriquecerLeadAction.bind(null, leadId);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_ENRIQUECIMENTO_INICIAL);

  if (!temPlaceId) {
    return (
      <p className="text-xs text-zinc-400">Sem Google Place ID — enriquecimento indisponível.</p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <label className="flex items-center gap-1.5 text-xs text-zinc-500">
        <input type="checkbox" name="reviews" disabled={pending} className="accent-zinc-700" />
        Incluir avaliações recentes (custo maior)
      </label>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Enriquecendo…" : "Enriquecer lead"}
      </button>

      {pending && (
        <p className="text-xs text-zinc-500">Consultando o Google Place Details&hellip;</p>
      )}

      {estado.status === "erro" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {estado.mensagem}
        </p>
      )}

      {estado.status === "ok" && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-right text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {estado.resultado.fonte === "cache" ? (
            <p>Já estava em cache (dentro do TTL) — nenhuma chamada ao Google.</p>
          ) : (
            <p>
              Dados do Google Place Details{estado.resultado.incluiuReviews ? " (com avaliações)" : ""} ·
              uso registrado.
            </p>
          )}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-1 underline underline-offset-2"
          >
            Atualizar a página
          </button>
        </div>
      )}
    </form>
  );
}
