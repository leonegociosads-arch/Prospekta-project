// Handler do job "descobrir": roda a descoberta de empresas de uma pesquisa.
//
// Reaproveita executarDescoberta (lib/descoberta/executar.ts) — toda a logica
// de budget/cache/usage/dedup/isolamento por lead ja mora la.

import { executarDescoberta } from "@/lib/descoberta/executar";
import type { Handler } from "../tipos";

export const handlerDescobrir: Handler = async ({ db, job, log }) => {
  if (!job.search_id) {
    throw new Error('job "descobrir" sem search_id');
  }
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY ausente no ambiente do worker");
  }

  const resumo = await executarDescoberta({ db, apiKey }, job.search_id);

  log("descoberta terminou", {
    status: resumo.status,
    encontrados: resumo.encontrados,
    novos: resumo.novos,
    jaExistiam: resumo.jaExistiam,
    fechados: resumo.fechados,
    errosPorLead: resumo.errosPorLead.length,
  });

  // executarDescoberta trata os erros internamente e devolve status "erro"
  // em vez de lancar. Convertemos em excecao para o laco decidir o retry.
  if (resumo.status === "erro") {
    throw new Error(resumo.erro ?? "descoberta falhou sem detalhe");
  }
};
