"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Cartao, SecaoHeader } from "@/components/ui";
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
    <Cartao className="flex flex-col gap-3">
      <SecaoHeader
        icone="✨"
        tom="info"
        titulo="Diagnóstico comercial (IA)"
        subtitulo={`${progresso.comDiagnostico}/${progresso.elegiveis} leads elegíveis com diagnóstico${
          progresso.naFila > 0 ? ` · ${progresso.naFila} na fila` : ""
        }`}
        acao={
          <form action={formAction}>
            <button
              type="submit"
              disabled={pending || progresso.elegiveis === 0}
              className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Enfileirando…" : "Gerar diagnósticos do topo"}
            </button>
          </form>
        }
      />

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
    </Cartao>
  );
}
