// Pagina do lead = DOSSIE COMERCIAL (etapa 25).
//
// Visual proprio, sempre escuro: a div raiz tem a classe "dossie", que em
// app/globals.css redefine as variaveis de cor. Como os utilitarios do Tailwind
// apontam direto para essas variaveis (@theme inline), todo componente filho
// ja existente fica escuro sozinho - nenhum deles precisou ser tocado.
//
// A busca de dados e identica a de antes: so a apresentacao mudou.

import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { AdSignal, AiDiagnosis, Lead, Score, SiteAnalysis, SocialAnalysis } from "@/lib/db-types";
import { normalizarDetalhes } from "@/lib/enriquecimento/normalizar";
import { situacaoDoSite } from "@/lib/leads/consulta";
import { SITE_PASTILHA, pastilhaAnuncio, type TomPastilha } from "@/lib/leads/apresentacao";
import { derivarSinaisObjetivos } from "@/lib/leads/sinais-objetivos";
import { montarDiagnosticoDaLinha } from "@/lib/ia/normalizar-linha";
import { PROMPT_VERSAO } from "@/lib/ia/prompt";
import { Pastilha, Voltar } from "@/components/ui";
import { Favoritar } from "./favoritar";
import { ProcessarTudo } from "./processar-tudo";
import { CopiarDossie } from "./copiar-dossie";
import { Dossie, montarTextoDossie } from "./dossie";
import { DetalhesTecnicos } from "./detalhes-tecnicos";

export const dynamic = "force-dynamic";
// "Refazer análise" roda site + score + redes + anuncios + IA num pedido so.
export const maxDuration = 60;

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseServer();

  const { data: leadRaw } = await db.from("leads").select("*").eq("id", id).maybeSingle();
  if (!leadRaw) notFound();
  const lead = leadRaw as Lead;

  const [{ data: analiseRaw }, { data: scoreRaw }, { data: sociaisRaw }, { data: diagRaw }, { data: adsRaw }] =
    await Promise.all([
      db.from("site_analyses").select("*").eq("lead_id", id).maybeSingle(),
      db.from("scores").select("*").eq("lead_id", id).maybeSingle(),
      db.from("social_analyses").select("*").eq("lead_id", id).order("verificado_em", { ascending: false }),
      db.from("ai_diagnoses").select("*").eq("lead_id", id).maybeSingle(),
      db.from("ad_signals").select("*").eq("lead_id", id).maybeSingle(),
    ]);

  const a = analiseRaw as SiteAnalysis | null;
  const score = scoreRaw as Score | null;
  const sociais = (sociaisRaw ?? []) as SocialAnalysis[];
  const diag = diagRaw as AiDiagnosis | null;
  const ads = adsRaw as AdSignal | null;

  let reviews: Array<{ nota: number | null; autor: string | null; quando: string | null; texto: string | null }> = [];
  if (lead.google_place_id) {
    const { data: pc } = await db
      .from("places_cache")
      .select("detalhes")
      .eq("google_place_id", lead.google_place_id)
      .maybeSingle();
    if (pc?.detalhes) reviews = normalizarDetalhes(pc.detalhes).reviews;
  }

  const { data: vinculos } = await db
    .from("search_leads")
    .select("searches(id, nicho, regiao_texto)")
    .eq("lead_id", id);
  const pesquisa = (vinculos ?? [])
    .map((v) => {
      const b = (v as Record<string, unknown>).searches;
      return (Array.isArray(b) ? b[0] : b) as { id: string; nicho: string; regiao_texto: string } | null;
    })
    .find((p): p is { id: string; nicho: string; regiao_texto: string } => p != null);

  // ------------------------------------------------------------ derivados
  const temUrl = (lead.site_url ?? "").trim() !== "";
  const vereditoAds =
    ads?.veredito === "forte" || ads?.veredito === "alguns" || ads?.veredito === "nenhum"
      ? ads.veredito
      : null;

  const sinaisFaixa: Array<{ rotulo: string; texto: string; tom: TomPastilha }> = [
    { rotulo: "Anúncios", ...pastilhaAnuncio(vereditoAds, !!ads) },
    { rotulo: "Site", ...SITE_PASTILHA[situacaoDoSite(temUrl, a)] },
    { rotulo: "Redes", ...pastilhaRedes(lead, sociais) },
    { rotulo: "Contato", ...pastilhaContato(lead, a) },
  ];

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
    site: a
      ? {
          site_existe: a.site_existe,
          status_http: a.status_http,
          ttfb_ms: a.ttfb_ms,
          nota_mobile: a.nota_mobile,
          tem_viewport: a.tem_viewport,
          tem_whatsapp: a.tem_whatsapp,
          tem_formulario: a.tem_formulario,
          tem_cta: a.tem_cta,
          tem_meta_pixel: a.tem_meta_pixel,
          tem_ga: a.tem_ga,
          erro: a.erro,
        }
      : null,
    ads: ads ? { veredito: ads.veredito, confianca: ads.confianca } : null,
    sociais: sociais.map((s) => ({ plataforma: s.plataforma, status: s.status })),
  });

  // de onde vieram os dados que a IA leu (so o que realmente existe)
  const fontesLeitura = [
    "Google Places",
    a ? "análise de site" : null,
    sociais.length > 0 ? "presença social" : null,
    score ? "score" : null,
    ads ? "detecção de anúncios" : null,
  ].filter((f): f is string => f != null);

  const diagnostico = diag && !diag.erro ? montarDiagnosticoDaLinha(diag) : null;
  // diagnosticos da etapa 14 nao tem proposta/estrategia/mensagem/objecoes
  const ehVersaoAntiga = !!diag && !diag.erro && diag.versao_prompt !== PROMPT_VERSAO;
  const numero = (lead.telefone_internacional || lead.telefone || "").replace(/\D/g, "");
  const whatsapp = numero.length >= 8 ? numero : null;

  return (
    <div className="dossie flex flex-col gap-4 pb-10">
      {/* ---------------------------------------- 1. navegacao, bem discreta */}
      <div className="flex items-center gap-3">
        {pesquisa ? (
          <Voltar href={`/pesquisa/${pesquisa.id}`}>
            {pesquisa.nicho} em {pesquisa.regiao_texto}
          </Voltar>
        ) : (
          <Voltar href="/">Pesquisas</Voltar>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-faint">
          <Favoritar leadId={id} inicial={lead.favorito === true} tamanho="sm" />
        </span>
      </div>

      {/* ---------------------------------------------- 2. painel do dossie */}
      <section className="overflow-hidden rounded-2xl border border-line bg-[var(--painel)]">
        <p className="border-b border-line bg-soft px-3.5 py-[7px] text-[11px] font-bold uppercase tracking-[0.06em] text-faint">
          Painel do lead · dossiê completo
        </p>

        {/* cabecalho: identidade + score grande */}
        <div className="flex flex-wrap items-start justify-between gap-4 px-4 pb-4 pt-[18px] sm:px-5">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[20px] font-semibold leading-tight tracking-tight text-ink">
              {lead.nome}
            </h1>
            <p className="mt-[3px] text-[12.5px] text-muted">
              {[
                lead.categoria,
                lead.endereco,
                lead.avaliacao != null ? `★ ${lead.avaliacao} (${lead.qtd_avaliacoes ?? 0} avaliações)` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {lead.site_url ? (
              <a
                href={lead.site_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-block max-w-full break-all text-[12px] text-muted underline underline-offset-2 hover:text-ink"
              >
                {lead.site_url}
              </a>
            ) : (
              <p className="mt-0.5 text-[12px] text-faint">sem site cadastrado</p>
            )}
          </div>

          <div className="flex-shrink-0 text-right">
            <p
              className={`font-mono text-[30px] font-semibold leading-none tabular-nums ${corScore(score?.total ?? null)}`}
            >
              {score?.total ?? "—"}
            </p>
            <p className="mt-[3px] text-[10px] font-bold uppercase tracking-[0.08em] text-faint">Score</p>
          </div>
        </div>

        {/* 3. faixa de sinais: 4 colunas no desktop, 2x2 no celular */}
        <div className="grid grid-cols-2 gap-px border-y border-line bg-line sm:grid-cols-4">
          {sinaisFaixa.map((s) => (
            <div key={s.rotulo} className="bg-[var(--painel)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-faint">{s.rotulo}</p>
              <div className="mt-[5px]">
                <Pastilha tom={s.tom}>{s.texto}</Pastilha>
              </div>
            </div>
          ))}
        </div>

        {/* 4..10. corpo do dossie */}
        {diag?.erro ? (
          <div className="px-4 py-4">
            <p className="rounded-xl bg-warn-soft px-3.5 py-3 text-[13px] text-warn">
              O último diagnóstico com IA falhou: {diag.erro}
            </p>
          </div>
        ) : (
          <>
            {diagnostico && ehVersaoAntiga && (
              <div className="px-3 pt-3 sm:px-4 sm:pt-4">
                <p className="rounded-xl bg-warn-soft px-3.5 py-2.5 text-[12px] text-warn">
                  Este diagnóstico foi gerado numa versão anterior da IA ({diag?.versao_prompt}), que
                  ainda não escrevia proposta, estratégia, mensagem e objeções. Clique em{" "}
                  <strong>Refazer análise</strong> para gerar o dossiê completo.
                </p>
              </div>
            )}
            <Dossie diagnostico={diagnostico} sinais={sinais} fontesLeitura={fontesLeitura} />
          </>
        )}

        {/* 12. barra de acoes do painel */}
        <div className="flex flex-wrap items-center gap-[9px] border-t border-line bg-soft px-4 py-3.5 sm:px-5">
          {diagnostico && <CopiarDossie texto={montarTextoDossie(diagnostico)} />}
          {diagnostico && whatsapp && diagnostico.mensagemInicial && (
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(diagnostico.mensagemInicial)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-line-strong bg-card px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-[var(--painel)]"
            >
              Abrir WhatsApp
            </a>
          )}
          <ProcessarTudo leadId={id} jaTemDossie={!!diagnostico} />
          {diag && !diag.erro && (
            <p className="ml-auto font-mono text-[10.5px] text-faint">
              {diag.modelo}
              {diag.custo_usd ? ` · US$ ${Number(diag.custo_usd).toFixed(5)}` : ""}
              {diag.atualizado_em ? ` · ${new Date(diag.atualizado_em).toLocaleString("pt-BR")}` : ""}
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------- 11. detalhes tecnicos */}
      <div className="mt-2 flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-faint">
          Detalhes técnicos
        </p>
        <div className="h-px flex-1 bg-line" />
      </div>

      <DetalhesTecnicos
        leadId={id}
        lead={lead}
        site={a}
        score={score}
        ads={ads}
        sociais={sociais}
        reviews={reviews}
      />
    </div>
  );
}

// ------------------------------------------------------------------ helpers

function corScore(score: number | null): string {
  if (score == null) return "text-faint";
  if (score >= 70) return "text-ok";
  if (score >= 40) return "text-warn";
  return "text-bad";
}

/** Redes: perfil confirmado > link achado > checado e nada > nem link. */
function pastilhaRedes(
  lead: Lead,
  sociais: SocialAnalysis[],
): { texto: string; tom: TomPastilha } {
  const ig = sociais.find((s) => s.plataforma === "instagram");
  const fb = sociais.find((s) => s.plataforma === "facebook");
  if (ig?.status === "encontrado") return { texto: "Instagram ativo", tom: "ok" };
  if (fb?.status === "encontrado") return { texto: "Facebook ativo", tom: "ok" };

  const temLink = (lead.instagram_url ?? "").trim() !== "" || (lead.facebook_url ?? "").trim() !== "";
  if (temLink && sociais.length === 0) return { texto: "Tem link, a checar", tom: "apagado" };
  if (temLink) return { texto: "Link sem perfil confirmado", tom: "atencao" };
  if (sociais.length > 0) return { texto: "Nenhum perfil achado", tom: "neutro" };
  return { texto: "Sem link", tom: "neutro" };
}

/** Contato: WhatsApp no site > telefone > nada. Falta de dado = cinza, nunca vermelho. */
function pastilhaContato(lead: Lead, site: SiteAnalysis | null): { texto: string; tom: TomPastilha } {
  if (site?.tem_whatsapp === true) return { texto: "WhatsApp", tom: "ok" };
  if ((lead.telefone ?? "").trim() !== "") return { texto: "Telefone", tom: "ok" };
  return { texto: "Sem contato direto", tom: "neutro" };
}
