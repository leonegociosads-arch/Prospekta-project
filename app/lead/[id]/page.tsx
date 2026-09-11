import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { AdSignal, AiDiagnosis, Lead, Score, SiteAnalysis, SocialAnalysis } from "@/lib/db-types";
import type { FatorScore, ModeradorScore } from "@/lib/score/tipos";
import { normalizarDetalhes } from "@/lib/enriquecimento/normalizar";
import { situacaoDoSite } from "@/lib/leads/consulta";
import { SITE_PASTILHA, pastilhaAnuncio } from "@/lib/leads/apresentacao";
import { montarDiagnosticoDaLinha } from "@/lib/ia/normalizar-linha";
import { Cartao, Pastilha, SeloScore } from "@/components/ui";
import { AnalisarSite } from "./analisar";
import { RecalcularScore } from "./score";
import { EnriquecerLead } from "./enriquecer";
import { AnalisarRedes } from "./social";
import { DetectarAds } from "./detectar-ads";
import { Favoritar } from "./favoritar";
import { ProcessarTudo } from "./processar-tudo";
import { Dossie } from "./dossie";

export const dynamic = "force-dynamic";
// o botao "Fazer diagnostico completo" roda site + score + redes + anuncios +
// IA num pedido so, sem fila - da tempo dele terminar antes do timeout padrao.
export const maxDuration = 60;

type Detalhamento = {
  confianca?: string;
  fatores?: FatorScore[];
  moderadores?: ModeradorScore[];
};

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseServer();

  const { data: leadRaw } = await db.from("leads").select("*").eq("id", id).maybeSingle();
  if (!leadRaw) notFound();
  const lead = leadRaw as Lead;

  const { data: analiseRaw } = await db
    .from("site_analyses")
    .select("*")
    .eq("lead_id", id)
    .maybeSingle();
  const a = analiseRaw as SiteAnalysis | null;

  const { data: scoreRaw } = await db.from("scores").select("*").eq("lead_id", id).maybeSingle();
  const score = scoreRaw as Score | null;
  const det = (score?.detalhamento ?? {}) as Detalhamento;

  const { data: sociaisRaw } = await db
    .from("social_analyses")
    .select("*")
    .eq("lead_id", id)
    .order("verificado_em", { ascending: false });
  const sociais = (sociaisRaw ?? []) as SocialAnalysis[];

  const { data: diagRaw } = await db.from("ai_diagnoses").select("*").eq("lead_id", id).maybeSingle();
  const diag = diagRaw as AiDiagnosis | null;

  const { data: adsRaw } = await db.from("ad_signals").select("*").eq("lead_id", id).maybeSingle();
  const ads = adsRaw as AdSignal | null;

  let detalhes = null;
  if (lead.google_place_id) {
    const { data: pc } = await db
      .from("places_cache")
      .select("detalhes")
      .eq("google_place_id", lead.google_place_id)
      .maybeSingle();
    if (pc?.detalhes) detalhes = normalizarDetalhes(pc.detalhes);
  }

  const { data: vinculos } = await db
    .from("search_leads")
    .select("searches(id, nicho, regiao_texto)")
    .eq("lead_id", id);
  const pesquisas = (vinculos ?? [])
    .map((v) => {
      const b = (v as Record<string, unknown>).searches;
      return (Array.isArray(b) ? b[0] : b) as
        | { id: string; nicho: string; regiao_texto: string }
        | null;
    })
    .filter((p): p is { id: string; nicho: string; regiao_texto: string } => p != null);

  // ---------- resumo dos 4 sinais, no mesmo estilo da tabela (etapa 21/23) ----------
  const temUrl = (lead.site_url ?? "").trim() !== "";
  const siteSituacao = situacaoDoSite(temUrl, a);
  const sitePastilha = SITE_PASTILHA[siteSituacao];
  const anuncioPastilha = pastilhaAnuncio(
    ads?.veredito === "forte" || ads?.veredito === "alguns" || ads?.veredito === "nenhum"
      ? ads.veredito
      : null,
    !!ads,
  );
  const temRedeLink = (lead.instagram_url ?? "").trim() !== "" || (lead.facebook_url ?? "").trim() !== "";
  const redesPastilha = sociais.some((s) => s.status === "encontrado")
    ? { texto: "perfil encontrado", tom: "ok" as const }
    : sociais.length > 0
      ? { texto: "não encontrado", tom: "neutro" as const }
      : temRedeLink
        ? { texto: "tem link, a checar", tom: "apagado" as const }
        : { texto: "sem link", tom: "neutro" as const };
  const temContato = lead.telefone || a?.tem_whatsapp === true;
  const contatoPastilha = a?.tem_whatsapp === true
    ? { texto: "WhatsApp no site", tom: "ok" as const }
    : temContato
      ? { texto: "telefone", tom: "neutro" as const }
      : { texto: "sem contato direto", tom: "apagado" as const };

  const diagnostico = diag && !diag.erro ? montarDiagnosticoDaLinha(diag) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        {pesquisas[0] && (
          <Link href={`/pesquisa/${pesquisas[0].id}`} className="text-sm text-muted hover:text-ink">
            &larr; {pesquisas[0].nicho} em {pesquisas[0].regiao_texto}
          </Link>
        )}
        <div className="flex items-start gap-2">
          <Favoritar leadId={id} inicial={lead.favorito === true} />
          <h1 className="text-xl font-semibold tracking-tight">{lead.nome}</h1>
        </div>
        <p className="text-sm text-muted">
          {lead.categoria ?? "—"}
          {lead.endereco ? ` · ${lead.endereco}` : ""}
          {lead.avaliacao != null && (
            <span className="tabular-nums"> · ★ {lead.avaliacao} ({lead.qtd_avaliacoes ?? 0})</span>
          )}
        </p>
        <p className="text-sm">
          {lead.site_url ? (
            <a
              href={lead.site_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted underline underline-offset-2"
            >
              {lead.site_url}
            </a>
          ) : (
            <span className="text-faint">sem site cadastrado</span>
          )}
        </p>
      </div>

      {/* ---------- 1 clique: roda tudo e mostra o dossie ---------- */}
      <Cartao className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">Score</span>
          <SeloScore score={score?.total ?? null} />
        </div>
        <ProcessarTudo leadId={id} jaTemDossie={!!diagnostico} />
      </Cartao>

      {/* ---------- 4 sinais de relance ---------- */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CelulaSinal titulo="Anúncios" pastilha={anuncioPastilha} />
        <CelulaSinal titulo="Site" pastilha={sitePastilha} />
        <CelulaSinal titulo="Redes" pastilha={redesPastilha} />
        <CelulaSinal titulo="Contato" pastilha={contatoPastilha} />
      </div>

      {/* ---------- o dossie ---------- */}
      {diagnostico ? (
        <Dossie diagnostico={diagnostico} modelo={diag?.modelo ?? null} atualizadoEm={diag?.atualizado_em ?? null} />
      ) : diag?.erro ? (
        <Cartao className="bg-warn-soft">
          <p className="text-sm text-warn">O último diagnóstico com IA falhou: {diag.erro}</p>
        </Cartao>
      ) : (
        <Cartao className="border-dashed text-center">
          <p className="text-sm text-muted">
            Ainda sem dossiê. Clique em &ldquo;Fazer diagnóstico completo&rdquo; acima — a IA lê os
            dados já coletados e escreve pontos fortes/fracos, uma proposta e a estratégia de
            abordagem.
          </p>
        </Cartao>
      )}

      {/* ---------- detalhes tecnicos: dados crus + controles individuais ---------- */}
      <div className="flex items-center gap-2 pt-2">
        <div className="h-px flex-1 bg-line" />
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Detalhes técnicos</p>
        <div className="h-px flex-1 bg-line" />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Enriquecimento (Google Place Details)</p>
            <p className="text-xs text-muted">
              {lead.enriquecido_em
                ? `Enriquecido em ${new Date(lead.enriquecido_em).toLocaleString("pt-BR")}`
                : "Não enriquecido. Roda só sob clique — não é automático."}
            </p>
          </div>
          <EnriquecerLead leadId={id} temPlaceId={!!lead.google_place_id} />
        </div>

        {!lead.enriquecido_em ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-xs text-muted">
            Clique em &ldquo;Enriquecer lead&rdquo; para buscar horários, telefone internacional,
            link do Maps e (opcional) avaliações.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Telefone internacional</dt>
                <dd className="font-mono">
                  {lead.telefone_internacional ? (
                    <a
                      href={`https://wa.me/${lead.telefone_internacional.replace(/[^\d]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {lead.telefone_internacional}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Google Maps</dt>
                <dd>
                  {lead.maps_uri ? (
                    <a
                      href={lead.maps_uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted underline underline-offset-2"
                    >
                      abrir no Maps
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>

            {Array.isArray(lead.horarios) && lead.horarios.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-muted">Horário de funcionamento</p>
                <ul className="text-xs text-muted">
                  {(lead.horarios as string[]).map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            )}

            {detalhes && detalhes.reviews.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <p className="text-xs text-muted">Avaliações recentes ({detalhes.reviews.length})</p>
                {detalhes.reviews.map((r, i) => (
                  <div key={i} className="text-xs">
                    <p className="text-muted">
                      <span className="font-mono">{r.nota ?? "—"}★</span> · {r.autor ?? "anônimo"}
                      {r.quando ? ` · ${r.quando}` : ""}
                    </p>
                    {r.texto && <p className="mt-0.5 text-muted">{r.texto}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Score de Oportunidade</p>
            <p className="text-xs text-muted">
              {score
                ? `${score.versao_formula} · calculado em ${new Date(score.calculado_em).toLocaleString("pt-BR")}` +
                  (det.confianca ? ` · confiança ${det.confianca}` : "")
                : "Ainda não calculado."}
            </p>
          </div>
          <RecalcularScore leadId={id} />
        </div>

        {!score ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-xs text-muted">
            Clique em &ldquo;Recalcular score&rdquo; (ou use o botão &ldquo;Fazer diagnóstico
            completo&rdquo; no topo — ele já inclui isso).
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-4xl font-semibold tabular-nums">{score.total}</span>
              <span className="text-xs text-muted">de 100 · quanto vale a pena prospectar</span>
            </div>

            <ul className="flex flex-col gap-1.5 text-sm">
              {(det.fatores ?? []).map((f) => (
                <li key={f.chave} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ink">
                      <span className="mr-2 inline-block w-6 text-right font-mono font-semibold tabular-nums">
                        {f.pontos}
                      </span>
                      {f.rotulo}
                    </span>
                    <span className="font-mono text-xs text-faint">
                      /{f.peso}
                      {f.confianca !== "alta" ? ` · conf. ${f.confianca}` : ""}
                    </span>
                  </div>
                  <p className="ml-8 text-xs text-muted">{f.motivo}</p>
                </li>
              ))}
            </ul>

            {(det.moderadores ?? []).some((m) => m.aplicado) && (
              <div className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">
                <p className="font-medium">Ajustes aplicados:</p>
                <ul className="mt-1 list-disc pl-4">
                  {(det.moderadores ?? [])
                    .filter((m) => m.aplicado)
                    .map((m) => (
                      <li key={m.chave}>
                        {m.rotulo} (×{m.fator}): {m.motivo}
                      </li>
                    ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-faint">Score não usa IA. Fórmula fixa e versionada.</p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Boletim técnico do site</p>
            <p className="text-xs text-muted">
              {a?.verificado_em
                ? `Verificado em ${new Date(a.verificado_em).toLocaleString("pt-BR")}`
                : "Ainda não analisado."}
            </p>
          </div>
          <AnalisarSite leadId={id} />
        </div>

        {!a ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-xs text-muted">
            Clique em &ldquo;Analisar agora&rdquo; para gerar o boletim.
          </p>
        ) : a.erro && a.site_existe !== true ? (
          <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">
            {a.erro}
            {a.tls_erro ? ` (TLS: ${a.tls_erro})` : ""}
          </p>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              <Check rotulo="Site responde" v={a.site_existe} />
              <Check rotulo="HTTPS" v={a.https} />
              <Check rotulo="TLS/certificado" v={a.tls_ok} />
              <Check rotulo="Mobile (viewport)" v={a.tem_viewport} />
              <Check rotulo="WhatsApp" v={a.tem_whatsapp} />
              <Check rotulo="Telefone" v={a.tem_telefone} />
              <Check rotulo="Formulário" v={a.tem_formulario} />
              <Check rotulo="CTA" v={a.tem_cta} />
              <Check rotulo="Página de contato" v={a.tem_pagina_contato} />
              <Check rotulo="Meta Pixel" v={a.tem_meta_pixel} />
              <Check rotulo="Google Analytics" v={a.tem_ga} />
              <Check rotulo="Google Tag Manager" v={a.tem_gtm} />
              <Check rotulo="Google Ads / conversão" v={a.tem_google_ads} />
              <Check rotulo="DoubleClick / remarketing" v={a.tem_doubleclick} />
            </ul>

            {a.erro && <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">Aviso: {a.erro}</p>}

            <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs sm:grid-cols-4">
              <Dado rotulo="Status HTTP" valor={a.status_http?.toString() ?? "—"} />
              <Dado rotulo="Redirects" valor={a.qtd_redirects?.toString() ?? "—"} />
              <Dado rotulo="Peso da home" valor={a.peso_kb != null ? `${a.peso_kb} kB` : "—"} />
              <Dado rotulo="TTFB" valor={a.ttfb_ms != null ? `${a.ttfb_ms} ms` : "—"} />
              <Dado rotulo="Nota mobile (código)" valor={a.nota_mobile != null ? `${a.nota_mobile}/100` : "—"} />
              <Dado
                rotulo="Performance (PageSpeed)"
                valor={a.nota_desempenho != null ? `${a.nota_desempenho}/100` : "não medida"}
              />
              <Dado rotulo="Servidor" valor={a.servidor ?? "—"} />
              <Dado rotulo="URL final" valor={a.url_final ?? "—"} />
            </dl>

            {Array.isArray(a.stack) && a.stack.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(a.stack as string[]).map((s) => (
                  <span key={s} className="rounded-full bg-soft px-2 py-0.5 text-xs text-muted">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Indícios de tráfego pago</p>
            <p className="text-xs text-muted">
              {ads?.verificado_em
                ? `Verificado em ${new Date(ads.verificado_em).toLocaleString("pt-BR")}`
                : "Ainda não verificado."}
            </p>
          </div>
          <DetectarAds leadId={id} />
        </div>

        {!ads ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-xs text-muted">
            Analise o site do lead — os indícios de anúncio saem em seguida. Ou clique em
            &ldquo;Detectar anúncios&rdquo;.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Pastilha tom={anuncioPastilha.tom}>{anuncioPastilha.texto}</Pastilha>
              <span className="text-xs text-muted">
                confiança <strong>{ads.confianca ?? "—"}</strong>
              </span>
            </div>

            {(() => {
              const ev = (ads.evidencias ?? {}) as { resumo?: string; itens?: unknown };
              const itens = Array.isArray(ev.itens)
                ? (ev.itens as unknown[]).filter((x): x is string => typeof x === "string")
                : [];
              return (
                <>
                  {ev.resumo && <p className="text-sm text-ink">{ev.resumo}</p>}
                  {itens.length > 0 && (
                    <ul className="list-disc pl-4 text-xs text-muted">
                      {itens.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  )}
                </>
              );
            })()}

            <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs sm:grid-cols-3">
              <Dado
                rotulo="Meta Ad Library"
                valor={
                  ads.meta_ads_encontrado === "sim"
                    ? `anúncios ativos${ads.meta_ads_qtd ? ` (${ads.meta_ads_qtd})` : ""}`
                    : ads.meta_ads_encontrado === "desconhecido"
                      ? "desconhecido"
                      : "—"
                }
              />
              <Dado
                rotulo="Tag de conversão no site"
                valor={ads.google_ads_no_site === true ? "sim" : ads.google_ads_no_site === false ? "não" : "—"}
              />
            </dl>

            <p className="text-xs text-faint">
              &ldquo;Sem indício&rdquo; <strong>não</strong> quer dizer que a empresa não anuncia —
              pode anunciar para uma página externa ou só nas redes. Sem IA.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Presença social (objetiva)</p>
            <p className="text-xs text-muted">
              {sociais.length > 0
                ? `Verificado em ${new Date(sociais[0].verificado_em).toLocaleString("pt-BR")}`
                : "Ainda não checado. Complementar — não afeta site nem score."}
            </p>
          </div>
          <AnalisarRedes leadId={id} />
        </div>

        {sociais.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-xs text-muted">
            Clique em &ldquo;Analisar redes&rdquo;. Primeiro procuramos os links no site do lead.
          </p>
        ) : (
          <>
            {(["instagram", "facebook"] as const).map((plat) => {
              const s = sociais.find((x) => x.plataforma === plat);
              return <LinhaSocial key={plat} plataforma={plat} s={s ?? null} />;
            })}
            <p className="text-xs text-faint">
              &ldquo;Não encontrado&rdquo; e &ldquo;desconhecido&rdquo; <strong>não</strong> significam
              que a empresa não tem essa rede. Sem login, sem scraping, sem IA.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function CelulaSinal({
  titulo,
  pastilha,
}: {
  titulo: string;
  pastilha: { texto: string; tom: "ok" | "atencao" | "ruim" | "info" | "neutro" | "apagado" };
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">{titulo}</p>
      <div className="mt-1.5">
        <Pastilha tom={pastilha.tom}>{pastilha.texto}</Pastilha>
      </div>
    </div>
  );
}

function LinhaSocial({
  plataforma,
  s,
}: {
  plataforma: "instagram" | "facebook";
  s: SocialAnalysis | null;
}) {
  const status = s?.status ?? "sem_link";
  const marca =
    status === "encontrado" ? "✓" : status === "nao_encontrado" ? "✗" : status === "sem_link" ? "—" : "?";
  const cor = status === "encontrado" ? "text-ok" : status === "nao_encontrado" ? "text-bad" : "text-faint";
  const rotuloStatus: Record<string, string> = {
    encontrado: "perfil encontrado",
    nao_encontrado: "não encontrado (404)",
    desconhecido: "desconhecido (bloqueio/login)",
    sem_link: "sem link localizado",
  };
  const obj = (s?.objetivo ?? {}) as { bio?: string | null; link_externo?: string | null; origem?: string | null };

  return (
    <div className="border-t border-line pt-2 text-sm first:border-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium capitalize">{plataforma}</span>
        <span className={`font-mono text-xs font-semibold ${cor}`}>
          {marca} {rotuloStatus[status]}
        </span>
      </div>
      {s?.perfil_url && (
        <a
          href={s.perfil_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted underline underline-offset-2"
        >
          {s.perfil_url}
        </a>
      )}
      {status === "encontrado" && (
        <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-4">
          <Dado rotulo="Seguidores" valor={s?.seguidores != null ? s.seguidores.toLocaleString("pt-BR") : "—"} />
          <Dado rotulo="Posts" valor={s?.posts_recentes != null ? String(s.posts_recentes) : "—"} />
          <Dado
            rotulo="Último post"
            valor={s?.ultimo_post_em ? new Date(s.ultimo_post_em).toLocaleDateString("pt-BR") : "n/d"}
          />
          <Dado rotulo="Origem do link" valor={obj.origem === "site" ? "site" : obj.origem === "google_places" ? "Google" : "—"} />
        </dl>
      )}
      {obj.bio && <p className="mt-1 text-xs text-muted">{obj.bio}</p>}
      {obj.link_externo && (
        <a
          href={obj.link_externo}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted underline underline-offset-2"
        >
          link externo: {obj.link_externo}
        </a>
      )}
      {status !== "encontrado" && s?.erro && <p className="mt-0.5 text-xs text-faint">{s.erro}</p>}
    </div>
  );
}

function Check({ rotulo, v }: { rotulo: string; v: boolean | null }) {
  const marca = v === true ? "✓" : v === false ? "✗" : "?";
  const cor = v === true ? "text-ok" : v === false ? "text-bad" : "text-faint";
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-muted">{rotulo}</span>
      <span className={`font-mono font-semibold ${cor}`}>{marca}</span>
    </li>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{rotulo}</dt>
      <dd className="truncate font-mono" title={valor}>
        {valor}
      </dd>
    </div>
  );
}
