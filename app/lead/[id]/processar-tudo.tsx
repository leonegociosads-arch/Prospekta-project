"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { botaoClasses } from "@/components/ui";
import { processarTudoAction } from "./actions";
import { ESTADO_PROCESSAR_TUDO_INICIAL } from "./estado";

/**
 * Etapa 23: 1 botão só. Substitui "clicar em cada tópico" - roda site, score,
 * redes, anúncios e o dossiê da IA num pedido só e recarrega a página com o
 * resultado. Os controles individuais continuam existindo em "Detalhes
 * técnicos", para reprocessar 1 coisa isolada quando precisar.
 */
export function ProcessarTudo({ leadId, jaTemDossie }: { leadId: string; jaTemDossie: boolean }) {
  const router = useRouter();
  const acao = processarTudoAction.bind(null, leadId);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_PROCESSAR_TUDO_INICIAL);
  const ultimoAtualizado = useRef(estado);

  // ao terminar (sucesso ou erro), atualiza a pagina para mostrar os dados novos
  useEffect(() => {
    if (estado !== ultimoAtualizado.current) {
      ultimoAtualizado.current = estado;
      if (estado.status !== "idle") router.refresh();
    }
  }, [estado, router]);

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <button type="submit" disabled={pending} className={botaoClasses("primario", "md")}>
          {pending ? (
            <>
              <span
                aria-hidden="true"
                className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
              Analisando tudo…
            </>
          ) : jaTemDossie ? (
            "Refazer diagnóstico completo"
          ) : (
            "Fazer diagnóstico completo"
          )}
        </button>
      </form>

      {pending && (
        <p className="text-xs text-muted">
          Site, score, redes, anúncios e o dossiê da IA — direto no servidor, sem precisar do
          worker. Leva de alguns segundos a cerca de 1 minuto.
        </p>
      )}

      {estado.status === "erro" && (
        <p className="rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">{estado.mensagem}</p>
      )}
      {estado.status === "ok" && estado.avisoIa && (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">{estado.avisoIa}</p>
      )}
    </div>
  );
}
