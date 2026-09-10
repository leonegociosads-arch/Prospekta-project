"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { detectarAdsAction } from "./actions";
import { ESTADO_ADS_INICIAL } from "./estado";

export function DetectarAds({ leadId }: { leadId: string }) {
  const router = useRouter();
  const acao = detectarAdsAction.bind(null, leadId);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_ADS_INICIAL);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {pending ? "Verificando…" : "Detectar anúncios"}
        </button>
      </form>

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
          {estado.resultado.veredito ?? "sem veredito"} · atualizar
        </button>
      )}
    </div>
  );
}
