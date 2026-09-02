import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import type { Search } from "@/lib/db-types";

// Sempre buscar do banco no momento do acesso (nao gerar pagina estatica).
export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("searches")
    .select("*")
    .order("criada_em", { ascending: false });

  const pesquisas = (data ?? []) as Search[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pesquisas</h1>
        <p className="text-sm text-zinc-500">
          Cada pesquisa e uma busca por um nicho numa regiao.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Erro ao ler o banco: {error.message}
        </p>
      )}

      {pesquisas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">Nenhuma pesquisa ainda.</p>
          <Link
            href="/pesquisa/nova"
            className="mt-3 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Criar a primeira
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {pesquisas.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pesquisa/${p.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
              >
                <span>
                  <span className="font-medium">{p.nicho}</span>
                  <span className="text-zinc-500"> · {p.regiao_texto}</span>
                  <span className="text-zinc-400"> · {p.raio_km} km</span>
                </span>
                <span className="font-mono text-xs text-zinc-400">{p.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
