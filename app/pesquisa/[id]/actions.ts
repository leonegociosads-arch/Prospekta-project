"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { executarDescoberta, type ResumoDescoberta } from "@/lib/descoberta/executar";
import { enfileirarAnalisesDeSite, type ResultadoEnfileirar } from "@/lib/analise-site/enfileirar";
import { enfileirarScores, type ResultadoEnfileirarScore } from "@/lib/score/enfileirar";
import {
  enfileirarDiagnosticos,
  type ResultadoEnfileirarDiagnostico,
} from "@/lib/ia/enfileirar";

export type EstadoDescoberta =
  | { status: "idle" }
  | { status: "ok"; resumo: ResumoDescoberta }
  | { status: "erro"; mensagem: string };

export const ESTADO_DESCOBERTA_INICIAL: EstadoDescoberta = { status: "idle" };

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

export type EstadoEnfileirar =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoEnfileirar }
  | { status: "erro"; mensagem: string };

export const ESTADO_ENFILEIRAR_INICIAL: EstadoEnfileirar = { status: "idle" };

export async function enfileirarAnalisesAction(
  searchId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura exigida pelo useActionState
  _anterior: EstadoEnfileirar,
): Promise<EstadoEnfileirar> {
  try {
    const db = supabaseServer();
    const resultado = await enfileirarAnalisesDeSite(db, { searchId });
    revalidatePath(`/pesquisa/${searchId}`);
    return { status: "ok", resultado };
  } catch (e) {
    console.error("[enfileirarAnalises] excecao:", e);
    return {
      status: "erro",
      mensagem: "Erro inesperado ao enfileirar as analises. Veja o terminal do servidor.",
    };
  }
}

export type EstadoEnfileirarScore =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoEnfileirarScore }
  | { status: "erro"; mensagem: string };

export const ESTADO_ENFILEIRAR_SCORE_INICIAL: EstadoEnfileirarScore = { status: "idle" };

export async function enfileirarScoresAction(
  searchId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura exigida pelo useActionState
  _anterior: EstadoEnfileirarScore,
): Promise<EstadoEnfileirarScore> {
  try {
    const db = supabaseServer();
    const resultado = await enfileirarScores(db, { searchId });
    revalidatePath(`/pesquisa/${searchId}`);
    return { status: "ok", resultado };
  } catch (e) {
    console.error("[enfileirarScores] excecao:", e);
    return {
      status: "erro",
      mensagem: "Erro inesperado ao enfileirar os scores. Veja o terminal do servidor.",
    };
  }
}

export type EstadoEnfileirarDiagnostico =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoEnfileirarDiagnostico }
  | { status: "erro"; mensagem: string };

export const ESTADO_ENFILEIRAR_DIAGNOSTICO_INICIAL: EstadoEnfileirarDiagnostico = { status: "idle" };

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
