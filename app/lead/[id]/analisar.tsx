"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { analisarSiteAction } from "./actions";
import { ESTADO_ANALISE_INICIAL } from "./estado";

const ROTULOS: Record<string, string> = {
  ok: "Análise concluída.",
  "sem-site": "Este lead não tem site cadastrado.",
  "bloqueado-ssrf": "A URL do site foi bloqueada por segurança.",
  "site-falhou": "O site não respondeu (registrado no boletim).",
  "pulado-cache": "Análise recente reaproveitada.",
};

export function AnalisarSite({ leadId }: { leadId: string }) {
  const router = useRouter();
  const acao = analisarSiteAction.bind(null, leadId);
  const [estado, formAction, pending] = useActionState(acao, ESTADO_ANALISE_INICIAL);

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Analisando…" : "Analisar agora"}
        </button>
      </form>

      {pending && (
        <p className="text-xs text-muted">
          Baixando a home do site e checando os sinais&hellip; alguns segundos.
        </p>
      )}

      {estado.status === "erro" && (
        <p className="rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">
          {estado.mensagem}
        </p>
      )}

      {estado.status === "ok" && (
        <div className="rounded-xl bg-ok-soft px-3 py-2 text-xs text-ok">
          <p>{ROTULOS[estado.resultado.status] ?? estado.resultado.status}</p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-1 underline underline-offset-2"
          >
            Atualizar o boletim
          </button>
        </div>
      )}
    </div>
  );
}
