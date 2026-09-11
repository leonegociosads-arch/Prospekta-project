"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LeadEnriquecido } from "@/lib/leads/tipos";
import {
  aplicarCriterios,
  contarFiltrosAtivos,
  CRITERIOS_PADRAO,
  type CriteriosLeads,
  type Ordenacao,
} from "@/lib/leads/filtros";
import { EstadoVazio, Pastilha, SeloScore } from "@/components/ui";
import { SITE_PASTILHA, pastilhaAnuncio } from "@/lib/leads/apresentacao";
import { Favoritar } from "@/app/lead/[id]/favoritar";
import { CardLead } from "./card-lead";
import { processarLeadsEmLoteAction } from "./actions";
import type { AcaoEmLote } from "./estado";

const selectCls =
  "rounded-xl border border-line-strong bg-card px-2 py-1.5 text-xs outline-none focus:border-accent";

/** custo estimado por lead do diagnostico com IA (so para avisar o usuario) */
const CUSTO_IA_POR_LEAD = 0.01;

/** ---- filtros rapidos: cada "pilula" liga/desliga UM criterio ---- */
type FiltroRapido = {
  id: string;
  rotulo: string;
  ativo: (c: CriteriosLeads) => boolean;
  ligar: (c: CriteriosLeads) => CriteriosLeads;
};

const FILTROS_RAPIDOS: FiltroRapido[] = [
  {
    id: "alto",
    rotulo: "Nota alta",
    ativo: (c) => c.faixaScore === "alto",
    ligar: (c) => ({ ...c, faixaScore: c.faixaScore === "alto" ? "todos" : "alto" }),
  },
  {
    id: "medio",
    rotulo: "Nota média",
    ativo: (c) => c.faixaScore === "medio",
    ligar: (c) => ({ ...c, faixaScore: c.faixaScore === "medio" ? "todos" : "medio" }),
  },
  {
    id: "anuncia",
    rotulo: "Anuncia",
    ativo: (c) => c.anuncio === "com",
    ligar: (c) => ({ ...c, anuncio: c.anuncio === "com" ? "todos" : "com" }),
  },
  {
    id: "sem-anuncio",
    rotulo: "Sem indício de anúncio",
    ativo: (c) => c.anuncio === "sem",
    ligar: (c) => ({ ...c, anuncio: c.anuncio === "sem" ? "todos" : "sem" }),
  },
  {
    id: "sem-site",
    rotulo: "Sem site",
    ativo: (c) => c.site === "sem",
    ligar: (c) => ({ ...c, site: c.site === "sem" ? "todos" : "sem" }),
  },
  {
    id: "favoritos",
    rotulo: "Favoritos",
    ativo: (c) => c.soFavoritos,
    ligar: (c) => ({ ...c, soFavoritos: !c.soFavoritos }),
  },
];

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

      {/* Filtros rápidos: um clique liga/desliga */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCriterios(CRITERIOS_PADRAO)}
          aria-pressed={ativos === 0}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            ativos === 0
              ? "border-accent bg-accent text-white"
              : "border-line-strong bg-card text-muted hover:bg-soft"
          }`}
        >
          Todos
        </button>

        {FILTROS_RAPIDOS.map((f) => {
          const on = f.ativo(criterios);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setCriterios((c) => f.ligar(c))}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                on
                  ? "border-accent bg-accent text-white"
                  : "border-line-strong bg-card text-muted hover:bg-soft"
              }`}
            >
              {f.rotulo}
            </button>
          );
        })}

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
      </div>

      {/* Barra de ações em lote */}
      {selecionados.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border-l-2 border-accent bg-soft px-3 py-2 text-xs">
          <span className="font-semibold">{selecionados.size} selecionado(s)</span>
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
            loteMsg.tom === "ok" ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"
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
          <table className="w-full min-w-[720px] text-left text-sm">
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
                <th className="w-8 px-1 py-2" />
                <th className="w-16 px-2 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Empresa</th>
                <th className="w-36 px-3 py-2 font-medium">Anúncios</th>
                <th className="w-28 px-3 py-2 font-medium">Site</th>
                <th className="w-24 px-3 py-2 font-medium">Redes</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => {
                const site = SITE_PASTILHA[l.siteSituacao];
                const anuncio = pastilhaAnuncio(l.vereditoAnuncio, l.adsAnalisado);
                const marcado = selecionados.has(l.id);
                return (
                  <tr
                    key={l.id}
                    className={`border-b border-line last:border-0 ${
                      marcado ? "bg-accent-soft" : "hover:bg-soft"
                    }`}
                  >
                    <td className="px-2 py-2.5 align-top">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarLinha(l.id)}
                        aria-label={`Selecionar ${l.nome}`}
                        className="mt-0.5 accent-[color:var(--accent)]"
                      />
                    </td>
                    <td className="px-1 py-2.5 align-top">
                      <Favoritar leadId={l.id} inicial={l.favorito} tamanho="sm" />
                    </td>
                    <td className="px-2 py-2.5 align-top">
                      <SeloScore score={l.score} />
                    </td>
                    <td className="px-3 py-2.5 align-top">
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
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-faint">
                        {l.avaliacao != null && (
                          <span className="tabular-nums">
                            ★ {l.avaliacao} ({l.qtd_avaliacoes ?? 0})
                          </span>
                        )}
                        {l.telefone && <span className="tabular-nums">{l.telefone}</span>}
                        {l.temDiagnostico && <span className="text-info">diagnóstico de IA</span>}
                      </div>
                      {l.endereco && <div className="text-xs text-faint">{l.endereco}</div>}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Pastilha tom={anuncio.tom}>{anuncio.texto}</Pastilha>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Pastilha tom={site.tom}>{site.texto}</Pastilha>
                      {l.temWhatsapp === true && (
                        <div className="mt-1 text-[11px] font-medium text-ok">WhatsApp no site</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex gap-1">
                        <SeloRede on={(l.instagram_url ?? "").trim() !== ""} sigla="IG" titulo="Instagram" url={l.instagram_url} />
                        <SeloRede on={(l.facebook_url ?? "").trim() !== ""} sigla="FB" titulo="Facebook" url={l.facebook_url} />
                        <SeloRede on={(l.site_url ?? "").trim() !== ""} sigla="WWW" titulo="Site" url={l.site_url} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-faint">
        <span className="font-semibold text-muted">Cores:</span>{" "}
        <span className="text-ok">verde</span> = confirmado ·{" "}
        <span className="text-warn">amarelo</span> = parcial, olhar melhor ·{" "}
        <span className="text-bad">vermelho</span> = problema (= oportunidade de venda) ·{" "}
        cinza = não deu para checar (não é &ldquo;não&rdquo;). Clique no nome para o diagnóstico completo.
      </p>

      {aberto && <CardLead lead={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}

/** Quadradinho de rede social: aceso quando existe o link; abre em nova aba. */
function SeloRede({
  on,
  sigla,
  titulo,
  url,
}: {
  on: boolean;
  sigla: string;
  titulo: string;
  url: string | null;
}) {
  const base =
    "grid h-5 min-w-[1.75rem] place-items-center rounded-md px-1 text-[9px] font-bold tabular-nums";
  if (on && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={`${titulo} (abrir)`}
        className={`${base} bg-ok-soft text-ok hover:opacity-80`}
      >
        {sigla}
      </a>
    );
  }
  return (
    <span title={`Sem ${titulo}`} className={`${base} bg-soft text-faint`}>
      {sigla}
    </span>
  );
}
