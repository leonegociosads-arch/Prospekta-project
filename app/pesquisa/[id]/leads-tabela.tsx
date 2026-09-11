"use client";

// Tabela de leads da pesquisa (etapa 27): um SELO POR SINAL.
//
// A ideia e varrer 20 empresas em segundos: cada coluna responde UMA pergunta
// so, com cor fixa (verde = confirmado, amarelo = parcial, vermelho = problema
// e portanto oportunidade, cinza = nao deu para checar). Linha densa, uma por
// empresa, sem cartao.
//
// Nada de logica mudou aqui: filtros, ordenacao, selecao em lote, favorito e
// as acoes continuam os mesmos - so a apresentacao foi reconstruida.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LeadEnriquecido } from "@/lib/leads/tipos";
import {
  aplicarCriterios,
  contarFiltrosAtivos,
  CRITERIOS_PADRAO,
  FAIXA_SCORE_ALTO,
  FAIXA_SCORE_MEDIO,
  type CriteriosLeads,
  type Ordenacao,
} from "@/lib/leads/filtros";
import { EstadoVazio, Pastilha } from "@/components/ui";
import { SITE_PASTILHA, pastilhaAnuncio } from "@/lib/leads/apresentacao";
import { Favoritar } from "@/app/lead/[id]/favoritar";
import { CardLead } from "./card-lead";
import { processarLeadsEmLoteAction } from "./actions";
import type { AcaoEmLote } from "./estado";

const selectCls =
  "rounded-full border border-line-strong bg-card px-2.5 py-[3px] text-[11.5px] text-muted outline-none focus:border-accent";

/** custo estimado por lead do diagnostico com IA (so para avisar o usuario) */
const CUSTO_IA_POR_LEAD = 0.01;

/** ---- filtros rapidos: cada "pilula" liga/desliga UM criterio ----
 *  `conta` diz quantos leads da pesquisa caem naquele filtro. E a MESMA regra
 *  que o filtro aplica (lib/leads/filtros.ts), para o numero nunca mentir. */
type FiltroRapido = {
  id: string;
  rotulo: string;
  ativo: (c: CriteriosLeads) => boolean;
  ligar: (c: CriteriosLeads) => CriteriosLeads;
  conta: (l: LeadEnriquecido) => boolean;
};

const FILTROS_RAPIDOS: FiltroRapido[] = [
  {
    id: "alto",
    rotulo: "Nota alta",
    ativo: (c) => c.faixaScore === "alto",
    ligar: (c) => ({ ...c, faixaScore: c.faixaScore === "alto" ? "todos" : "alto" }),
    conta: (l) => l.score != null && l.score >= FAIXA_SCORE_ALTO,
  },
  {
    id: "medio",
    rotulo: "Nota média",
    ativo: (c) => c.faixaScore === "medio",
    ligar: (c) => ({ ...c, faixaScore: c.faixaScore === "medio" ? "todos" : "medio" }),
    conta: (l) => l.score != null && l.score >= FAIXA_SCORE_MEDIO && l.score < FAIXA_SCORE_ALTO,
  },
  {
    id: "anuncia",
    rotulo: "Anuncia",
    ativo: (c) => c.anuncio === "com",
    ligar: (c) => ({ ...c, anuncio: c.anuncio === "com" ? "todos" : "com" }),
    conta: (l) => l.temSinalAnuncio === true,
  },
  {
    // NUNCA "nao anuncia": e ausencia de evidencia, nao prova.
    id: "sem-anuncio",
    rotulo: "Sem indício",
    ativo: (c) => c.anuncio === "sem",
    ligar: (c) => ({ ...c, anuncio: c.anuncio === "sem" ? "todos" : "sem" }),
    conta: (l) => l.temSinalAnuncio === false,
  },
  {
    id: "sem-site",
    rotulo: "Sem site",
    ativo: (c) => c.site === "sem",
    ligar: (c) => ({ ...c, site: c.site === "sem" ? "todos" : "sem" }),
    conta: (l) => (l.site_url ?? "").trim() === "",
  },
  {
    id: "favoritos",
    rotulo: "Favoritos",
    ativo: (c) => c.soFavoritos,
    ligar: (c) => ({ ...c, soFavoritos: !c.soFavoritos }),
    conta: (l) => l.favorito,
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

  // contagem de cada pilula, sobre a pesquisa inteira (nao sobre o filtrado)
  const contagens = useMemo(
    () => FILTROS_RAPIDOS.map((f) => leads.filter(f.conta).length),
    [leads],
  );

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

  /** Clique na linha abre o lead - menos quando o clique foi num controle
   *  (checkbox, estrela, link, botao), para nao navegar sem querer. */
  function aoClicarLinha(e: ReactMouseEvent<HTMLTableRowElement>, id: string) {
    if ((e.target as HTMLElement).closest("a,button,input,label")) return;
    router.push(`/lead/${id}`);
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
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Leads <span className="text-faint">({visiveis.length}/{leads.length})</span>
        </h2>
        <a
          href={`/pesquisa/${searchId}/export`}
          className="rounded-full border border-line-strong px-2.5 py-[3px] text-[11.5px] font-medium text-muted hover:bg-soft"
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
        className="w-full rounded-xl border border-line-strong bg-card px-3 py-1.5 text-[13px] outline-none focus:border-accent"
      />

      {/* Filtros rápidos: um clique liga/desliga, com a contagem real ao lado */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Pilula on={ativos === 0} conta={leads.length} onClick={() => setCriterios(CRITERIOS_PADRAO)}>
          Todos
        </Pilula>

        {FILTROS_RAPIDOS.map((f, i) => (
          <Pilula
            key={f.id}
            on={f.ativo(criterios)}
            conta={contagens[i]}
            onClick={() => setCriterios((c) => f.ligar(c))}
          >
            {f.rotulo}
          </Pilula>
        ))}

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
        <div className="flex flex-wrap items-center gap-2 rounded-xl border-l-2 border-accent bg-soft px-3 py-2">
          <span className="text-[12.5px] font-semibold">{selecionados.size} selecionados</span>
          <button
            type="button"
            onClick={() => rodarLote("reprocessar")}
            disabled={pending}
            className="rounded-full border border-line-strong bg-card px-3 py-1 text-[12px] font-semibold text-ink hover:bg-soft disabled:opacity-60"
          >
            Reprocessar
          </button>
          <button
            type="button"
            onClick={() => rodarLote("diagnostico")}
            disabled={pending}
            className="rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-white hover:bg-accent-press disabled:opacity-60"
          >
            Dossiê completo com IA ({selecionados.size}) ·{" "}
            <span className="font-mono">≈ US$ {(selecionados.size * CUSTO_IA_POR_LEAD).toFixed(2)}</span>
          </button>
          <button
            type="button"
            onClick={limparSelecao}
            className="text-[12px] text-muted underline underline-offset-2 hover:text-ink"
          >
            limpar
          </button>
          {pending && <span className="text-[11.5px] text-faint">agendando…</span>}
        </div>
      )}

      {loteMsg && (
        <p
          className={`rounded-xl px-3 py-2 text-[12px] ${
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
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[780px] text-left">
            <thead className="border-b border-line bg-soft text-[10px] font-bold uppercase tracking-[0.07em] text-faint">
              <tr>
                <th className="w-9 px-2 py-[7px]">
                  <input
                    ref={cabecalhoRef}
                    type="checkbox"
                    checked={todosMarcados}
                    onChange={alternarTodos}
                    aria-label="Marcar todos os leads visíveis"
                    className="block size-3.5 accent-[color:var(--accent)]"
                  />
                </th>
                <th className="w-7 px-0 py-[7px]" />
                <th className="w-[86px] px-2 py-[7px]">Score</th>
                <th className="px-3 py-[7px]">Empresa</th>
                <th className="w-[148px] px-2 py-[7px]">Anúncios</th>
                <th className="w-[124px] px-2 py-[7px]">Site</th>
                <th className="w-[104px] px-2 py-[7px]">Redes</th>
                <th className="w-8 px-0 py-[7px]" />
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
                    onClick={(e) => aoClicarLinha(e, l.id)}
                    className={`cursor-pointer border-b border-line transition-colors last:border-0 ${
                      marcado ? "bg-accent-soft" : "hover:bg-soft"
                    }`}
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarLinha(l.id)}
                        aria-label={`Selecionar ${l.nome}`}
                        className="block size-3.5 accent-[color:var(--accent)]"
                      />
                    </td>
                    <td className="px-0 py-2 text-center">
                      <Favoritar leadId={l.id} inicial={l.favorito} tamanho="sm" />
                    </td>
                    <td className="px-2 py-2">
                      <Score score={l.score} />
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/lead/${l.id}`}
                        className="text-[13px] font-semibold leading-tight text-ink underline-offset-2 hover:underline"
                      >
                        {l.nome}
                      </Link>
                      {l.temDiagnostico && (
                        <span className="ml-1.5 align-[1px] font-mono text-[9.5px] font-bold uppercase text-accent-ink">
                          IA
                        </span>
                      )}
                      <div className="mt-[3px] flex flex-wrap items-center gap-x-1.5 text-[11.5px] leading-tight text-faint">
                        <span>{l.categoria ?? "—"}</span>
                        {l.avaliacao != null && (
                          <span className="tabular-nums">
                            <span className="text-warn">★</span> {l.avaliacao.toLocaleString("pt-BR")} ·{" "}
                            {l.qtd_avaliacoes ?? 0}
                          </span>
                        )}
                        {l.status_negocio && l.status_negocio !== "OPERATIONAL" && (
                          <span className="text-warn">· {l.status_negocio}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Pastilha tom={anuncio.tom}>{capitalizar(anuncio.texto)}</Pastilha>
                    </td>
                    <td className="px-2 py-2">
                      {(l.site_url ?? "").trim() !== "" ? (
                        <a
                          href={l.site_url ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Abrir ${l.site_url}`}
                          className="inline-block hover:opacity-80"
                        >
                          <Pastilha tom={site.tom}>{capitalizar(site.texto)}</Pastilha>
                        </a>
                      ) : (
                        <Pastilha tom={site.tom}>{capitalizar(site.texto)}</Pastilha>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <Rede sigla="IG" titulo="Instagram" url={l.instagram_url} />
                        <Rede sigla="FB" titulo="Facebook" url={l.facebook_url} />
                        <SeloWhatsapp temWhatsapp={l.temWhatsapp} />
                      </div>
                    </td>
                    <td className="px-0 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setAberto(l)}
                        title="Resumo rápido, sem sair da lista"
                        aria-label={`Resumo rápido de ${l.nome}`}
                        className="px-1 text-[15px] leading-none text-faint hover:text-ink"
                      >
                        ›
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-faint">
        <span className="font-semibold text-ok">Verde</span> = confirmado / bom ·{" "}
        <span className="font-semibold text-warn">Amarelo</span> = parcial, olhar melhor ·{" "}
        <span className="font-semibold text-bad">Vermelho</span> = problema (= oportunidade de venda) ·{" "}
        <span className="font-semibold text-muted">Cinza</span> = não deu pra checar, não é
        &ldquo;não&rdquo;. Clique na linha para abrir o dossiê.
      </p>

      {aberto && <CardLead lead={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}

// ------------------------------------------------------------------ partes

/** So apresentacao: o rotulo da pastilha vem minusculo do modulo compartilhado
 *  (que a pagina do lead tambem usa), e na tabela ele comeca com maiuscula. */
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Pilula de filtro: rotulo + quantos leads caem nele. */
function Pilula({
  on,
  conta,
  onClick,
  children,
}: {
  on: boolean;
  conta: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11.5px] font-medium transition-colors ${
        on
          ? "border-accent bg-accent text-white"
          : "border-line-strong bg-card text-muted hover:bg-soft"
      }`}
    >
      {children}
      <span className={`font-mono tabular-nums ${on ? "text-white/65" : "text-faint"}`}>{conta}</span>
    </button>
  );
}

/** Score compacto: numero + barrinha na cor da faixa. */
function Score({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="font-mono text-[13px] text-faint">—</span>;
  }
  const alto = score >= FAIXA_SCORE_ALTO;
  const medio = score >= FAIXA_SCORE_MEDIO;
  const texto = alto ? "text-ok" : medio ? "text-warn" : "text-bad";
  const barra = alto ? "bg-ok" : medio ? "bg-warn" : "bg-bad";
  return (
    <span className="flex items-center gap-1.5">
      <span className={`font-mono text-[15px] font-bold leading-none tabular-nums ${texto}`}>
        {score}
      </span>
      <span className="h-[3px] w-7 flex-shrink-0 overflow-hidden rounded-full bg-line">
        <span className={`block h-full rounded-full ${barra}`} style={{ width: `${Math.max(4, score)}%` }} />
      </span>
    </span>
  );
}

const SELO_REDE =
  "grid h-[18px] min-w-[1.6rem] place-items-center rounded-[5px] px-1 text-[9.5px] font-bold";

/** Quadradinho de rede social: aceso quando existe o link; abre em nova aba. */
function Rede({ sigla, titulo, url }: { sigla: string; titulo: string; url: string | null }) {
  const limpa = (url ?? "").trim();
  if (limpa === "") {
    return (
      <span title={`Sem link de ${titulo} — não quer dizer que a empresa não tenha`} className={`${SELO_REDE} bg-soft text-faint`}>
        {sigla}
      </span>
    );
  }
  return (
    <a
      href={limpa}
      target="_blank"
      rel="noopener noreferrer"
      title={`${titulo} (abrir)`}
      className={`${SELO_REDE} bg-ok-soft text-ok hover:opacity-80`}
    >
      {sigla}
    </a>
  );
}

/** WhatsApp: so fica verde com link CONFIRMADO no site. Cinza nos outros
 *  casos - inclusive "checamos e nao achamos", que nao prova ausencia. */
function SeloWhatsapp({ temWhatsapp }: { temWhatsapp: boolean | null }) {
  if (temWhatsapp === true) {
    return (
      <span title="WhatsApp encontrado no site" className={`${SELO_REDE} bg-ok-soft text-ok`}>
        WA
      </span>
    );
  }
  const titulo =
    temWhatsapp === false
      ? "Não achamos WhatsApp no site — não quer dizer que a empresa não use"
      : "Site ainda não analisado";
  return (
    <span title={titulo} className={`${SELO_REDE} bg-soft text-faint`}>
      WA
    </span>
  );
}
