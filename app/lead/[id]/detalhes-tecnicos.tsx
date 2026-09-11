// Dados de suporte da pagina do lead (etapa 25): tudo que a pagina ja mostrava
// continua aqui, mas em sanfonas compactas, abaixo do dossie comercial - para
// nao competir com a leitura de venda. Cada sanfona traz a acao individual
// correspondente (reprocessar so aquela parte).

import type { ReactNode } from "react";
import type { AdSignal, Lead, Score, SiteAnalysis, SocialAnalysis } from "@/lib/db-types";
import type { FatorScore, ModeradorScore } from "@/lib/score/tipos";
import { AnalisarSite } from "./analisar";
import { RecalcularScore } from "./score";
import { EnriquecerLead } from "./enriquecer";
import { AnalisarRedes } from "./social";
import { DetectarAds } from "./detectar-ads";

type Detalhamento = {
  confianca?: string;
  fatores?: FatorScore[];
  moderadores?: ModeradorScore[];
};

type Review = { nota: number | null; autor: string | null; quando: string | null; texto: string | null };

export function DetalhesTecnicos({
  leadId,
  lead,
  site,
  score,
  ads,
  sociais,
  reviews,
}: {
  leadId: string;
  lead: Lead;
  site: SiteAnalysis | null;
  score: Score | null;
  ads: AdSignal | null;
  sociais: SocialAnalysis[];
  reviews: Review[];
}) {
  const det = (score?.detalhamento ?? {}) as Detalhamento;

  return (
    <div className="flex flex-col gap-2">
      {/* -------------------------------------------------- enriquecimento */}
      <Sanfona
        titulo="Enriquecimento"
        resumo={
          lead.enriquecido_em
            ? `em ${new Date(lead.enriquecido_em).toLocaleDateString("pt-BR")}`
            : "não rodado"
        }
        acao={<EnriquecerLead leadId={leadId} temPlaceId={!!lead.google_place_id} />}
      >
        {!lead.enriquecido_em ? (
          <p className="text-[12.5px] text-faint">
            Não enriquecido. Roda só sob clique (usa 1 chamada paga do Google Place Details) e traz
            horários, telefone internacional, link do Maps e avaliações.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Dado
                rotulo="Telefone internacional"
                valor={lead.telefone_internacional ?? "—"}
                href={
                  lead.telefone_internacional
                    ? `https://wa.me/${lead.telefone_internacional.replace(/[^\d]/g, "")}`
                    : undefined
                }
              />
              <Dado rotulo="Google Maps" valor={lead.maps_uri ? "abrir no Maps" : "—"} href={lead.maps_uri ?? undefined} />
            </dl>

            {Array.isArray(lead.horarios) && lead.horarios.length > 0 && (
              <div>
                <Rotulo>Horário de funcionamento</Rotulo>
                <ul className="mt-1 text-[12px] text-muted">
                  {(lead.horarios as string[]).map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            )}

            {reviews.length > 0 && (
              <div className="border-t border-line pt-2.5">
                <Rotulo>Avaliações recentes ({reviews.length})</Rotulo>
                <div className="mt-1.5 flex flex-col gap-2">
                  {reviews.map((r, i) => (
                    <div key={i} className="text-[12px]">
                      <p className="text-faint">
                        <span className="font-mono text-ink">{r.nota ?? "—"}★</span> ·{" "}
                        {r.autor ?? "anônimo"}
                        {r.quando ? ` · ${r.quando}` : ""}
                      </p>
                      {r.texto && <p className="mt-0.5 text-muted">{r.texto}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Sanfona>

      {/* ------------------------------------------------------------- score */}
      <Sanfona
        titulo="Score detalhado"
        resumo={score ? `${score.total}/100${det.confianca ? ` · conf. ${det.confianca}` : ""}` : "não calculado"}
        acao={<RecalcularScore leadId={leadId} />}
      >
        {!score ? (
          <p className="text-[12.5px] text-faint">
            Ainda não calculado. O botão &ldquo;Refazer análise&rdquo; no painel acima já inclui isso.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col gap-1.5">
              {(det.fatores ?? []).map((f) => (
                <li key={f.chave} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span>
                      <span className="mr-2 inline-block w-6 text-right font-mono font-semibold tabular-nums text-ink">
                        {f.pontos}
                      </span>
                      {f.rotulo}
                    </span>
                    <span className="font-mono text-[11px] text-faint">
                      /{f.peso}
                      {f.confianca !== "alta" ? ` · conf. ${f.confianca}` : ""}
                    </span>
                  </div>
                  <p className="ml-8 text-[11.5px] text-muted">{f.motivo}</p>
                </li>
              ))}
            </ul>

            {(det.moderadores ?? []).some((m) => m.aplicado) && (
              <div className="rounded-lg bg-warn-soft px-3 py-2 text-[12px] text-warn">
                <p className="font-semibold">Ajustes aplicados:</p>
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
            <p className="text-[11px] text-faint">
              {score.versao_formula} · calculado em{" "}
              {new Date(score.calculado_em).toLocaleString("pt-BR")}. Fórmula fixa, sem IA.
            </p>
          </div>
        )}
      </Sanfona>

      {/* -------------------------------------------------------------- site */}
      <Sanfona
        titulo="Boletim do site"
        resumo={
          site?.verificado_em
            ? `em ${new Date(site.verificado_em).toLocaleDateString("pt-BR")}`
            : "não analisado"
        }
        acao={<AnalisarSite leadId={leadId} />}
      >
        {!site ? (
          <p className="text-[12.5px] text-faint">Ainda não analisado.</p>
        ) : site.erro && site.site_existe !== true ? (
          <p className="rounded-lg bg-warn-soft px-3 py-2 text-[12px] text-warn">
            {site.erro}
            {site.tls_erro ? ` (TLS: ${site.tls_erro})` : ""}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="grid grid-cols-2 gap-x-5 gap-y-1 sm:grid-cols-3">
              <Check rotulo="Responde" v={site.site_existe} />
              <Check rotulo="HTTPS" v={site.https} />
              <Check rotulo="TLS/certificado" v={site.tls_ok} />
              <Check rotulo="Mobile (viewport)" v={site.tem_viewport} />
              <Check rotulo="WhatsApp" v={site.tem_whatsapp} />
              <Check rotulo="Telefone" v={site.tem_telefone} />
              <Check rotulo="Formulário" v={site.tem_formulario} />
              <Check rotulo="CTA" v={site.tem_cta} />
              <Check rotulo="Página de contato" v={site.tem_pagina_contato} />
              <Check rotulo="Meta Pixel" v={site.tem_meta_pixel} />
              <Check rotulo="Google Analytics" v={site.tem_ga} />
              <Check rotulo="Tag Manager" v={site.tem_gtm} />
              <Check rotulo="Google Ads" v={site.tem_google_ads} />
              <Check rotulo="DoubleClick" v={site.tem_doubleclick} />
            </ul>

            {site.erro && (
              <p className="rounded-lg bg-warn-soft px-3 py-2 text-[12px] text-warn">Aviso: {site.erro}</p>
            )}

            <dl className="grid grid-cols-2 gap-3 border-t border-line pt-2.5 sm:grid-cols-4">
              <Dado rotulo="Status HTTP" valor={site.status_http?.toString() ?? "—"} />
              <Dado rotulo="Redirects" valor={site.qtd_redirects?.toString() ?? "—"} />
              <Dado rotulo="Peso da home" valor={site.peso_kb != null ? `${site.peso_kb} kB` : "—"} />
              <Dado rotulo="TTFB" valor={site.ttfb_ms != null ? `${site.ttfb_ms} ms` : "—"} />
              <Dado rotulo="Nota mobile" valor={site.nota_mobile != null ? `${site.nota_mobile}/100` : "—"} />
              <Dado
                rotulo="PageSpeed"
                valor={site.nota_desempenho != null ? `${site.nota_desempenho}/100` : "não medida"}
              />
              <Dado rotulo="Servidor" valor={site.servidor ?? "—"} />
              <Dado rotulo="URL final" valor={site.url_final ?? "—"} />
            </dl>

            {Array.isArray(site.stack) && site.stack.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(site.stack as string[]).map((s) => (
                  <span key={s} className="rounded-full bg-soft px-2 py-0.5 text-[11px] text-muted">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Sanfona>

      {/* ----------------------------------------------------------- trafego */}
      <Sanfona
        titulo="Tráfego pago"
        resumo={ads?.veredito ? rotuloVeredito(ads.veredito) : ads ? "sem base" : "não verificado"}
        acao={<DetectarAds leadId={leadId} />}
      >
        {!ads ? (
          <p className="text-[12.5px] text-faint">Ainda não verificado.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {(() => {
              const ev = (ads.evidencias ?? {}) as { resumo?: string; itens?: unknown };
              const itens = Array.isArray(ev.itens)
                ? (ev.itens as unknown[]).filter((x): x is string => typeof x === "string")
                : [];
              return (
                <>
                  {ev.resumo && <p className="text-[13px] text-ink">{ev.resumo}</p>}
                  {itens.length > 0 && (
                    <ul className="list-disc pl-4 text-[12px] text-muted">
                      {itens.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  )}
                </>
              );
            })()}

            <dl className="grid grid-cols-2 gap-3 border-t border-line pt-2.5 sm:grid-cols-3">
              <Dado
                rotulo="Meta Ad Library"
                valor={
                  ads.meta_ads_encontrado === "sim"
                    ? `ativos${ads.meta_ads_qtd ? ` (${ads.meta_ads_qtd})` : ""}`
                    : ads.meta_ads_encontrado === "desconhecido"
                      ? "desconhecido"
                      : "—"
                }
              />
              <Dado
                rotulo="Tag no site"
                valor={ads.google_ads_no_site === true ? "sim" : ads.google_ads_no_site === false ? "não" : "—"}
              />
              <Dado rotulo="Confiança" valor={ads.confianca ?? "—"} />
            </dl>

            <p className="text-[11px] text-faint">
              &ldquo;Sem indício&rdquo; <strong className="text-muted">não</strong> quer dizer que a
              empresa não anuncia — pode anunciar para uma página externa ou só nas redes.
            </p>
          </div>
        )}
      </Sanfona>

      {/* ------------------------------------------------------------- redes */}
      <Sanfona
        titulo="Redes sociais"
        resumo={
          sociais.length === 0
            ? "não checado"
            : sociais.some((s) => s.status === "encontrado")
              ? "perfil encontrado"
              : "sem perfil confirmado"
        }
        acao={<AnalisarRedes leadId={leadId} />}
      >
        {sociais.length === 0 ? (
          <p className="text-[12.5px] text-faint">
            Ainda não checado. Primeiro procuramos os links no site do lead.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {(["instagram", "facebook"] as const).map((plat) => (
              <LinhaSocial key={plat} plataforma={plat} s={sociais.find((x) => x.plataforma === plat) ?? null} />
            ))}
            <p className="text-[11px] text-faint">
              &ldquo;Não encontrado&rdquo; e &ldquo;desconhecido&rdquo;{" "}
              <strong className="text-muted">não</strong> significam que a empresa não tem essa rede.
              Sem login, sem scraping, sem IA.
            </p>
          </div>
        )}
      </Sanfona>
    </div>
  );
}

// ------------------------------------------------------------------ partes

function Sanfona({
  titulo,
  resumo,
  acao,
  children,
}: {
  titulo: string;
  resumo: string;
  acao: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="group overflow-hidden rounded-xl border border-line bg-card">
      <summary className="flex cursor-pointer select-none list-none items-center gap-2 px-3.5 py-2.5 marker:hidden hover:bg-soft">
        <span
          aria-hidden="true"
          className="text-[11px] text-faint transition-transform group-open:rotate-90"
        >
          ▶
        </span>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{titulo}</span>
        <span className="ml-auto font-mono text-[11px] text-faint">{resumo}</span>
      </summary>
      <div className="border-t border-line px-3.5 py-3">
        {children}
        <div className="mt-3 flex justify-end border-t border-line pt-2.5">{acao}</div>
      </div>
    </details>
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{children}</p>;
}

function Check({ rotulo, v }: { rotulo: string; v: boolean | null }) {
  const marca = v === true ? "✓" : v === false ? "✕" : "?";
  const cor = v === true ? "text-ok" : v === false ? "text-bad" : "text-faint";
  return (
    <li className="flex items-center justify-between gap-2 text-[12.5px]">
      <span className="text-muted">{rotulo}</span>
      <span className={`font-mono font-semibold ${cor}`}>{marca}</span>
    </li>
  );
}

function Dado({ rotulo, valor, href }: { rotulo: string; valor: string; href?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-faint">{rotulo}</dt>
      <dd className="truncate font-mono text-[12px] text-muted" title={valor}>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {valor}
          </a>
        ) : (
          valor
        )}
      </dd>
    </div>
  );
}

function rotuloVeredito(v: string): string {
  if (v === "forte") return "indícios fortes";
  if (v === "alguns") return "alguns indícios";
  if (v === "nenhum") return "sem indício";
  return v;
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
    status === "encontrado" ? "✓" : status === "nao_encontrado" ? "✕" : status === "sem_link" ? "—" : "?";
  const cor = status === "encontrado" ? "text-ok" : status === "nao_encontrado" ? "text-bad" : "text-faint";
  const rotuloStatus: Record<string, string> = {
    encontrado: "perfil encontrado",
    nao_encontrado: "não encontrado (404)",
    desconhecido: "desconhecido (bloqueio/login)",
    sem_link: "sem link localizado",
  };
  const obj = (s?.objetivo ?? {}) as { bio?: string | null; link_externo?: string | null; origem?: string | null };

  return (
    <div className="border-t border-line pt-2 first:border-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium capitalize text-ink">{plataforma}</span>
        <span className={`font-mono text-[11px] font-semibold ${cor}`}>
          {marca} {rotuloStatus[status]}
        </span>
      </div>
      {s?.perfil_url && (
        <a
          href={s.perfil_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11.5px] text-muted underline underline-offset-2"
        >
          {s.perfil_url}
        </a>
      )}
      {status === "encontrado" && (
        <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-4">
          <Dado rotulo="Seguidores" valor={s?.seguidores != null ? s.seguidores.toLocaleString("pt-BR") : "—"} />
          <Dado rotulo="Posts" valor={s?.posts_recentes != null ? String(s.posts_recentes) : "—"} />
          <Dado
            rotulo="Último post"
            valor={s?.ultimo_post_em ? new Date(s.ultimo_post_em).toLocaleDateString("pt-BR") : "n/d"}
          />
          <Dado
            rotulo="Origem"
            valor={obj.origem === "site" ? "site" : obj.origem === "google_places" ? "Google" : "—"}
          />
        </dl>
      )}
      {obj.bio && <p className="mt-1 text-[12px] text-muted">{obj.bio}</p>}
      {status !== "encontrado" && s?.erro && <p className="mt-0.5 text-[11px] text-faint">{s.erro}</p>}
    </div>
  );
}
