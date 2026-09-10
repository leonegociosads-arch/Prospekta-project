"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { enfileirarDiagnosticosAction } from "./actions";
import { ESTADO_ENFILEIRAR_DIAGNOSTICO_INICIAL } from "./estado";

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
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden="true" className="grid size-7 place-items-center rounded-xl bg-info-soft text-sm">✨</span>
            Diagnóstico comercial (IA)
          </p>
          <p className="mt-1 text-xs text-muted">
            {progresso.comDiagnostico}/{progresso.elegiveis} leads elegíveis com diagnóstico
            {progresso.naFila > 0 ? ` · ${progresso.naFila} na fila` : ""}
          </p>
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending || progresso.elegiveis === 0}
            className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Enfileirando…" : "Gerar diagnósticos do topo"}
          </button>
        </form>
      </div>

      <p className="text-xs text-muted">
        Elegível: {progresso.criterio}. Só enfileira — deixe <span className="font-mono">npm run worker</span>{" "}
        rodando. Custo por lead: frações de centavo (Gemini Flash). Teto mensal de gasto configurável.
      </p>

      {estado.status === "erro" && (
        <p className="rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">
          {estado.mensagem}
        </p>
      )}

      {estado.status === "ok" && (
        <div className="rounded-xl bg-ok-soft px-3 py-2 text-xs text-ok">
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
