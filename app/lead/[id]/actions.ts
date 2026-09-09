"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { analisarSite } from "@/lib/analise-site/analisar";
import type { ResultadoAnaliseSite } from "@/lib/analise-site/tipos";
import { calcularEPersistirScore } from "@/lib/score/persistir";
import { enriquecerLead } from "@/lib/enriquecimento/enriquecer";
import type { ResultadoEnriquecimento } from "@/lib/enriquecimento/tipos";
import { ErroDeOrcamento } from "@/lib/guardas";
import { ErroGoogle, mensagemAmigavel } from "@/lib/descoberta/erros";
import { analisarSocial } from "@/lib/analise-social/analisar-social";
import type { ResultadoAnaliseSocial } from "@/lib/analise-social/tipos";
import { diagnosticarLead } from "@/lib/ia/diagnosticar";
import type { ResultadoDiagnostico } from "@/lib/ia/tipos";
import { ErroIa, mensagemAmigavelIa } from "@/lib/ia/erros";
import { analisarAds } from "@/lib/ads/analisar-ads";
import type { ResultadoDetecaoAds } from "@/lib/ads/tipos";

export type EstadoAnalise =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoAnaliseSite }
  | { status: "erro"; mensagem: string };

export const ESTADO_ANALISE_INICIAL: EstadoAnalise = { status: "idle" };

export async function analisarSiteAction(
  leadId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura exigida pelo useActionState
  _anterior: EstadoAnalise,
): Promise<EstadoAnalise> {
  try {
    const db = supabaseServer();
    const resultado = await analisarSite(
      { db, apiKey: process.env.GOOGLE_MAPS_API_KEY },
      leadId,
      { forcar: true },
    );
    revalidatePath(`/lead/${leadId}`);
    return { status: "ok", resultado };
  } catch (e) {
    console.error("[analisarSite] excecao:", e);
    return {
      status: "erro",
      mensagem: "Erro inesperado ao analisar o site. Veja o terminal do servidor.",
    };
  }
}

export type EstadoScore =
  | { status: "idle" }
  | { status: "ok"; total: number }
  | { status: "erro"; mensagem: string };

export const ESTADO_SCORE_INICIAL: EstadoScore = { status: "idle" };

export async function calcularScoreAction(
  leadId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura exigida pelo useActionState
  _anterior: EstadoScore,
): Promise<EstadoScore> {
  try {
    const db = supabaseServer();
    const r = await calcularEPersistirScore(db, leadId);
    if (r.status === "lead-nao-encontrado") {
      return { status: "erro", mensagem: "Lead nao encontrado." };
    }
    revalidatePath(`/lead/${leadId}`);
    return { status: "ok", total: r.total };
  } catch (e) {
    console.error("[calcularScore] excecao:", e);
    return {
      status: "erro",
      mensagem: "Erro inesperado ao calcular o score. Veja o terminal do servidor.",
    };
  }
}

export type EstadoEnriquecimento =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoEnriquecimento }
  | { status: "erro"; mensagem: string };

export const ESTADO_ENRIQUECIMENTO_INICIAL: EstadoEnriquecimento = { status: "idle" };

export async function enriquecerLeadAction(
  leadId: string,
  _anterior: EstadoEnriquecimento,
  formData: FormData,
): Promise<EstadoEnriquecimento> {
  const incluirReviews = formData.get("reviews") === "on";
  try {
    const db = supabaseServer();
    const resultado = await enriquecerLead(
      { db, apiKey: process.env.GOOGLE_MAPS_API_KEY },
      leadId,
      { incluirReviews },
    );
    revalidatePath(`/lead/${leadId}`);
    if (resultado.status === "lead-nao-encontrado") {
      return { status: "erro", mensagem: "Lead nao encontrado." };
    }
    if (resultado.status === "sem-place-id") {
      return { status: "erro", mensagem: "Este lead nao tem Google Place ID - nao da para enriquecer." };
    }
    return { status: "ok", resultado };
  } catch (e) {
    console.error("[enriquecerLead] excecao:", e);
    let msg = "Erro inesperado ao enriquecer o lead. Veja o terminal do servidor.";
    if (e instanceof ErroDeOrcamento) {
      msg = `Bloqueado pela guarda de orcamento: ${e.motivo}.`;
    } else if (e instanceof ErroGoogle) {
      msg = `${e.tipo}: ${mensagemAmigavel(e.tipo)}`;
    }
    return { status: "erro", mensagem: msg };
  }
}

export type EstadoSocial =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoAnaliseSocial }
  | { status: "erro"; mensagem: string };

export const ESTADO_SOCIAL_INICIAL: EstadoSocial = { status: "idle" };

export async function analisarSocialAction(
  leadId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura exigida pelo useActionState
  _anterior: EstadoSocial,
): Promise<EstadoSocial> {
  try {
    const db = supabaseServer();
    const resultado = await analisarSocial({ db }, leadId, { forcar: true });
    revalidatePath(`/lead/${leadId}`);
    if (resultado.status === "lead-nao-encontrado") {
      return { status: "erro", mensagem: "Lead nao encontrado." };
    }
    return { status: "ok", resultado };
  } catch (e) {
    console.error("[analisarSocial] excecao:", e);
    return {
      status: "erro",
      mensagem: "Erro inesperado ao analisar as redes. Veja o terminal do servidor.",
    };
  }
}

export type EstadoFavorito = { favorito: boolean; erro?: string };

/** Liga/desliga o favorito de um lead. Usado na tabela da pesquisa e na pagina do lead. */
export async function definirFavoritoAction(
  leadId: string,
  favorito: boolean,
): Promise<EstadoFavorito> {
  try {
    const db = supabaseServer();
    const { error } = await db.from("leads").update({ favorito }).eq("id", leadId);
    if (error) {
      console.error("[definirFavorito] erro:", error);
      return { favorito: !favorito, erro: "Não foi possível salvar o favorito." };
    }
    revalidatePath(`/lead/${leadId}`);
    revalidatePath("/");
    return { favorito };
  } catch (e) {
    console.error("[definirFavorito] excecao:", e);
    return { favorito: !favorito, erro: "Falha ao salvar o favorito." };
  }
}

export type EstadoAds =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoDetecaoAds }
  | { status: "erro"; mensagem: string };

export const ESTADO_ADS_INICIAL: EstadoAds = { status: "idle" };

export async function detectarAdsAction(
  leadId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura exigida pelo useActionState
  _anterior: EstadoAds,
): Promise<EstadoAds> {
  try {
    const db = supabaseServer();
    const resultado = await analisarAds({ db }, leadId, { forcar: true });
    revalidatePath(`/lead/${leadId}`);
    if (resultado.status === "lead-nao-encontrado") {
      return { status: "erro", mensagem: "Lead nao encontrado." };
    }
    return { status: "ok", resultado };
  } catch (e) {
    console.error("[detectarAds] excecao:", e);
    return {
      status: "erro",
      mensagem: "Erro inesperado ao detectar anúncios. Veja o terminal do servidor.",
    };
  }
}

export type EstadoDiagnostico =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoDiagnostico }
  | { status: "erro"; mensagem: string };

export const ESTADO_DIAGNOSTICO_INICIAL: EstadoDiagnostico = { status: "idle" };

export async function diagnosticarLeadAction(
  leadId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura exigida pelo useActionState
  _anterior: EstadoDiagnostico,
): Promise<EstadoDiagnostico> {
  try {
    const db = supabaseServer();
    // botao manual: roda mesmo abaixo do limite; cache e teto de gasto continuam valendo
    const resultado = await diagnosticarLead(
      { db, apiKey: process.env.GEMINI_API_KEY },
      leadId,
      { ignorarElegibilidade: true },
    );
    revalidatePath(`/lead/${leadId}`);
    if (resultado.status === "lead-nao-encontrado") {
      return { status: "erro", mensagem: "Lead nao encontrado." };
    }
    if (resultado.status === "sem-score") {
      return { status: "erro", mensagem: "Calcule o score deste lead antes de pedir o diagnostico." };
    }
    return { status: "ok", resultado };
  } catch (e) {
    console.error("[diagnosticarLead] excecao:", e);
    let msg = "Erro inesperado ao gerar o diagnostico. Veja o terminal do servidor.";
    if (e instanceof ErroDeOrcamento) {
      msg = `Bloqueado pela guarda de orcamento: ${e.motivo}.`;
    } else if (e instanceof ErroIa) {
      msg = `${e.tipo}: ${mensagemAmigavelIa(e.tipo)}`;
    }
    return { status: "erro", mensagem: msg };
  }
}
