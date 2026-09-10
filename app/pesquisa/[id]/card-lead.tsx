"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LeadEnriquecido } from "@/lib/leads/tipos";
import type { ItemResumo, ResumoLead } from "@/lib/lead/resumo";
import { SeloScore } from "@/components/ui";
import { processarLeadAction } from "./actions";
import type { SelecaoLead } from "./estado";

type Fase = "selecao" | "processando" | "resumo";

const ITENS: Array<{ chave: keyof SelecaoLead; rotulo: string; nota: string }> = [
  { chave: "site", rotulo: "Site", nota: "situação, velocidade, WhatsApp, CTA" },
  { chave: "redes", rotulo: "Redes sociais", nota: "Instagram / Facebook ativos" },
  { chave: "anuncio", rotulo: "Anúncios", nota: "indícios de tráfego pago" },
  { chave: "score", rotulo: "Score", nota: "nota de oportunidade" },
  { chave: "ia", rotulo: "Diagnóstico com IA", nota: "≈ US$ 0,01 · precisa do score" },
];

const SELECAO_VAZIA: SelecaoLead = {
  site: false,
  redes: false,
  anuncio: false,
  score: false,
  ia: false,
};

const POLL_MS = 3000;
const TICKS_ATE_AVISO = 10; // ~30s sem o worker -> mostra o aviso

function selo(item: ItemResumo | undefined) {
  if (item === "feito") return <span className="text-ok">✓ pronto</span>;
  if (item === "processando") return <span className="text-warn">processando…</span>;
  return <span className="text-faint">—</span>;
}

export function CardLead({ lead, onClose }: { lead: LeadEnriquecido; onClose: () => void }) {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("selecao");
  const [selecao, setSelecao] = useState<SelecaoLead>(SELECAO_VAZIA);
  const [resumo, setResumo] = useState<ResumoLead | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [demorou, setDemorou] = useState(false);
  const [pending, startTransition] = useTransition();
  const ticks = useRef(0);

  // busca o andamento do lead; devolve o resumo para quem chamou decidir.
  const buscarResumo = useCallback((): Promise<ResumoLead | null> => {
    return fetch(`/lead/${lead.id}/resumo`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<ResumoLead>) : null))
      .then((d) => {
        if (d) setResumo(d);
        return d;
      })
      .catch(() => null);
  }, [lead.id]);

  // carrega o estado atual ao abrir (para os selos da tela de selecao)
  useEffect(() => {
    let vivo = true;
    fetch(`/lead/${lead.id}/resumo`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<ResumoLead>) : null))
      .then((d) => {
        if (vivo && d) setResumo(d);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [lead.id]);

  // fecha no Esc
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // enquanto processa, consulta o resumo periodicamente e para quando zera a fila
  useEffect(() => {
    if (fase !== "processando") return;
    const t = setInterval(async () => {
      ticks.current += 1;
      if (ticks.current >= TICKS_ATE_AVISO) setDemorou(true);
      const d = await buscarResumo();
      if (d && d.jobsAbertos === 0) {
        setFase("resumo");
        router.refresh(); // atualiza a tabela por baixo
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [fase, buscarResumo, router]);

  const marcados = Object.values(selecao).some(Boolean);

  function alternar(chave: keyof SelecaoLead) {
    setSelecao((s) => ({ ...s, [chave]: !s[chave] }));
  }

  function fazerDiagnostico() {
    setErro(null);
    startTransition(async () => {
      const r = await processarLeadAction(lead.id, selecao);
      if (r.status === "erro") {
        setErro(r.mensagem);
        return;
      }
      ticks.current = 0;
      setDemorou(false);
      const d = await buscarResumo();
      setFase(d && d.jobsAbertos === 0 ? "resumo" : "processando");
    });
  }

  const itensSelecionados = ITENS.filter((i) => selecao[i.chave]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Diagnóstico de ${lead.nome}`}
        className="w-full max-w-md rounded-xl border border-line bg-card p-5 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{lead.nome}</p>
            {lead.categoria && <p className="text-xs text-muted">{lead.categoria}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-faint hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* ---------- SELEÇÃO ---------- */}
        {fase === "selecao" && (
          <>
            <p className="mb-3 text-xs text-muted">
              Marque o que quer analisar deste comércio.
            </p>
            <ul className="flex flex-col gap-1">
              {ITENS.map((i) => (
                <li key={i.chave}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-soft">
                    <input
                      type="checkbox"
                      checked={selecao[i.chave]}
                      onChange={() => alternar(i.chave)}
                      className="mt-0.5 accent-[color:var(--accent)]"
                    />
                    <span className="flex-1">
                      <span className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium">{i.rotulo}</span>
                        <span className="text-xs">{selo(resumo?.itens[i.chave])}</span>
                      </span>
                      <span className="text-xs text-muted">{i.nota}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            {erro && (
              <p className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">
                {erro}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-line-strong px-3 py-1.5 text-sm font-medium hover:bg-soft"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={fazerDiagnostico}
                disabled={!marcados || pending}
                className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Agendando…" : "Fazer diagnóstico"}
              </button>
            </div>
          </>
        )}

        {/* ---------- PROCESSANDO ---------- */}
        {fase === "processando" && (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
              Analisando…
            </div>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {itensSelecionados.map((i) => (
                <li key={i.chave} className="flex items-center justify-between gap-2">
                  <span>{i.rotulo}</span>
                  <span className="text-xs">{selo(resumo?.itens[i.chave])}</span>
                </li>
              ))}
            </ul>
            {demorou && (
              <div className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">
                As tarefas estão na fila. Deixe <span className="font-mono">npm run worker</span>{" "}
                rodando no seu PC para elas serem processadas.
                <button
                  type="button"
                  onClick={() => setFase("resumo")}
                  className="mt-1 block underline underline-offset-2"
                >
                  ver o que já tem
                </button>
              </div>
            )}
          </>
        )}

        {/* ---------- RESUMO ---------- */}
        {fase === "resumo" && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Score</span>
              <SeloScore score={resumo?.score ?? lead.score} />
            </div>

            <Linha rotulo="Site">
              {textoSite(resumo?.siteSituacao ?? lead.siteSituacao)}
            </Linha>
            <Linha rotulo="Anúncios">{textoAnuncio(resumo?.vereditoAnuncio ?? lead.vereditoAnuncio)}</Linha>
            <Linha rotulo="Redes sociais">
              {resumo?.temRedeSocial ?? lead.temRedeSocial
                ? resumo?.redesAnalisadas
                  ? "perfil encontrado"
                  : "tem link (não verificado)"
                : "sem link"}
            </Linha>

            {resumo?.diagnostico && !resumo.diagnostico.erro && (
              <div className="rounded-xl border border-line p-3">
                <p className="mb-1 text-xs font-medium text-muted">Diagnóstico com IA</p>
                {resumo.diagnostico.resumo && <p>{resumo.diagnostico.resumo}</p>}
                {resumo.diagnostico.servicoSugerido && (
                  <p className="mt-1 text-xs text-muted">
                    Serviço: {resumo.diagnostico.servicoSugerido}
                  </p>
                )}
                {resumo.diagnostico.anguloComercial && (
                  <p className="text-xs text-muted">Ângulo: {resumo.diagnostico.anguloComercial}</p>
                )}
                {resumo.diagnostico.confianca && (
                  <p className="text-xs text-faint">Confiança: {resumo.diagnostico.confianca}</p>
                )}
              </div>
            )}
            {resumo?.diagnostico?.erro && (
              <p className="rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">
                O diagnóstico com IA falhou: {resumo.diagnostico.erro}
              </p>
            )}

            <div className="mt-1 flex justify-between gap-2">
              <Link
                href={`/lead/${lead.id}`}
                className="rounded-full border border-line-strong px-3 py-1.5 text-sm font-medium hover:bg-soft"
              >
                Ver página completa
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-press"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-xs text-muted">{rotulo}</span>
      <span className="text-right text-sm">{children}</span>
    </div>
  );
}

function textoSite(s: LeadEnriquecido["siteSituacao"]): string {
  return {
    ok: "no ar, responde bem",
    instavel: "instável (lento ou com erro)",
    "fora-do-ar": "fora do ar",
    "nao-analisado": "ainda não analisado",
    "sem-site": "não tem site",
  }[s];
}

function textoAnuncio(v: LeadEnriquecido["vereditoAnuncio"]): string {
  if (v === "forte") return "indícios fortes de que anuncia";
  if (v === "alguns") return "alguns indícios de anúncio";
  if (v === "nenhum") return "sem indício (não confirma que não anuncia)";
  return "ainda não avaliado";
}
