"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { executarDescoberta, type ResumoDescoberta } from "@/lib/descoberta/executar";

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
