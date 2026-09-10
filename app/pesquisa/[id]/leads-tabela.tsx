"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LeadEnriquecido, SiteSituacao } from "@/lib/leads/tipos";
import {
  aplicarCriterios,
  contarFiltrosAtivos,
  CRITERIOS_PADRAO,
  type CriteriosLeads,
  type FaixaScore,
  type FiltroTriplo,
  type Ordenacao,
} from "@/lib/leads/filtros";
import { EstadoVazio, SeloScore } from "@/components/ui";
import { Favoritar } from "@/app/lead/[id]/favoritar";
import { CardLead } from "./card-lead";
import { processarLeadsEmLoteAction } from "./actions";
import type { AcaoEmLote } from "./estado";

const selectCls =
  "rounded-xl border border-line-strong bg-card px-2 py-1.5 text-xs outline-none focus:border-accent";

/** custo estimado por lead do diagnostico com IA (so para avisar o usuario) */
const CUSTO_IA_POR_LEAD = 0.01;

const SITE_LABEL: Record<SiteSituacao, { texto: string; cls: string }> = {
  ok: { texto: "site ok", cls: "text-ok" },
  instavel: { texto: "site instável", cls: "text-warn" },
  "fora-do-ar": { texto: "site fora do ar", cls: "text-bad" },
  "nao-analisado": { texto: "site não analisado", cls: "text-faint" },
  "sem-site": { texto: "sem site", cls: "text-faint" },
};

function VeredictoAnuncio({ v }: { v: LeadEnriquecido["vereditoAnuncio"] }) {
  if (v === "forte") return <span className="text-ok">anuncia (forte)</span>;
  if (v === "alguns") return <span className="text-ok">indícios de anúncio</span>;
  if (v === "nenhum") return <span className="text-muted">sem indício de anúncio</span>;
  return null;
}

export function LeadsTabela({
  searchId,
  leads,
}: {
  searchId: string;
  leads: LeadEnriquecido[];
}) {
  const router = useRouter();
  const [criterios, setCriterios] = useState<CriteriosLeads>(CRITERIOS_PADRAO);
  const [aberto, setAberto] = useState<LeadEnriquecido | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [loteMsg, setLoteMsg] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const cabecalhoRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof CriteriosLeads>(k: K, v: CriteriosLeads[K]) =>
    setCriterios((c) => ({ ...c, [k]: v }));

  const visiveis = useMemo(() => aplicarCriterios(leads, criterios), [leads, criterios]);
  const ativos = contarFiltrosAtivos(criterios);

  const marcadosVisiveis = visiveis.filter((l) => selecionados.has(l.id));
  const todosMarcados = visiveis.length > 0 && marcadosVisiveis.length === visiveis.length;
  const algunsMarcados = marcadosVisiveis.length > 0 && !todosMarcados;

  // checkbox "marcar todos" no estado "traço" (indeterminado)
  useEffect(() => {
    if (cabecalhoRef.current) cabecalhoRef.current.indeterminate = algunsMarcados;
  }, [algunsMarcados]);

  function alternarLinha(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setLoteMsg(null);
  }

  function alternarTodos() {
    setSelecionados((s) => {
      const n = new Set(s);
      if (todosMarcados) visiveis.forEach((l) => n.delete(l.id));
      else visiveis.forEach((l) => n.add(l.id));
      return n;
    });
    setLoteMsg(null);
  }

  function limparSelecao() {
    setSelecionados(new Set());
    setLoteMsg(null);
  }

  function rodarLote(acao: AcaoEmLote) {
    const ids = [...selecionados];
    if (acao === "diagnostico") {
      const custo = (ids.length * CUSTO_IA_POR_LEAD).toFixed(2);
      if (!window.confirm(`Gerar diagnóstico com IA para ${ids.length} lead(s)? Custo estimado: US$ ${custo}.`)) {
        return;
      }
    }
    setLoteMsg(null);
    startTransition(async () => {
      const r = await processarLeadsEmLoteAction(ids, acao);
      if (r.status !== "ok") {
        setLoteMsg({
          tom: "erro",
          texto: r.status === "erro" ? r.mensagem : "Não foi possível agendar as tarefas.",
        });
        return;
      }
      setSelecionados(new Set());
      setLoteMsg({
        tom: "ok",
        texto: `${r.enfileirados} tarefa(s) agendada(s) para ${r.leads} lead(s). O worker vai processar.`,
      });
      router.refresh();
    });
  }

  if (leads.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum lead ainda"
        descricao="Rode a descoberta acima para o Google trazer as empresas do nicho nesta região."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Leads <span className="text-faint">({visiveis.length}/{leads.length})</span>
        </h2>
        <a
          href={`/pesquisa/${searchId}/export`}
          className="rounded-full border border-line-strong px-2.5 py-1.5 text-xs font-medium hover:bg-soft"
        >
          Exportar CSV
        </a>
      </div>

      {/* Busca */}
      <input
        type="search"
        value={criterios.busca}
        onChange={(e) => set("busca", e.target.value)}
        placeholder="Buscar por nome, categoria, endereço, telefone…"
        className="w-full rounded-xl border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-accent"
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={criterios.faixaScore}
          onChange={(e) => set("faixaScore", e.target.value as FaixaScore)}
          className={selectCls}
          aria-label="Filtrar por score"
        >
          <option value="todos">Score: todos</option>
          <option value="alto">Score ≥ 70</option>
          <option value="medio">Score 40–69</option>
          <option value="baixo">Score &lt; 40</option>
          <option value="sem">Sem score</option>
        </select>

        <select
          value={criterios.site}
          onChange={(e) => set("site", e.target.value as FiltroTriplo)}
          className={selectCls}
          aria-label="Filtrar por site"
        >
          <option value="todos">Site: todos</option>
          <option value="com">Com site</option>
          <option value="sem">Sem site</option>
        </select>

        <select
          value={criterios.anuncio}
          onChange={(e) => set("anuncio", e.target.value as FiltroTriplo)}
          className={selectCls}
          aria-label="Filtrar por sinais de anúncio"
        >
          <option value="todos">Anúncios: todos</option>
          <option value="com">Com sinal de anúncio</option>
          <option value="sem">Sem sinal (site analisado)</option>
        </select>

        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={criterios.soFavoritos}
            onChange={(e) => set("soFavoritos", e.target.checked)}
            className="accent-[color:var(--warn)]"
          />
          Só favoritos
        </label>

        <select
          value={criterios.ordenar}
          onChange={(e) => set("ordenar", e.target.value as Ordenacao)}
          className={`${selectCls} ml-auto`}
          aria-label="Ordenar"
        >
          <option value="score">Ordenar: score</option>
          <option value="avaliacoes">Mais avaliações</option>
          <option value="nome">Nome (A–Z)</option>
          <option value="recentes">Mais recentes</option>
        </select>

        {ativos > 0 && (
          <button
            type="button"
            onClick={() => setCriterios(CRITERIOS_PADRAO)}
            className="text-xs text-muted underline underline-offset-2 hover:text-ink"
          >
            limpar filtros ({ativos})
          </button>
        )}
      </div>

      {/* Barra de ações em lote */}
      {selecionados.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-xs text-accent-ink">
          <span className="font-medium">{selecionados.size} selecionado(s)</span>
          <button
            type="button"
            onClick={() => rodarLote("reprocessar")}
            disabled={pending}
            className="rounded-full border border-line-strong px-2.5 py-1 font-medium hover:bg-soft disabled:opacity-60"
          >
            Reprocessar
          </button>
          <button
            type="button"
            onClick={() => rodarLote("diagnostico")}
            disabled={pending}
            className="rounded-full bg-accent px-2.5 py-1 font-medium text-white hover:bg-accent-press disabled:opacity-60"
          >
            Diagnóstico IA ({selecionados.size}) · ≈ US$ {(selecionados.size * CUSTO_IA_POR_LEAD).toFixed(2)}
          </button>
          <button
            type="button"
            onClick={limparSelecao}
            className="text-muted underline underline-offset-2 hover:text-ink"
          >
            limpar
          </button>
          {pending && <span className="text-faint">agendando…</span>}
        </div>
      )}

      {loteMsg && (
        <p
          className={`rounded-xl px-3 py-2 text-xs ${
            loteMsg.tom === "ok"
              ? "bg-ok-soft text-ok"
              : "bg-bad-soft text-bad"
          }`}
        >
          {loteMsg.texto}
        </p>
      )}

      {visiveis.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum lead com esses filtros"
          descricao="Afrouxe a busca ou os filtros para ver mais empresas."
          acao={
            <button
              type="button"
              onClick={() => setCriterios(CRITERIOS_PADRAO)}
              className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-medium hover:bg-soft"
            >
              Limpar filtros
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-card">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-line bg-soft text-[11px] font-semibold uppercase tracking-wide text-faint">
              <tr>
                <th className="w-8 px-2 py-2">
                  <input
                    ref={cabecalhoRef}
                    type="checkbox"
                    checked={todosMarcados}
                    onChange={alternarTodos}
                    aria-label="Marcar todos os leads visíveis"
                    className="accent-[color:var(--accent)]"
                  />
                </th>
                <th className="w-8 px-2 py-2" />
                <th className="px-2 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Empresa</th>
                <th className="px-3 py-2 font-medium">Contato</th>
                <th className="px-3 py-2 font-medium">Sinais</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => {
                const site = SITE_LABEL[l.siteSituacao];
                const marcado = selecionados.has(l.id);
                return (
                  <tr
                    key={l.id}
                    className={`border-b border-line last:border-0 ${
                      marcado ? "bg-accent-soft" : "hover:bg-soft"
                    }`}
                  >
                    <td className="px-2 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarLinha(l.id)}
                        aria-label={`Selecionar ${l.nome}`}
                        className="mt-0.5 accent-[color:var(--accent)]"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Favoritar leadId={l.id} inicial={l.favorito} tamanho="sm" />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <SeloScore score={l.score} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => setAberto(l)}
                        className="text-left font-medium underline-offset-2 hover:underline"
                      >
                        {l.nome}
                      </button>
                      <div className="text-xs text-muted">
                        {l.categoria ?? "—"}
                        {l.status_negocio && l.status_negocio !== "OPERATIONAL" && (
                          <span className="ml-1 text-warn">· {l.status_negocio}</span>
                        )}
                      </div>
                      {l.avaliacao != null && (
                        <div className="text-xs text-faint tabular-nums">
                          ★ {l.avaliacao} ({l.qtd_avaliacoes ?? 0})
                        </div>
                      )}
                      {l.endereco && <div className="text-xs text-faint">{l.endereco}</div>}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-muted">
                      <div className="flex flex-col gap-0.5">
                        {l.telefone && <span className="tabular-nums">{l.telefone}</span>}
                        {l.temWhatsapp === true && (
                          <span className="text-ok">WhatsApp no site</span>
                        )}
                        <span className="flex flex-wrap gap-2">
                          {(l.site_url ?? "").trim() ? (
                            <a
                              href={l.site_url ?? undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-2"
                            >
                              site
                            </a>
                          ) : null}
                          {l.instagram_url && (
                            <a
                              href={l.instagram_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-2"
                            >
                              instagram
                            </a>
                          )}
                          {l.facebook_url && (
                            <a
                              href={l.facebook_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-2"
                            >
                              facebook
                            </a>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className={site.cls}>{site.texto}</span>
                        <VeredictoAnuncio v={l.vereditoAnuncio} />
                        {l.temDiagnostico && (
                          <span className="text-muted">diagnóstico de IA</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {aberto && <CardLead lead={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}
