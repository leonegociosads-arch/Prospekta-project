"use client";

import { useMemo, useState } from "react";
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

const selectCls =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400";

const SITE_LABEL: Record<SiteSituacao, { texto: string; cls: string }> = {
  ok: { texto: "site ok", cls: "text-emerald-600 dark:text-emerald-400" },
  instavel: { texto: "site instável", cls: "text-amber-600 dark:text-amber-400" },
  "fora-do-ar": { texto: "site fora do ar", cls: "text-red-600 dark:text-red-400" },
  "nao-analisado": { texto: "site não analisado", cls: "text-zinc-400" },
  "sem-site": { texto: "sem site", cls: "text-zinc-400" },
};

function VeredictoAnuncio({ v }: { v: LeadEnriquecido["vereditoAnuncio"] }) {
  if (v === "forte") return <span className="text-emerald-600 dark:text-emerald-400">anuncia (forte)</span>;
  if (v === "alguns") return <span className="text-emerald-600 dark:text-emerald-400">indícios de anúncio</span>;
  if (v === "nenhum") return <span className="text-zinc-500">sem indício de anúncio</span>;
  return null;
}

export function LeadsTabela({
  searchId,
  leads,
}: {
  searchId: string;
  leads: LeadEnriquecido[];
}) {
  const [criterios, setCriterios] = useState<CriteriosLeads>(CRITERIOS_PADRAO);
  const [aberto, setAberto] = useState<LeadEnriquecido | null>(null);
  const set = <K extends keyof CriteriosLeads>(k: K, v: CriteriosLeads[K]) =>
    setCriterios((c) => ({ ...c, [k]: v }));

  const visiveis = useMemo(() => aplicarCriterios(leads, criterios), [leads, criterios]);
  const ativos = contarFiltrosAtivos(criterios);

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
          Leads <span className="text-zinc-400">({visiveis.length}/{leads.length})</span>
        </h2>
        <a
          href={`/pesquisa/${searchId}/export`}
          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
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
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
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

        <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={criterios.soFavoritos}
            onChange={(e) => set("soFavoritos", e.target.checked)}
            className="accent-amber-500"
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
            className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            limpar filtros ({ativos})
          </button>
        )}
      </div>

      {visiveis.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum lead com esses filtros"
          descricao="Afrouxe a busca ou os filtros para ver mais empresas."
          acao={
            <button
              type="button"
              onClick={() => setCriterios(CRITERIOS_PADRAO)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Limpar filtros
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
              <tr>
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
                return (
                  <tr
                    key={l.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                  >
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
                      <div className="text-xs text-zinc-500">
                        {l.categoria ?? "—"}
                        {l.status_negocio && l.status_negocio !== "OPERATIONAL" && (
                          <span className="ml-1 text-amber-600">· {l.status_negocio}</span>
                        )}
                      </div>
                      {l.avaliacao != null && (
                        <div className="text-xs text-zinc-400 tabular-nums">
                          ★ {l.avaliacao} ({l.qtd_avaliacoes ?? 0})
                        </div>
                      )}
                      {l.endereco && <div className="text-xs text-zinc-400">{l.endereco}</div>}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-zinc-500">
                      <div className="flex flex-col gap-0.5">
                        {l.telefone && <span className="tabular-nums">{l.telefone}</span>}
                        {l.temWhatsapp === true && (
                          <span className="text-emerald-600 dark:text-emerald-400">WhatsApp no site</span>
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
                          <span className="text-zinc-500">diagnóstico de IA</span>
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
