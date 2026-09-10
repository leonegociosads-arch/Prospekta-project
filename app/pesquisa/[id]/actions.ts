"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { executarDescoberta } from "@/lib/descoberta/executar";
import { enfileirarAnalisesDeSite } from "@/lib/analise-site/enfileirar";
import { enfileirarScores } from "@/lib/score/enfileirar";
import { enfileirarDiagnosticos } from "@/lib/ia/enfileirar";
import type {
  EstadoDescoberta,
  EstadoEnfileirar,
  EstadoEnfileirarScore,
  EstadoEnfileirarDiagnostico,
} from "./estado";

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
