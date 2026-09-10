"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { executarDescoberta } from "@/lib/descoberta/executar";
import { enfileirarAnalisesDeSite } from "@/lib/analise-site/enfileirar";
import { enfileirarScores } from "@/lib/score/enfileirar";
import { enfileirarAnalisesSociais } from "@/lib/analise-social/enfileirar";
import { enfileirarDiagnosticos } from "@/lib/ia/enfileirar";
import type {
  EstadoDescoberta,
  EstadoReprocessar,
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
