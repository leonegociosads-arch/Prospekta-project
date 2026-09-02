import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Search } from "@/lib/db-types";

export const dynamic = "force-dynamic";

export default async function PesquisaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = supabaseServer();
  const { data } = await supabase
    .from("searches")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const pesquisa = data as Search;

  const { data: jobDescoberta } = await supabase
    .from("jobs")
    .select("status")
    .eq("search_id", id)
    .eq("tipo", "descobrir")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        &larr; Pesquisas
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {pesquisa.nicho} <span className="text-zinc-400">em</span> {pesquisa.regiao_texto}
        </h1>
        <p className="text-sm text-zinc-500">
          Raio {pesquisa.raio_km} km · limite {pesquisa.limite_leads} leads · status{" "}
          <span className="font-mono">{pesquisa.status}</span>
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Info rotulo="Descoberta" valor={jobDescoberta?.status ?? "sem job"} />
        <Info rotulo="Orcamento de chamadas" valor={String(pesquisa.orcamento_chamadas)} />
        <Info rotulo="Chamadas feitas" valor={String(pesquisa.chamadas_feitas)} />
        <Info rotulo="Custo estimado" valor={`US$ ${pesquisa.custo_estimado_usd}`} />
      </dl>

      <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500">
          A pesquisa esta salva e o job de descoberta esta{" "}
          <span className="font-mono">{jobDescoberta?.status ?? "?"}</span>. A busca de
          empresas (Google Places) roda na proxima etapa.
        </p>
      </div>
    </div>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <dt className="text-xs text-zinc-500">{rotulo}</dt>
      <dd className="font-mono">{valor}</dd>
    </div>
  );
}
