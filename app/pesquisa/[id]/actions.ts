"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { executarDescoberta } from "@/lib/descoberta/executar";
import { enfileirarAnalisesDeSite } from "@/lib/analise-site/enfileirar";
import { enfileirarScores } from "@/lib/score/enfileirar";
import { enfileirarAnalisesSociais } from "@/lib/analise-social/enfileirar";
import { enfileirarDetecaoAds } from "@/lib/ads/enfileirar";
import { enfileirarDiagnosticos } from "@/lib/ia/enfileirar";
import { normalizarDetalhes } from "@/lib/enriquecimento/normalizar";
import { derivarSinaisObjetivos } from "@/lib/leads/sinais-objetivos";
import type { AdSignal, Lead, Score, SiteAnalysis, SocialAnalysis } from "@/lib/db-types";
import type {
  EstadoDescoberta,
  EstadoReprocessar,
  AcaoEmLote,
  EstadoLote,
  EstadoEnfileirarDiagnostico,
  EstadoDetalhes,
  ReviewLead,
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

/**
 * Carrega TUDO que existe sobre um lead sem envolver a IA: pontos fortes e
 * fracos derivados do que ja foi medido, boletim do site, score detalhado,
 * trafego pago, redes e as avaliacoes ja guardadas no cache local.
 *
 * Roda sob demanda, quando o card do lead abre - assim a tabela continua leve.
 * Sao leituras do nosso proprio banco: nao chama API externa nem gera custo.
 */
export async function carregarDetalhesLeadAction(leadId: string): Promise<EstadoDetalhes> {
  if (typeof leadId !== "string" || leadId.length === 0) {
    return { status: "erro", mensagem: "Lead inválido." };
  }

  try {
    const db = supabaseServer();

    const [leadRes, siteRes, scoreRes, adsRes, sociaisRes] = await Promise.all([
      db.from("leads").select("*").eq("id", leadId).maybeSingle(),
      db.from("site_analyses").select("*").eq("lead_id", leadId).maybeSingle(),
      db.from("scores").select("*").eq("lead_id", leadId).maybeSingle(),
      db.from("ad_signals").select("*").eq("lead_id", leadId).maybeSingle(),
      db
        .from("social_analyses")
        .select("*")
        .eq("lead_id", leadId)
        .order("verificado_em", { ascending: false }),
    ]);

    if (!leadRes.data) return { status: "erro", mensagem: "Lead não encontrado." };

    const lead = leadRes.data as Lead;
    const site = (siteRes.data ?? null) as SiteAnalysis | null;
    const score = (scoreRes.data ?? null) as Score | null;
    const ads = (adsRes.data ?? null) as AdSignal | null;
    const sociais = (sociaisRes.data ?? []) as SocialAnalysis[];

    // avaliacoes: so o que ja esta no cache local (nao chama o Google de novo)
    let reviews: ReviewLead[] = [];
    if (lead.google_place_id) {
      const { data: pc } = await db
        .from("places_cache")
        .select("detalhes")
        .eq("google_place_id", lead.google_place_id)
        .maybeSingle();
      if (pc?.detalhes) reviews = normalizarDetalhes(pc.detalhes).reviews;
    }

    const sinais = derivarSinaisObjetivos({
      lead: {
        telefone: lead.telefone,
        site_url: lead.site_url,
        instagram_url: lead.instagram_url,
        facebook_url: lead.facebook_url,
        avaliacao: lead.avaliacao,
        qtd_avaliacoes: lead.qtd_avaliacoes,
        status_negocio: lead.status_negocio,
      },
      site: site
        ? {
            site_existe: site.site_existe,
            status_http: site.status_http,
            ttfb_ms: site.ttfb_ms,
            nota_mobile: site.nota_mobile,
            tem_viewport: site.tem_viewport,
            tem_whatsapp: site.tem_whatsapp,
            tem_formulario: site.tem_formulario,
            tem_cta: site.tem_cta,
            tem_meta_pixel: site.tem_meta_pixel,
            tem_ga: site.tem_ga,
            erro: site.erro,
          }
        : null,
      ads: ads ? { veredito: ads.veredito, confianca: ads.confianca } : null,
      sociais: sociais.map((s) => ({ plataforma: s.plataforma, status: s.status })),
    });

    return {
      status: "ok",
      detalhes: {
        sinais,
        site,
        score,
        ads,
        sociais,
        reviews,
        horarios: Array.isArray(lead.horarios)
          ? (lead.horarios as unknown[]).filter((h): h is string => typeof h === "string")
          : [],
        mapsUri: lead.maps_uri ?? null,
        telefoneInternacional: lead.telefone_internacional ?? null,
        enriquecidoEm: lead.enriquecido_em ?? null,
      },
    };
  } catch (e) {
    console.error("[carregarDetalhesLead] excecao:", e);
    return { status: "erro", mensagem: "Não foi possível carregar os detalhes deste lead." };
  }
}
