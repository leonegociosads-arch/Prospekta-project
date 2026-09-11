// Home / painel principal (etapa 31): virou um "centro de inteligencia da
// prospeccao" em vez de so uma lista de pesquisas. Tudo aqui e DERIVADO do
// que ja existe - nenhuma metrica nova, nenhum criterio novo de score.
//
// Duas passadas no banco: (1) tudo que precisa para os KPIs, a rosca e o
// grafico de barras vem de 4 consultas simples (searches, leads, vinculos,
// scores), agregadas em memoria por montarResumoPainel (funcao pura,
// testada); (2) so para os poucos leads do ranking "melhores oportunidades",
// uma segunda consulta pequena traz site/ads/redes para calcular os sinais
// (mesma funcao que a pagina do lead e o card da tabela ja usam).

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import type { AdSignal, SiteAnalysis, SocialAnalysis } from "@/lib/db-types";
import { derivarSinaisObjetivos, type SinalObjetivo } from "@/lib/leads/sinais-objetivos";
import {
  montarResumoPainel,
  type FaixaQualidade,
  type LeadParaResumo,
  type ScoreParaResumo,
  type SearchParaResumo,
  type VinculoParaResumo,
} from "@/lib/painel/resumo";
import { Aviso, Metrica, Panel, Pastilha, TagFonte } from "@/components/ui";
import { Rosca, BarrasHorizontais, type FatiaRosca, type BarraHorizontal } from "@/components/graficos";

export const dynamic = "force-dynamic";

const FAIXA_INFO: Record<FaixaQualidade, { rotulo: string; tom: "ok" | "atencao" | "ruim" }> = {
  bom: { rotulo: "Bom", tom: "ok" },
  medio: { rotulo: "Médio", tom: "atencao" },
  ruim: { rotulo: "Ruim", tom: "ruim" },
};

type LeadDetalheParaSinais = {
  id: string;
  telefone: string | null;
  site_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  avaliacao: number | null;
  qtd_avaliacoes: number | null;
  status_negocio: string | null;
};

export default async function Home() {
  const db = supabaseServer();

  const [{ data: searchesRaw, error }, { data: leadsRaw }, { data: vinculosRaw }, { data: scoresRaw }] =
    await Promise.all([
      db.from("searches").select("*").order("criada_em", { ascending: false }),
      db.from("leads").select("id, nome, categoria, endereco, favorito, criado_em"),
      db.from("search_leads").select("search_id, lead_id, visto_em"),
      db.from("scores").select("lead_id, total"),
    ]);

  const searches = (searchesRaw ?? []) as SearchParaResumo[];
  const leads = (leadsRaw ?? []) as LeadParaResumo[];
  const vinculos = (vinculosRaw ?? []) as VinculoParaResumo[];
  const scores = (scoresRaw ?? []) as ScoreParaResumo[];

  const resumo = montarResumoPainel({ searches, leads, vinculos, scores });

  // sinais fracos so para os poucos leads do ranking - nada de buscar isso
  // para os leads todos.
  const idsRanking = resumo.melhoresOportunidades.map((o) => o.leadId);
  const sinaisPorLead = new Map<string, SinalObjetivo[]>();
  if (idsRanking.length > 0) {
    const [{ data: leadsDet }, { data: sitesDet }, { data: adsDet }, { data: sociaisDet }] = await Promise.all([
      db
        .from("leads")
        .select("id, telefone, site_url, instagram_url, facebook_url, avaliacao, qtd_avaliacoes, status_negocio")
        .in("id", idsRanking),
      db.from("site_analyses").select("*").in("lead_id", idsRanking),
      db.from("ad_signals").select("*").in("lead_id", idsRanking),
      db.from("social_analyses").select("*").in("lead_id", idsRanking),
    ]);

    const leadDetPorId = new Map(
      ((leadsDet ?? []) as LeadDetalheParaSinais[]).map((l) => [l.id, l]),
    );
    const sitePorLead = new Map(((sitesDet ?? []) as SiteAnalysis[]).map((s) => [s.lead_id, s]));
    const adsPorLead = new Map(((adsDet ?? []) as AdSignal[]).map((a) => [a.lead_id, a]));
    const sociaisPorLead = new Map<string, SocialAnalysis[]>();
    for (const s of (sociaisDet ?? []) as SocialAnalysis[]) {
      const lista = sociaisPorLead.get(s.lead_id) ?? [];
      lista.push(s);
      sociaisPorLead.set(s.lead_id, lista);
    }

    for (const id of idsRanking) {
      const ld = leadDetPorId.get(id);
      if (!ld) continue;
      const site = sitePorLead.get(id) ?? null;
      const ads = adsPorLead.get(id) ?? null;
      const sociais = sociaisPorLead.get(id) ?? [];
      const sinais = derivarSinaisObjetivos({
        lead: {
          telefone: ld.telefone,
          site_url: ld.site_url,
          instagram_url: ld.instagram_url,
          facebook_url: ld.facebook_url,
          avaliacao: ld.avaliacao,
          qtd_avaliacoes: ld.qtd_avaliacoes,
          status_negocio: ld.status_negocio,
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
      sinaisPorLead.set(id, sinais.fracos);
    }
  }

  const fatiasRosca: FatiaRosca[] = [
    { rotulo: "Bons", valor: resumo.qualidade.bons, corTexto: "text-ok" },
    { rotulo: "Médios", valor: resumo.qualidade.medios, corTexto: "text-warn" },
    { rotulo: "Ruins", valor: resumo.qualidade.ruins, corTexto: "text-bad" },
  ];

  const barras: BarraHorizontal[] = resumo.porPesquisa.map((p) => ({
    id: p.searchId,
    rotulo: p.nicho,
    valor: p.boas,
    href: `/pesquisa/${p.searchId}`,
    dica:
      p.aproveitamento != null
        ? `${p.boas} boa(s) oportunidade(s) · ${p.totalLeads} lead(s) encontrado(s) · ${p.aproveitamento}% de aproveitamento`
        : `${p.boas} boa(s) oportunidade(s) · ${p.totalLeads} lead(s) encontrado(s)`,
  }));

  if (resumo.totalPesquisas === 0) {
    return <PainelVazio />;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* -------------------------------------------------------- 1. header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Visão geral</h1>
          <p className="text-sm text-muted">
            Acompanhe suas oportunidades e encontre os próximos leads para abordar.
          </p>
        </div>
        <Link
          href="/pesquisa/nova"
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-press"
        >
          + Nova pesquisa
        </Link>
      </div>

      {error && <Aviso>Erro ao ler o banco: {error.message}</Aviso>}

      {/* ------------------------------------------------------- 2. KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metrica rotulo="Leads encontrados" valor={String(resumo.totalLeads)} />
        <Metrica rotulo="Leads analisados" valor={String(resumo.leadsAnalisados)} />
        <Metrica rotulo="Boas oportunidades" valor={String(resumo.boasOportunidades)} />
        <Metrica rotulo="Favoritos" valor={String(resumo.favoritos)} />
      </div>

      {/* ---------------------- 3 e 4. qualidade + oportunidades por pesquisa */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel rotulo="Qualidade dos leads" className="p-4 sm:p-5">
          {resumo.qualidade.totalClassificado === 0 ? (
            <p className="text-[13px] text-faint">
              Nenhum lead analisado ainda. O score aparece depois que o worker processa os leads
              de uma pesquisa.
            </p>
          ) : (
            <>
              <Rosca fatias={fatiasRosca} centroValor={String(resumo.qualidade.totalClassificado)} centroRotulo="Analisados" />
              {resumo.naoAnalisados > 0 && (
                <p className="mt-3 border-t border-line pt-2.5 text-[11.5px] text-faint">
                  + {resumo.naoAnalisados} lead(s) ainda não analisado(s) — não entram nesta conta.
                </p>
              )}
            </>
          )}
        </Panel>

        <Panel rotulo="Oportunidades por pesquisa" className="p-4 sm:p-5">
          {!resumo.algumaPesquisaComOportunidade ? (
            <p className="text-[13px] text-faint">
              Nenhuma pesquisa tem boas oportunidades (score ≥ 70) ainda. Assim que o score
              classificar algum lead como bom, a comparação aparece aqui.
            </p>
          ) : (
            <>
              <BarrasHorizontais barras={barras} />
              {resumo.totalPesquisasForaDoTopo > 0 && (
                <Link
                  href="/pesquisas"
                  className="mt-3 inline-block text-[12px] text-muted underline underline-offset-2 hover:text-ink"
                >
                  Ver todas as pesquisas →
                </Link>
              )}
            </>
          )}
        </Panel>
      </div>

      {/* ------------------------------------------------- 5. melhores leads */}
      <Panel rotulo="Melhores oportunidades" className="p-4 sm:p-5">
        {resumo.melhoresOportunidades.length === 0 ? (
          <p className="text-[13px] text-faint">
            Nenhum lead analisado ainda — assim que o score rodar, os melhores aparecem aqui.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {resumo.melhoresOportunidades.map((o) => {
              const info = FAIXA_INFO[o.faixa];
              const sinais = (sinaisPorLead.get(o.leadId) ?? []).slice(0, 3);
              return (
                <li key={o.leadId} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                      {o.favorito && <span className="text-amber-500">★</span>}
                      {o.nome}
                      <span
                        className={`ml-1 font-mono text-[13px] font-bold tabular-nums ${
                          o.faixa === "bom" ? "text-ok" : o.faixa === "medio" ? "text-warn" : "text-bad"
                        }`}
                      >
                        {o.score}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {[o.nicho ?? o.categoria, o.endereco ?? o.regiaoTexto].filter(Boolean).join(" · ")}
                    </p>
                    {sinais.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {sinais.map((s, i) => (
                          <TagFonte key={i}>{s.texto}</TagFonte>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2.5">
                    <Pastilha tom={info.tom}>{info.rotulo}</Pastilha>
                    <Link
                      href={`/lead/${o.leadId}`}
                      className="text-[12.5px] font-semibold text-accent-ink hover:underline"
                    >
                      Ver lead →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* ------------------------------------------------- 6. pesquisas recentes */}
      <Panel rotulo="Pesquisas recentes" className="p-4 sm:p-5">
        <ul className="flex flex-col divide-y divide-line">
          {resumo.pesquisasRecentes.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pesquisa/${p.id}`}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:opacity-80"
              >
                <span className="min-w-0">
                  <span className="text-[13.5px] font-medium text-ink">{p.nicho}</span>
                  <span className="block text-[12px] text-faint">
                    {p.regiaoTexto} · {p.raioKm} km · {p.totalLeads} lead{p.totalLeads === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-faint">{p.status}</span>
              </Link>
            </li>
          ))}
        </ul>
        {resumo.totalPesquisasForaDasRecentes > 0 && (
          <Link
            href="/pesquisas"
            className="mt-3 inline-block border-t border-line pt-3 text-[12.5px] font-semibold text-accent-ink hover:underline"
          >
            Ver todas as pesquisas →
          </Link>
        )}
      </Panel>
    </div>
  );
}

/** Sem pesquisa nenhuma ainda: nada de dashboard cheio de zero. */
function PainelVazio() {
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className="size-14 text-line-strong">
        <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <circle cx="32" cy="32" r="15" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
        <circle cx="32" cy="32" r="3.5" fill="var(--brand-green)" />
      </svg>
      <div>
        <h1 className="text-lg font-semibold text-ink">Encontre sua primeira oportunidade</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
          Faça uma pesquisa e o Prospekta começará a mapear empresas e oportunidades para você.
        </p>
      </div>
      <Link
        href="/pesquisa/nova"
        className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-press"
      >
        Fazer primeira pesquisa
      </Link>
    </div>
  );
}
