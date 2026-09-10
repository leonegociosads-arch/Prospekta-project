"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { rodarDescobertaAction } from "./actions";
import { ESTADO_DESCOBERTA_INICIAL } from "./estado";

export function RodarDescoberta({ searchId, jobStatus }: { searchId: string; jobStatus: string | null }) {
  const router = useRouter();
  const acao = rodarDescobertaAction.bind(null, searchId);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_DESCOBERTA_INICIAL);

  const jaRodou = jobStatus === "feito" || estado.status === "ok";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden="true" className="grid size-7 place-items-center rounded-xl bg-info-soft text-sm">📡</span>
            Descoberta de empresas
          </p>
          <p className="mt-1 text-xs text-muted">
            Faz 1 busca no Google Places (ate 2 chamadas com a geocodificacao).
          </p>
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Buscando…" : jaRodou ? "Rodar de novo" : "Rodar descoberta"}
          </button>
        </form>
      </div>

      {pending && (
        <p className="text-xs text-muted">
          Chamando o Google e gravando os leads&hellip; isso leva alguns segundos.
        </p>
      )}

      {estado.status === "erro" && (
        <p className="rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">
          {estado.mensagem}
        </p>
      )}

      {estado.status === "ok" && estado.resumo.aviso && (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">
          {estado.resumo.aviso}
        </p>
      )}

      {estado.status === "ok" && (
        <div className="rounded-xl bg-ok-soft px-3 py-2 text-xs text-ok">
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
