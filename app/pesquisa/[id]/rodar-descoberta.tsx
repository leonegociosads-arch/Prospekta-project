"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  rodarDescobertaAction,
  ESTADO_DESCOBERTA_INICIAL,
} from "./actions";

export function RodarDescoberta({ searchId, jobStatus }: { searchId: string; jobStatus: string | null }) {
  const router = useRouter();
  const acao = rodarDescobertaAction.bind(null, searchId);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_DESCOBERTA_INICIAL);

  const jaRodou = jobStatus === "feito" || estado.status === "ok";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Descoberta de empresas</p>
          <p className="text-xs text-zinc-500">
            Faz 1 busca no Google Places (ate 2 chamadas com a geocodificacao).
          </p>
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "Buscando…" : jaRodou ? "Rodar de novo" : "Rodar descoberta"}
          </button>
        </form>
      </div>

      {pending && (
        <p className="text-xs text-zinc-500">
          Chamando o Google e gravando os leads&hellip; isso leva alguns segundos.
        </p>
      )}

      {estado.status === "erro" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {estado.mensagem}
        </p>
      )}

      {estado.status === "ok" && estado.resumo.aviso && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {estado.resumo.aviso}
        </p>
      )}

      {estado.status === "ok" && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {estado.resumo.status === "zero-resultados" ? (
            <p>Nenhuma empresa encontrada para esse nicho/regiao/raio.</p>
          ) : (
            <p>
              {estado.resumo.encontrados} encontradas · {estado.resumo.novos} novas ·{" "}
              {estado.resumo.jaExistiam} ja existiam
              {estado.resumo.fechados > 0 ? ` · ${estado.resumo.fechados} fechadas` : ""}
              {estado.resumo.errosPorLead.length > 0
                ? ` · ${estado.resumo.errosPorLead.length} com erro`
                : ""}
            </p>
          )}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-1 underline underline-offset-2"
          >
            Atualizar a lista
          </button>
        </div>
      )}
    </div>
  );
}
