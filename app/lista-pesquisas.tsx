"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EstadoVazio } from "@/components/ui";

export type PesquisaResumo = {
  id: string;
  nicho: string;
  regiao_texto: string;
  raio_km: number;
  status: string;
  totalLeads: number;
};

function normalizar(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function ListaPesquisas({ pesquisas }: { pesquisas: PesquisaResumo[] }) {
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    const t = normalizar(busca.trim());
    if (!t) return pesquisas;
    return pesquisas.filter((p) =>
      normalizar(`${p.nicho} ${p.regiao_texto}`).includes(t),
    );
  }, [pesquisas, busca]);

  return (
    <div className="flex flex-col gap-3">
      {pesquisas.length > 3 && (
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pesquisa por nicho ou região…"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
        />
      )}

      {visiveis.length === 0 ? (
        <EstadoVazio titulo="Nenhuma pesquisa com esse termo" />
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pesquisa/${p.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
              >
                <span className="min-w-0">
                  <span className="font-medium">{p.nicho}</span>
                  <span className="text-zinc-500"> · {p.regiao_texto}</span>
                  <span className="hidden text-zinc-400 sm:inline"> · {p.raio_km} km</span>
                  <span className="block text-xs text-zinc-400">
                    {p.totalLeads} {p.totalLeads === 1 ? "lead" : "leads"}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-zinc-400">{p.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
