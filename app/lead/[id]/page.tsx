import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { AdSignal, AiDiagnosis, Lead, Score, SiteAnalysis, SocialAnalysis } from "@/lib/db-types";
import type { FatorScore, ModeradorScore } from "@/lib/score/tipos";
import { normalizarDetalhes } from "@/lib/enriquecimento/normalizar";
import { AnalisarSite } from "./analisar";
import { RecalcularScore } from "./score";
import { EnriquecerLead } from "./enriquecer";
import { AnalisarRedes } from "./social";
import { GerarDiagnostico } from "./diagnostico";
import { DetectarAds } from "./detectar-ads";
import { Favoritar } from "./favoritar";

export const dynamic = "force-dynamic";

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

  const { data: scoreRaw } = await db
    .from("scores")
    .select("*")
    .eq("lead_id", id)
    .maybeSingle();
  const score = scoreRaw as Score | null;
  const det = (score?.detalhamento ?? {}) as Detalhamento;

  const { data: sociaisRaw } = await db
    .from("social_analyses")
    .select("*")
    .eq("lead_id", id)
    .order("verificado_em", { ascending: false });
  const sociais = (sociaisRaw ?? []) as SocialAnalysis[];

  const { data: diagRaw } = await db
    .from("ai_diagnoses")
    .select("*")
    .eq("lead_id", id)
    .maybeSingle();
  const diag = diagRaw as AiDiagnosis | null;

  const { data: adsRaw } = await db
    .from("ad_signals")
    .select("*")
    .eq("lead_id", id)
    .maybeSingle();
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        {pesquisas[0] && (
          <Link
            href={`/pesquisa/${pesquisas[0].id}`}
            className="text-sm text-muted hover:text-ink"
          >
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
                <p className="text-xs text-muted">
                  Avaliações recentes ({detalhes.reviews.length})
                </p>
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
            Clique em &ldquo;Recalcular score&rdquo; (ou rode a análise de site — o score é
            recalculado junto).
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Diagnóstico comercial (IA)</p>
            <p className="text-xs text-muted">
              {diag
                ? `${diag.modelo} · prompt ${diag.versao_prompt} · ${new Date(
                    diag.atualizado_em ?? diag.criado_em,
                  ).toLocaleString("pt-BR")}` +
                  (diag.custo_usd ? ` · US$ ${Number(diag.custo_usd).toFixed(5)}` : "") +
                  (diag.tokens_entrada != null
                    ? ` · ${(diag.tokens_entrada ?? 0) + (diag.tokens_saida ?? 0)} tokens`
                    : "")
                : "Ainda não gerado. Roda só sob clique (ou no lote do topo) — nunca automático."}
            </p>
          </div>
          <GerarDiagnostico leadId={id} temScore={!!score} />
        </div>

        {!diag ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-xs text-muted">
            A IA lê os dados já coletados (score, site, enriquecimento, redes) e escreve um resumo
            comercial. Ela não inventa: o que falta fica como &ldquo;não avaliado&rdquo;.
          </p>
        ) : diag.erro ? (
          <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">
            {diag.erro}
          </p>
        ) : (
          <>
            {diag.resumo && <p className="text-sm text-ink">{diag.resumo}</p>}

            <ListaDiag titulo="Problemas detectados" itens={diag.problemas} />
            <ListaDiag titulo="Oportunidades" itens={diag.oportunidades} />

            <dl className="grid grid-cols-1 gap-2 border-t border-line pt-3 text-sm sm:grid-cols-2">
              {diag.servico_sugerido && (
                <div>
                  <dt className="text-xs text-muted">Serviço que poderíamos oferecer</dt>
                  <dd>{diag.servico_sugerido}</dd>
                </div>
              )}
              {(diag.angulo_comercial ?? diag.angulo_de_entrada) && (
                <div>
                  <dt className="text-xs text-muted">Melhor ângulo comercial</dt>
                  <dd>{diag.angulo_comercial ?? diag.angulo_de_entrada}</dd>
                </div>
              )}
            </dl>

            <p className="text-xs text-muted">
              Confiança do diagnóstico: <strong>{diag.confianca ?? "—"}</strong>
            </p>

            {Array.isArray(diag.fatos_utilizados) && diag.fatos_utilizados.length > 0 && (
              <details className="text-xs text-muted">
                <summary className="cursor-pointer">
                  Fatos usados ({(diag.fatos_utilizados as string[]).length})
                </summary>
                <ul className="mt-1 list-disc pl-4">
                  {(diag.fatos_utilizados as string[]).map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </details>
            )}

            <p className="text-xs text-faint">
              Texto gerado por {diag.modelo}. Baseado só nos dados do Prospekta — confira antes de usar.
            </p>
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

            {a.erro && (
              <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">
                Aviso: {a.erro}
              </p>
            )}

            <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs sm:grid-cols-4">
              <Dado rotulo="Status HTTP" valor={a.status_http?.toString() ?? "—"} />
              <Dado rotulo="Redirects" valor={a.qtd_redirects?.toString() ?? "—"} />
              <Dado rotulo="Peso da home" valor={a.peso_kb != null ? `${a.peso_kb} kB` : "—"} />
              <Dado rotulo="TTFB" valor={a.ttfb_ms != null ? `${a.ttfb_ms} ms` : "—"} />
              <Dado
                rotulo="Nota mobile (código)"
                valor={a.nota_mobile != null ? `${a.nota_mobile}/100` : "—"}
              />
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
                  <span
                    key={s}
                    className="rounded-full bg-soft px-2 py-0.5 text-xs text-muted"
                  >
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
                : "Ainda não verificado. Roda junto com a análise de site."}
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
              <VeredictoAdsBadge veredito={ads.veredito} />
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
              &ldquo;Nenhum indício&rdquo; <strong>não</strong> quer dizer que a empresa não anuncia —
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
  const cor =
    status === "encontrado"
      ? "text-ok"
      : status === "nao_encontrado"
        ? "text-bad"
        : "text-faint";
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

function VeredictoAdsBadge({ veredito }: { veredito: string | null }) {
  const mapa: Record<string, { txt: string; cls: string }> = {
    forte: { txt: "sinais fortes", cls: "bg-ok-soft text-ok" },
    alguns: { txt: "alguns sinais", cls: "bg-warn-soft text-warn" },
    nenhum: { txt: "nenhum indício", cls: "bg-soft text-muted" },
  };
  const m = veredito ? mapa[veredito] : null;
  if (!m) return <span className="text-xs text-faint">sem veredito</span>;
  return <span className={`rounded-xl px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.txt}</span>;
}

function ListaDiag({ titulo, itens }: { titulo: string; itens: unknown }) {
  const lista = Array.isArray(itens) ? (itens as unknown[]).filter((x): x is string => typeof x === "string") : [];
  if (lista.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{titulo}</p>
      <ul className="list-disc pl-4 text-sm text-ink">
        {lista.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function Check({ rotulo, v }: { rotulo: string; v: boolean | null }) {
  const marca = v === true ? "✓" : v === false ? "✗" : "?";
  const cor =
    v === true
      ? "text-ok"
      : v === false
        ? "text-bad"
        : "text-faint";
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
