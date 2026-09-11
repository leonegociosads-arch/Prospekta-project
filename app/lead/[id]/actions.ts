"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { analisarSite } from "@/lib/analise-site/analisar";
import { calcularEPersistirScore } from "@/lib/score/persistir";
import { enriquecerLead } from "@/lib/enriquecimento/enriquecer";
import { ErroDeOrcamento } from "@/lib/guardas";
import { ErroGoogle, mensagemAmigavel } from "@/lib/descoberta/erros";
import { analisarSocial } from "@/lib/analise-social/analisar-social";
import { diagnosticarLead } from "@/lib/ia/diagnosticar";
import { ErroIa, mensagemAmigavelIa } from "@/lib/ia/erros";
import { analisarAds } from "@/lib/ads/analisar-ads";
import type {
  EstadoAnalise,
  EstadoScore,
  EstadoEnriquecimento,
  EstadoSocial,
  EstadoFavorito,
  EstadoAds,
  EstadoDiagnostico,
  EstadoProcessarTudo,
} from "./estado";

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

/**
 * Etapa 23: o botao "Fazer diagnóstico completo" da pagina do lead. Roda tudo
 * num pedido so (sem fila/worker), na ordem que os dados dependem uns dos
 * outros: site -> score -> redes -> anuncios -> IA. Cada etapa e independente
 * - se uma falhar, as outras continuam (mesma regra de robustez do worker).
 */
export async function processarTudoAction(
  leadId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura exigida pelo useActionState
  _anterior: EstadoProcessarTudo,
): Promise<EstadoProcessarTudo> {
  try {
    const db = supabaseServer();
    const { data: lead, error: errLead } = await db
      .from("leads")
      .select("site_url")
      .eq("id", leadId)
      .maybeSingle();
    if (errLead) throw new Error(`leads: ${errLead.message}`);
    if (!lead) return { status: "erro", mensagem: "Lead não encontrado." };

    const temSite = (lead.site_url ?? "").trim() !== "";

    if (temSite) {
      await analisarSite({ db, apiKey: process.env.GOOGLE_MAPS_API_KEY }, leadId, { forcar: true }).catch(
        (e) => console.error("[processarTudo] analisarSite falhou:", e),
      );
    }
    await calcularEPersistirScore(db, leadId).catch((e) =>
      console.error("[processarTudo] calcularScore falhou:", e),
    );
    await analisarSocial({ db }, leadId, { forcar: true }).catch((e) =>
      console.error("[processarTudo] analisarSocial falhou:", e),
    );
    await analisarAds({ db }, leadId, { forcar: true }).catch((e) =>
      console.error("[processarTudo] analisarAds falhou:", e),
    );

    let avisoIa: string | null = null;
    try {
      const r = await diagnosticarLead(
        { db, apiKey: process.env.GEMINI_API_KEY },
        leadId,
        { ignorarElegibilidade: true },
      );
      if (r.status === "erro-modelo") avisoIa = r.erro ?? "o modelo não devolveu um diagnóstico aproveitável.";
    } catch (e) {
      console.error("[processarTudo] diagnosticarLead falhou:", e);
      if (e instanceof ErroDeOrcamento) {
        avisoIa = `IA bloqueada pela guarda de orçamento: ${e.motivo}.`;
      } else if (e instanceof ErroIa) {
        avisoIa = `IA: ${mensagemAmigavelIa(e.tipo)}`;
      } else {
        avisoIa = "Erro inesperado ao gerar o diagnóstico com IA.";
      }
    }

    revalidatePath(`/lead/${leadId}`);
    return { status: "ok", avisoIa };
  } catch (e) {
    console.error("[processarTudo] excecao:", e);
    return { status: "erro", mensagem: "Erro inesperado ao processar o lead. Veja o terminal do servidor." };
  }
}

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
