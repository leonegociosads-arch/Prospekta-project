"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { processarTudoAction } from "./actions";
import { ESTADO_PROCESSAR_TUDO_INICIAL } from "./estado";

/**
 * Botão principal do dossiê: roda site + score + redes + anúncios + IA num
 * pedido só (sem fila, sem worker) e recarrega a página com o resultado.
 * Os controles individuais continuam em "Detalhes técnicos".
 */
export function ProcessarTudo({ leadId, jaTemDossie }: { leadId: string; jaTemDossie: boolean }) {
  const router = useRouter();
  const acao = processarTudoAction.bind(null, leadId);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_PROCESSAR_TUDO_INICIAL);
  const ultimo = useRef(estado);

  // ao terminar, atualiza a pagina para mostrar os dados novos
  useEffect(() => {
    if (estado !== ultimo.current) {
      ultimo.current = estado;
      if (estado.status !== "idle") router.refresh();
    }
  }, [estado, router]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <>
              <span
                aria-hidden="true"
                className="size-3 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
              Analisando…
            </>
          ) : jaTemDossie ? (
            "Refazer análise"
          ) : (
            "Fazer diagnóstico completo"
          )}
        </button>
      </form>

      {pending && (
        <span className="text-[11.5px] text-muted">
          site · score · redes · anúncios · IA — pode levar até 1 minuto
        </span>
      )}
      {estado.status === "erro" && (
        <span className="rounded-lg bg-bad-soft px-2.5 py-1 text-[11.5px] text-bad">
          {estado.mensagem}
        </span>
      )}
      {estado.status === "ok" && estado.avisoIa && (
        <span className="rounded-lg bg-warn-soft px-2.5 py-1 text-[11.5px] text-warn">
          {estado.avisoIa}
        </span>
      )}
    </div>
  );
}
