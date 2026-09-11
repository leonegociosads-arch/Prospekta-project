"use client";

// Card do lead (etapa 29): o "dossiê sem IA".
//
// Abre ao clicar na linha da tabela e mostra TUDO que o Prospekta já sabe sem
// gastar um centavo: pontos fortes e fracos derivados do que foi MEDIDO (cada
// um com a evidência ao lado), boletim do site, conta do score, tráfego pago,
// redes e as avaliações já guardadas no cache local.
//
// O que NÃO cabe aqui é o que só a IA escreve (leitura do negócio, proposta,
// estratégia, mensagem, objeções) - isso continua na página completa, atrás do
// botão explícito, porque é o passo que custa e demora.
//
// Os detalhes são carregados sob demanda, quando o card abre: a tabela segue
// leve e nada é buscado para leads que você nem olhou.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { LeadEnriquecido } from "@/lib/leads/tipos";
import type { FatorScore, ModeradorScore } from "@/lib/score/tipos";
import { SITE_PASTILHA, pastilhaAnuncio, type TomPastilha } from "@/lib/leads/apresentacao";
import { Pastilha, TagFonte, botaoClasses } from "@/components/ui";
import { carregarDetalhesLeadAction } from "./actions";
import type { DetalhesLead, EstadoDetalhes } from "./estado";

type Detalhamento = {
  confianca?: string;
  fatores?: FatorScore[];
  moderadores?: ModeradorScore[];
};

export function CardLead({ lead, onClose }: { lead: LeadEnriquecido; onClose: () => void }) {
  const [estado, setEstado] = useState<EstadoDetalhes>({ status: "carregando" });

  // fecha no Esc
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Carrega os detalhes uma vez, ao abrir. Se o card fechar antes de terminar,
  // a resposta e descartada (nada de setState em componente desmontado).
  // Nao precisa voltar o estado para "carregando" aqui: a tabela monta o card
  // com key={lead.id}, entao trocar de lead cria um componente novo do zero.
  useEffect(() => {
    let vivo = true;
    carregarDetalhesLeadAction(lead.id)
      .then((r) => {
        if (vivo) setEstado(r);
      })
      .catch(() => {
        if (vivo) setEstado({ status: "erro", mensagem: "Falha ao carregar os detalhes." });
      });
    return () => {
      vivo = false;
    };
  }, [lead.id]);

  const sinaisFaixa: Array<{ rotulo: string; texto: string; tom: TomPastilha }> = [
    { rotulo: "Anúncios", ...pastilhaAnuncio(lead.vereditoAnuncio, lead.adsAnalisado) },
    { rotulo: "Site", ...SITE_PASTILHA[lead.siteSituacao] },
    { rotulo: "Redes", ...pastilhaRedes(lead.temRedeSocial, lead.socialAnalisado) },
    { rotulo: "Contato", ...pastilhaContato(lead) },
  ];

  const site = (lead.site_url ?? "").trim();
  const ig = (lead.instagram_url ?? "").trim();
  const fb = (lead.facebook_url ?? "").trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Resumo de ${lead.nome}`}
        className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-line bg-card shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* barra de rótulo */}
        <div className="flex items-center gap-2 border-b border-line bg-soft px-3.5 py-[7px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-faint">
            Resumo do lead · tudo que sabemos sem a IA
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="ml-auto text-[13px] leading-none text-faint hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* cabeçalho: identidade + score grande */}
        <div className="flex flex-wrap items-start justify-between gap-4 px-4 pb-4 pt-[18px] sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[18px] font-semibold leading-tight tracking-tight text-ink">
              {lead.nome}
            </h2>
            <p className="mt-[3px] text-[12.5px] text-muted">
              {[
                lead.categoria,
                lead.endereco,
                lead.avaliacao != null
                  ? `★ ${lead.avaliacao.toLocaleString("pt-BR")} (${lead.qtd_avaliacoes ?? 0} avaliações)`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {lead.status_negocio && lead.status_negocio !== "OPERATIONAL" && (
              <p className="mt-1 text-[12px] font-semibold text-warn">
                Google marca este negócio como {lead.status_negocio}
              </p>
            )}
          </div>

          <div className="flex-shrink-0 text-right">
            <p
              className={`font-mono text-[26px] font-semibold leading-none tabular-nums ${corScore(lead.score)}`}
            >
              {lead.score ?? "—"}
            </p>
            <p className="mt-[3px] text-[10px] font-bold uppercase tracking-[0.08em] text-faint">
              Score
            </p>
          </div>
        </div>

        {/* faixa de sinais: 2x2 no celular, 4 colunas no desktop */}
        <div className="grid grid-cols-2 gap-px border-y border-line bg-line sm:grid-cols-4">
          {sinaisFaixa.map((s) => (
            <div key={s.rotulo} className="bg-card px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-faint">{s.rotulo}</p>
              <div className="mt-[5px]">
                <Pastilha tom={s.tom}>{s.texto}</Pastilha>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          {/* ---------------------------------------- pontos fortes / fracos */}
          {estado.status === "carregando" && (
            <p className="text-[12.5px] text-faint">Lendo o que já foi medido deste lead…</p>
          )}
          {estado.status === "erro" && (
            <p className="rounded-xl bg-warn-soft px-3.5 py-2.5 text-[12.5px] text-warn">
              {estado.mensagem}
            </p>
          )}
          {estado.status === "ok" && <Analise d={estado.detalhes} />}

          {/* ------------------------------------------------- dados básicos */}
          <Secao titulo="Contato e presença">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <Dado rotulo="Categoria" valor={lead.categoria ?? "—"} />
              <Dado
                rotulo="Avaliação no Google"
                valor={
                  lead.avaliacao != null
                    ? `${lead.avaliacao.toLocaleString("pt-BR")} · ${lead.qtd_avaliacoes ?? 0} avaliações`
                    : "sem avaliações"
                }
              />
              <Dado
                rotulo="Telefone"
                valor={lead.telefone ?? "não coletado"}
                href={lead.telefone ? `https://wa.me/${lead.telefone.replace(/\D/g, "")}` : undefined}
              />
              <Dado rotulo="Endereço" valor={lead.endereco ?? "não coletado"} />
              <Dado rotulo="Site" valor={site || "sem site cadastrado"} href={site || undefined} />
              <Dado rotulo="Instagram" valor={ig ? "abrir perfil" : "sem link"} href={ig || undefined} />
              <Dado rotulo="Facebook" valor={fb ? "abrir página" : "sem link"} href={fb || undefined} />
              <Dado
                rotulo="WhatsApp no site"
                valor={
                  lead.temWhatsapp === true
                    ? "encontrado"
                    : lead.temWhatsapp === false
                      ? "não encontrado"
                      : "site ainda não analisado"
                }
              />
              {estado.status === "ok" && estado.detalhes.mapsUri && (
                <Dado rotulo="Google Maps" valor="abrir no Maps" href={estado.detalhes.mapsUri} />
              )}
              {estado.status === "ok" && estado.detalhes.telefoneInternacional && (
                <Dado
                  rotulo="Telefone internacional"
                  valor={estado.detalhes.telefoneInternacional}
                  href={`https://wa.me/${estado.detalhes.telefoneInternacional.replace(/\D/g, "")}`}
                />
              )}
            </dl>
            {estado.status === "ok" && estado.detalhes.horarios.length > 0 && (
              <div className="mt-2.5 border-t border-line pt-2.5">
                <Rotulo>Horário de funcionamento</Rotulo>
                <ul className="mt-1 text-[12px] text-muted">
                  {estado.detalhes.horarios.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
            {estado.status === "ok" && !estado.detalhes.enriquecidoEm && (
              <p className="mt-2 text-[11px] text-faint">
                Este lead ainda não foi enriquecido — horários, telefone internacional e link do
                Maps aparecem depois que você roda o enriquecimento na página completa.
              </p>
            )}
          </Secao>

          {estado.status === "ok" && <Tecnico d={estado.detalhes} />}
        </div>

        {/* rodapé: fechar + o passo caro, explícito */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-soft px-4 py-3 sm:px-5">
          <button type="button" onClick={onClose} className={botaoClasses("fantasma", "sm")}>
            Fechar
          </button>
          {lead.temDiagnostico && (
            <span className="text-[11.5px] text-accent-ink">✓ diagnóstico com IA já feito</span>
          )}
          <Link href={`/lead/${lead.id}`} className={`${botaoClasses("primario", "sm")} ml-auto`}>
            {lead.temDiagnostico ? "Ver dossiê completo" : "Diagnóstico com IA →"}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------- blocos grandes

/** Pontos fortes e fracos MEDIDOS: nada de IA, cada item com sua evidência. */
function Analise({ d }: { d: DetalhesLead }) {
  const { fortes, fracos } = d.sinais;
  if (fortes.length === 0 && fracos.length === 0) {
    return (
      <p className="text-[12.5px] text-faint">
        Ainda não há sinais medidos suficientes. Rode &ldquo;Reprocessar&rdquo; para analisar site,
        score, redes e anúncios deste lead.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Secao titulo="Pontos fortes" tom="ok">
        {fortes.length === 0 ? (
          <Vazio>Nenhum ponto forte objetivo identificado até aqui.</Vazio>
        ) : (
          <ul className="flex flex-col gap-2">
            {fortes.map((s, i) => (
              <Item key={i} marca="✓" cor="text-ok" texto={s.texto} evidencia={s.evidencia} />
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Pontos fracos e dinheiro na mesa" tom="ruim">
        {fracos.length === 0 ? (
          <Vazio>Nenhum problema identificado nos dados coletados até aqui.</Vazio>
        ) : (
          <ul className="flex flex-col gap-2">
            {fracos.map((s, i) => (
              <Item
                key={i}
                marca={s.grave ? "✕" : "!"}
                cor={s.grave ? "text-bad" : "text-warn"}
                texto={s.texto}
                evidencia={s.evidencia}
              />
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}

/** Dados crus: boletim do site, conta do score, tráfego pago, redes, reviews. */
function Tecnico({ d }: { d: DetalhesLead }) {
  const det = (d.score?.detalhamento ?? {}) as Detalhamento;
  const ev = (d.ads?.evidencias ?? {}) as { resumo?: string; itens?: unknown };
  const itensAds = Array.isArray(ev.itens)
    ? (ev.itens as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  return (
    <>
      {/* ------------------------------------------------- boletim do site */}
      {d.site && (
        <Secao titulo="Boletim do site">
          {d.site.erro && d.site.site_existe !== true ? (
            <p className="rounded-lg bg-warn-soft px-3 py-2 text-[12px] text-warn">
              {d.site.erro}
              {d.site.tls_erro ? ` (TLS: ${d.site.tls_erro})` : ""}
            </p>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-x-5 gap-y-1 sm:grid-cols-3">
                <Check rotulo="Responde" v={d.site.site_existe} />
                <Check rotulo="HTTPS" v={d.site.https} />
                <Check rotulo="TLS/certificado" v={d.site.tls_ok} />
                <Check rotulo="Mobile (viewport)" v={d.site.tem_viewport} />
                <Check rotulo="WhatsApp" v={d.site.tem_whatsapp} />
                <Check rotulo="Telefone" v={d.site.tem_telefone} />
                <Check rotulo="Formulário" v={d.site.tem_formulario} />
                <Check rotulo="CTA" v={d.site.tem_cta} />
                <Check rotulo="Página de contato" v={d.site.tem_pagina_contato} />
                <Check rotulo="Meta Pixel" v={d.site.tem_meta_pixel} />
                <Check rotulo="Google Analytics" v={d.site.tem_ga} />
                <Check rotulo="Tag Manager" v={d.site.tem_gtm} />
                <Check rotulo="Google Ads" v={d.site.tem_google_ads} />
                <Check rotulo="DoubleClick" v={d.site.tem_doubleclick} />
              </ul>
              <dl className="mt-2.5 grid grid-cols-2 gap-3 border-t border-line pt-2.5 sm:grid-cols-4">
                <Dado rotulo="Status HTTP" valor={d.site.status_http?.toString() ?? "—"} />
                <Dado rotulo="TTFB" valor={d.site.ttfb_ms != null ? `${d.site.ttfb_ms} ms` : "—"} />
                <Dado
                  rotulo="Nota mobile"
                  valor={d.site.nota_mobile != null ? `${d.site.nota_mobile}/100` : "—"}
                />
                <Dado
                  rotulo="Peso da home"
                  valor={d.site.peso_kb != null ? `${d.site.peso_kb} kB` : "—"}
                />
              </dl>
            </>
          )}
        </Secao>
      )}

      {/* ------------------------------------------------------------ score */}
      {d.score && (det.fatores ?? []).length > 0 && (
        <Secao titulo={`Como o score ${d.score.total} foi formado`}>
          <ul className="flex flex-col gap-1.5">
            {(det.fatores ?? []).map((f) => (
              <li key={f.chave} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span>
                    <span className="mr-2 inline-block w-6 text-right font-mono font-semibold tabular-nums text-ink">
                      {f.pontos}
                    </span>
                    {f.rotulo}
                  </span>
                  <span className="font-mono text-[11px] text-faint">/{f.peso}</span>
                </div>
                <p className="ml-8 text-[11.5px] text-muted">{f.motivo}</p>
              </li>
            ))}
          </ul>
          {(det.moderadores ?? []).some((m) => m.aplicado) && (
            <div className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-[12px] text-warn">
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
        </Secao>
      )}

      {/* ---------------------------------------------------- tráfego pago */}
      {d.ads && (
        <Secao titulo="Tráfego pago">
          {ev.resumo && <p className="text-[12.5px] text-ink">{ev.resumo}</p>}
          {itensAds.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-[12px] text-muted">
              {itensAds.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
          <dl className="mt-2.5 grid grid-cols-2 gap-3 border-t border-line pt-2.5 sm:grid-cols-3">
            <Dado
              rotulo="Meta Ad Library"
              valor={
                d.ads.meta_ads_encontrado === "sim"
                  ? `ativos${d.ads.meta_ads_qtd ? ` (${d.ads.meta_ads_qtd})` : ""}`
                  : d.ads.meta_ads_encontrado === "desconhecido"
                    ? "desconhecido"
                    : "—"
              }
            />
            <Dado
              rotulo="Tag no site"
              valor={
                d.ads.google_ads_no_site === true
                  ? "sim"
                  : d.ads.google_ads_no_site === false
                    ? "não"
                    : "—"
              }
            />
            <Dado rotulo="Confiança" valor={d.ads.confianca ?? "—"} />
          </dl>
          <p className="mt-2 text-[11px] text-faint">
            &ldquo;Sem indício&rdquo; <strong className="text-muted">não</strong> quer dizer que a
            empresa não anuncia — pode anunciar para uma página externa ou só nas redes.
          </p>
        </Secao>
      )}

      {/* ------------------------------------------------------------ redes */}
      {d.sociais.length > 0 && (
        <Secao titulo="Redes sociais">
          <div className="flex flex-col gap-2">
            {d.sociais.map((s) => (
              <div key={s.id} className="border-t border-line pt-2 first:border-0 first:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-medium capitalize text-ink">{s.plataforma}</span>
                  <span className={`font-mono text-[11px] font-semibold ${corStatusSocial(s.status)}`}>
                    {rotuloStatusSocial(s.status)}
                  </span>
                </div>
                {s.perfil_url && (
                  <a
                    href={s.perfil_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-[11.5px] text-muted underline underline-offset-2"
                  >
                    {s.perfil_url}
                  </a>
                )}
                {s.status === "encontrado" && (
                  <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
                    <Dado
                      rotulo="Seguidores"
                      valor={s.seguidores != null ? s.seguidores.toLocaleString("pt-BR") : "—"}
                    />
                    <Dado
                      rotulo="Posts recentes"
                      valor={s.posts_recentes != null ? String(s.posts_recentes) : "—"}
                    />
                    <Dado
                      rotulo="Último post"
                      valor={
                        s.ultimo_post_em
                          ? new Date(s.ultimo_post_em).toLocaleDateString("pt-BR")
                          : "n/d"
                      }
                    />
                  </dl>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-faint">
            &ldquo;Não encontrado&rdquo; e &ldquo;desconhecido&rdquo;{" "}
            <strong className="text-muted">não</strong> significam que a empresa não tem essa rede.
          </p>
        </Secao>
      )}

      {/* ------------------------------------------------------- avaliações */}
      {d.reviews.length > 0 && (
        <Secao titulo={`Avaliações recentes (${d.reviews.length})`}>
          <div className="flex flex-col gap-2">
            {d.reviews.map((r, i) => (
              <div key={i} className="text-[12px]">
                <p className="text-faint">
                  <span className="font-mono text-ink">{r.nota ?? "—"}★</span> · {r.autor ?? "anônimo"}
                  {r.quando ? ` · ${r.quando}` : ""}
                </p>
                {r.texto && <p className="mt-0.5 text-muted">{r.texto}</p>}
              </div>
            ))}
          </div>
        </Secao>
      )}
    </>
  );
}

// ------------------------------------------------------------------ partes

const TOM_BORDA: Record<string, string> = {
  ok: "border-ok/30",
  ruim: "border-bad/30",
  neutro: "border-line",
};

function Secao({
  titulo,
  tom = "neutro",
  children,
}: {
  titulo: string;
  tom?: keyof typeof TOM_BORDA;
  children: ReactNode;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border ${TOM_BORDA[tom]}`}>
      <h3 className="border-b border-line bg-soft px-3.5 py-[7px] text-[11px] font-bold uppercase tracking-[0.06em] text-faint">
        {titulo}
      </h3>
      <div className="px-3.5 py-[11px] text-[12.5px] leading-relaxed">{children}</div>
    </section>
  );
}

function Item({
  marca,
  cor,
  texto,
  evidencia,
}: {
  marca: string;
  cor: string;
  texto: string;
  evidencia: string;
}) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden="true" className={`w-3.5 flex-shrink-0 text-center font-bold ${cor}`}>
        {marca}
      </span>
      <span className="flex-1">
        {texto}
        <TagFonte>{evidencia}</TagFonte>
      </span>
    </li>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return <p className="text-[12px] text-faint">{children}</p>;
}

function Rotulo({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{children}</p>;
}

function Check({ rotulo, v }: { rotulo: string; v: boolean | null }) {
  const marca = v === true ? "✓" : v === false ? "✕" : "?";
  const cor = v === true ? "text-ok" : v === false ? "text-bad" : "text-faint";
  return (
    <li className="flex items-center justify-between gap-2 text-[12px]">
      <span className="text-muted">{rotulo}</span>
      <span className={`font-mono font-semibold ${cor}`}>{marca}</span>
    </li>
  );
}

function Dado({ rotulo, valor, href }: { rotulo: string; valor: string; href?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-faint">{rotulo}</dt>
      <dd className="truncate text-[12.5px] text-ink" title={valor}>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-accent-ink"
          >
            {valor}
          </a>
        ) : (
          valor
        )}
      </dd>
    </div>
  );
}

function corScore(score: number | null): string {
  if (score == null) return "text-faint";
  if (score >= 70) return "text-ok";
  if (score >= 40) return "text-warn";
  return "text-bad";
}

function corStatusSocial(status: string | null): string {
  if (status === "encontrado") return "text-ok";
  if (status === "nao_encontrado") return "text-bad";
  return "text-faint";
}

function rotuloStatusSocial(status: string | null): string {
  if (status === "encontrado") return "✓ perfil encontrado";
  if (status === "nao_encontrado") return "✕ não encontrado (404)";
  if (status === "desconhecido") return "? desconhecido (bloqueio/login)";
  return "— sem link localizado";
}

function pastilhaRedes(
  temRedeSocial: boolean,
  socialAnalisado: boolean,
): { texto: string; tom: TomPastilha } {
  if (!temRedeSocial) return { texto: "sem link", tom: "neutro" };
  if (!socialAnalisado) return { texto: "a verificar", tom: "apagado" };
  return { texto: "verificado", tom: "ok" };
}

/** Contato: WhatsApp confirmado > telefone > nada. Falta de dado = cinza. */
function pastilhaContato(lead: LeadEnriquecido): { texto: string; tom: TomPastilha } {
  if (lead.temWhatsapp === true) return { texto: "WhatsApp", tom: "ok" };
  if ((lead.telefone ?? "").trim() !== "") return { texto: "telefone", tom: "ok" };
  return { texto: "sem contato direto", tom: "neutro" };
}
