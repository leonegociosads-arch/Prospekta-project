"use client";

// Card do lead (etapa 28): o "resumo grande" que abre ao clicar na linha da
// tabela. Mostra TUDO que a primeira inspeção automática já coletou - sem
// espera, sem custo, sem IA. O passo seguinte (diagnóstico com IA, que é caro
// e demora) é um botão explícito que leva para a página completa do lead.
//
// Usa a mesma linguagem visual do dossiê: painel com barra de rótulo, faixa de
// sinais em 4 colunas e tipografia compacta.

import { useEffect } from "react";
import Link from "next/link";
import type { LeadEnriquecido } from "@/lib/leads/tipos";
import { SITE_PASTILHA, pastilhaAnuncio, type TomPastilha } from "@/lib/leads/apresentacao";
import { Pastilha, botaoClasses } from "@/components/ui";

export function CardLead({ lead, onClose }: { lead: LeadEnriquecido; onClose: () => void }) {
  // fecha no Esc
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const sinais: Array<{ rotulo: string; texto: string; tom: TomPastilha }> = [
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Resumo de ${lead.nome}`}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-card shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* barra de rótulo */}
        <div className="flex items-center gap-2 border-b border-line bg-soft px-3.5 py-[7px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-faint">
            Resumo do lead · antes da IA
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
          {sinais.map((s) => (
            <div key={s.rotulo} className="bg-card px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-faint">{s.rotulo}</p>
              <div className="mt-[5px]">
                <Pastilha tom={s.tom}>{s.texto}</Pastilha>
              </div>
            </div>
          ))}
        </div>

        {/* dados coletados */}
        <div className="px-4 py-4 sm:px-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-faint">
            O que já foi coletado
          </p>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
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
            <Dado rotulo="Instagram" valor={ig ? "perfil no Google" : "sem link"} href={ig || undefined} />
            <Dado rotulo="Facebook" valor={fb ? "página no Google" : "sem link"} href={fb || undefined} />
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
          </dl>

          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            &ldquo;Não encontrado&rdquo; e &ldquo;sem link&rdquo; querem dizer que nós não achamos —
            não que a empresa não tenha. O diagnóstico com IA lê tudo isso junto e escreve a
            proposta comercial.
          </p>
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

// ------------------------------------------------------------------ partes

function corScore(score: number | null): string {
  if (score == null) return "text-faint";
  if (score >= 70) return "text-ok";
  if (score >= 40) return "text-warn";
  return "text-bad";
}

function Dado({ rotulo, valor, href }: { rotulo: string; valor: string; href?: string }) {
  return (
    <div className="min-w-0 border-b border-line pb-1.5 last:border-0">
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
