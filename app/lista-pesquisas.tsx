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
          className="w-full rounded-xl border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-accent"
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
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-card transition-colors hover:border-line-strong hover:shadow-pop"
              >
                <span className="min-w-0">
                  <span className="font-medium">{p.nicho}</span>
                  <span className="text-muted"> · {p.regiao_texto}</span>
                  <span className="hidden text-faint sm:inline"> · {p.raio_km} km</span>
                  <span className="block text-xs text-faint">
                    {p.totalLeads} {p.totalLeads === 1 ? "lead" : "leads"}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-faint">{p.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
