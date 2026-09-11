"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { LeadEnriquecido } from "@/lib/leads/tipos";
import { SITE_PASTILHA, pastilhaAnuncio } from "@/lib/leads/apresentacao";
import { Pastilha, SeloScore, botaoClasses } from "@/components/ui";

/**
 * Card do lead (etapa 24): so mostra o que a 1a inspeção automática já
 * coletou - sem tela de selecao, sem espera. O botão "Diagnóstico com IA" leva
 * para a página completa do lead, onde 1 clique roda tudo e mostra o dossiê.
 */
export function CardLead({ lead, onClose }: { lead: LeadEnriquecido; onClose: () => void }) {
  // fecha no Esc
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const site = SITE_PASTILHA[lead.siteSituacao];
  const anuncio = pastilhaAnuncio(lead.vereditoAnuncio, lead.adsAnalisado);
  const redes = pastilhaRedes(lead.temRedeSocial, lead.socialAnalisado);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Resumo de ${lead.nome}`}
        className="w-full max-w-md rounded-xl border border-line bg-card p-5 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{lead.nome}</p>
            {lead.categoria && <p className="text-xs text-muted">{lead.categoria}</p>}
            {lead.endereco && <p className="text-xs text-faint">{lead.endereco}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-faint hover:text-ink">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Score</span>
            <SeloScore score={lead.score} />
            {lead.avaliacao != null && (
              <span className="ml-auto text-xs text-faint tabular-nums">
                ★ {lead.avaliacao} ({lead.qtd_avaliacoes ?? 0})
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <CelulaSinal titulo="Site" pastilha={site} />
            <CelulaSinal titulo="Anúncios" pastilha={anuncio} />
            <CelulaSinal titulo="Redes" pastilha={redes} />
          </div>

          <div className="flex flex-wrap gap-3 border-t border-line pt-3 text-xs text-muted">
            {lead.telefone && <span className="tabular-nums">{lead.telefone}</span>}
            {(lead.site_url ?? "").trim() !== "" && (
              <a href={lead.site_url ?? undefined} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                site
              </a>
            )}
            {lead.instagram_url && (
              <a href={lead.instagram_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                instagram
              </a>
            )}
            {lead.facebook_url && (
              <a href={lead.facebook_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                facebook
              </a>
            )}
            {!lead.telefone && !lead.site_url && !lead.instagram_url && !lead.facebook_url && (
              <span className="text-faint">sem contato coletado</span>
            )}
          </div>

          {lead.temDiagnostico && (
            <p className="text-xs text-accent-ink">✓ diagnóstico com IA já feito para este lead</p>
          )}

          <div className="mt-1 flex justify-between gap-2">
            <button type="button" onClick={onClose} className={botaoClasses("fantasma", "sm")}>
              Fechar
            </button>
            <Link href={`/lead/${lead.id}`} className={botaoClasses("primario", "sm")}>
              {lead.temDiagnostico ? "Ver diagnóstico completo" : "Diagnóstico com IA"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function pastilhaRedes(
  temRedeSocial: boolean,
  socialAnalisado: boolean,
): { texto: string; tom: "ok" | "atencao" | "ruim" | "info" | "neutro" | "apagado" } {
  if (!temRedeSocial) return { texto: "sem link", tom: "neutro" };
  if (!socialAnalisado) return { texto: "a verificar", tom: "apagado" };
  return { texto: "verificado", tom: "ok" };
}

function CelulaSinal({
  titulo,
  pastilha,
}: {
  titulo: string;
  pastilha: { texto: string; tom: "ok" | "atencao" | "ruim" | "info" | "neutro" | "apagado" };
}) {
  return (
    <div className="rounded-lg bg-soft p-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-faint">{titulo}</p>
      <div className="mt-1">
        <Pastilha tom={pastilha.tom}>{pastilha.texto}</Pastilha>
      </div>
    </div>
  );
}
