"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { enriquecerLeadAction } from "./actions";
import { ESTADO_ENRIQUECIMENTO_INICIAL } from "./estado";

export function EnriquecerLead({ leadId, temPlaceId }: { leadId: string; temPlaceId: boolean }) {
  const router = useRouter();
  const acao = enriquecerLeadAction.bind(null, leadId);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_ENRIQUECIMENTO_INICIAL);

  if (!temPlaceId) {
    return (
      <p className="text-xs text-faint">Sem Google Place ID — enriquecimento indisponível.</p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <label className="flex items-center gap-1.5 text-xs text-muted">
        <input type="checkbox" name="reviews" disabled={pending} className="accent-[color:var(--accent)]" />
        Incluir avaliações recentes (custo maior)
      </label>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Enriquecendo…" : "Enriquecer lead"}
      </button>

      {pending && (
        <p className="text-xs text-muted">Consultando o Google Place Details&hellip;</p>
      )}

      {estado.status === "erro" && (
        <p className="rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">
          {estado.mensagem}
        </p>
      )}

      {estado.status === "ok" && (
        <div className="rounded-xl bg-ok-soft px-3 py-2 text-right text-xs text-ok">
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
