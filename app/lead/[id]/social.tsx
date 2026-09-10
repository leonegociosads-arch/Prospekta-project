"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { analisarSocialAction } from "./actions";
import { ESTADO_SOCIAL_INICIAL } from "./estado";

export function AnalisarRedes({ leadId }: { leadId: string }) {
  const router = useRouter();
  const acao = analisarSocialAction.bind(null, leadId);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_SOCIAL_INICIAL);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-medium transition-colors hover:bg-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Checando…" : "Analisar redes"}
        </button>
      </form>

      {pending && <p className="text-xs text-muted">Instagram/Facebook costumam bloquear&hellip;</p>}

      {estado.status === "erro" && (
        <p className="rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">
          {estado.mensagem}
        </p>
      )}

      {estado.status === "ok" && (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="text-xs text-ok underline underline-offset-2"
        >
          {estado.resultado.plataformas.map((p) => `${p.plataforma}: ${p.status}`).join(" · ")} —
          atualizar
        </button>
      )}
    </div>
  );
}
