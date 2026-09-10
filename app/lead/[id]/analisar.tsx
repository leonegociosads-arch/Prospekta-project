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
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Analisando…" : "Analisar agora"}
        </button>
      </form>

      {pending && (
        <p className="text-xs text-zinc-500">
          Baixando a home do site e checando os sinais&hellip; alguns segundos.
        </p>
      )}

      {estado.status === "erro" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {estado.mensagem}
        </p>
      )}

      {estado.status === "ok" && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
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
