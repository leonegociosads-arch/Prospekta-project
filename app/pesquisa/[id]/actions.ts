"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { executarDescoberta } from "@/lib/descoberta/executar";
import { enfileirarAnalisesDeSite } from "@/lib/analise-site/enfileirar";
import { enfileirarScores } from "@/lib/score/enfileirar";
import { enfileirarAnalisesSociais } from "@/lib/analise-social/enfileirar";
import { enfileirarDetecaoAds } from "@/lib/ads/enfileirar";
import { enfileirarDiagnosticos } from "@/lib/ia/enfileirar";
import type {
  EstadoDescoberta,
  EstadoReprocessar,
  EstadoProcessarLead,
  SelecaoLead,
  AcaoEmLote,
  EstadoLote,
  EstadoEnfileirarDiagnostico,
} from "./estado";

/** Limite de leads por acao em lote, para nao agendar um caminhao de jobs sem querer. */
const MAX_LOTE = 20;

export async function rodarDescobertaAction(
  searchId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura exigida pelo useActionState
  _anterior: EstadoDescoberta,
): Promise<EstadoDescoberta> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { status: "erro", mensagem: "GOOGLE_MAPS_API_KEY nao configurada no servidor." };
  }

  try {
    const db = supabaseServer();
    const resumo = await executarDescoberta({ db, apiKey }, searchId);
    revalidatePath(`/pesquisa/${searchId}`);

    if (resumo.status === "erro") {
      return { status: "erro", mensagem: resumo.erro ?? "Falha na descoberta." };
    }
    return { status: "ok", resumo };
  } catch (e) {
    console.error("[rodarDescoberta] excecao:", e);
    return {
      status: "erro",
      mensagem: "Erro inesperado ao rodar a descoberta. Veja o terminal do servidor.",
    };
  }
}

/**
 * Reagenda site + score + redes de todos os leads da pesquisa que ainda nao
 * tem job aberto. Usado pelo botao "Reprocessar pendentes" - a descoberta ja
 * faz isso sozinha ao terminar (etapa 17); aqui e so para casos de falha.
 */
export async function reprocessarPendentesAction(
  searchId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura exigida pelo useActionState
  _anterior: EstadoReprocessar,
): Promise<EstadoReprocessar> {
  try {
    const db = supabaseServer();
    const [site, score, social] = await Promise.all([
      enfileirarAnalisesDeSite(db, { searchId }),
      enfileirarScores(db, { searchId }),
      enfileirarAnalisesSociais(db, { searchId }),
    ]);
    revalidatePath(`/pesquisa/${searchId}`);
    return {
      status: "ok",
      enfileirados: site.enfileirados + score.enfileirados + social.enfileirados,
    };
  } catch (e) {
    console.error("[reprocessarPendentes] excecao:", e);
    return {
      status: "erro",
      mensagem: "Erro ao reagendar o processamento. Veja o log do servidor.",
    };
  }
}

/**
 * Card do lead: enfileira so o que o usuario marcou, para 1 lead. Nao espera
 * o processamento - o card acompanha pelo GET /lead/[id]/resumo. So o item de
 * IA gera custo (respeitando teto e cache); o resto e analise do proprio codigo.
 */
export async function processarLeadAction(
  leadId: string,
  selecao: SelecaoLead,
): Promise<EstadoProcessarLead> {
  const nada =
    !selecao.site && !selecao.redes && !selecao.anuncio && !selecao.score && !selecao.ia;
  if (nada) return { status: "erro", mensagem: "Marque ao menos um item." };

  try {
    const db = supabaseServer();
    const tarefas: Array<Promise<{ enfileirados: number }>> = [];

    if (selecao.site) tarefas.push(enfileirarAnalisesDeSite(db, { leadIds: [leadId] }));
    if (selecao.redes) tarefas.push(enfileirarAnalisesSociais(db, { leadIds: [leadId] }));
    if (selecao.anuncio) tarefas.push(enfileirarDetecaoAds(db, { leadIds: [leadId] }));
    // a IA precisa do score; garante que ele esta agendado junto
    if (selecao.score || selecao.ia) tarefas.push(enfileirarScores(db, { leadIds: [leadId] }));
    if (selecao.ia) tarefas.push(enfileirarDiagnosticos(db, { leadIds: [leadId], forcar: true }));

    const res = await Promise.all(tarefas);
    return { status: "ok", enfileirados: res.reduce((s, r) => s + r.enfileirados, 0) };
  } catch (e) {
    console.error("[processarLead] excecao:", e);
    return { status: "erro", mensagem: "Erro ao agendar a análise. Veja o log do servidor." };
  }
}

/**
 * Acao em lote da tabela: aplica "reprocessar" (analises gratuitas) ou
 * "diagnostico" (IA, ~US$ 0,01/lead, respeitando teto e cache) aos leads
 * marcados. So enfileira - o worker processa.
 */
export async function processarLeadsEmLoteAction(
  leadIds: string[],
  acao: AcaoEmLote,
): Promise<EstadoLote> {
  const ids = [...new Set(leadIds)].filter((id) => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return { status: "erro", mensagem: "Nenhum lead selecionado." };
  if (ids.length > MAX_LOTE) {
    return { status: "erro", mensagem: `Selecione no máximo ${MAX_LOTE} leads por vez.` };
  }

  try {
    const db = supabaseServer();
    let enfileirados = 0;

    if (acao === "reprocessar") {
      const res = await Promise.all([
        enfileirarAnalisesDeSite(db, { leadIds: ids }),
        enfileirarScores(db, { leadIds: ids }),
        enfileirarAnalisesSociais(db, { leadIds: ids }),
        enfileirarDetecaoAds(db, { leadIds: ids }),
      ]);
      enfileirados = res.reduce((s, r) => s + r.enfileirados, 0);
    } else {
      // diagnostico: garante o score e pede a IA (sem filtro de elegibilidade)
      const [score, ia] = await Promise.all([
        enfileirarScores(db, { leadIds: ids }),
        enfileirarDiagnosticos(db, { leadIds: ids, forcar: true }),
      ]);
      enfileirados = score.enfileirados + ia.enfileirados;
    }

    return { status: "ok", enfileirados, leads: ids.length };
  } catch (e) {
    console.error("[processarLeadsEmLote] excecao:", e);
    return { status: "erro", mensagem: "Erro ao agendar as tarefas. Veja o log do servidor." };
  }
}

export async function enfileirarDiagnosticosAction(
  searchId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura exigida pelo useActionState
  _anterior: EstadoEnfileirarDiagnostico,
): Promise<EstadoEnfileirarDiagnostico> {
  try {
    const db = supabaseServer();
    const resultado = await enfileirarDiagnosticos(db, { searchId });
    revalidatePath(`/pesquisa/${searchId}`);
    return { status: "ok", resultado };
  } catch (e) {
    console.error("[enfileirarDiagnosticos] excecao:", e);
    return {
      status: "erro",
      mensagem: "Erro inesperado ao enfileirar os diagnosticos. Veja o terminal do servidor.",
    };
  }
}
