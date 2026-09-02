import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Lead, Search } from "@/lib/db-types";
import { RodarDescoberta } from "./rodar-descoberta";

export const dynamic = "force-dynamic";

type LeadLinha = Pick<
  Lead,
  | "id"
  | "nome"
  | "categoria"
  | "endereco"
  | "telefone"
  | "site_url"
  | "avaliacao"
  | "qtd_avaliacoes"
  | "status_negocio"
>;

export default async function PesquisaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = supabaseServer();

  const { data } = await supabase.from("searches").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const pesquisa = data as Search;

  const { data: jobDescoberta } = await supabase
    .from("jobs")
    .select("status, ultimo_erro")
    .eq("search_id", id)
    .eq("tipo", "descobrir")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: vinculos } = await supabase
    .from("search_leads")
    .select(
      "leads(id, nome, categoria, endereco, telefone, site_url, avaliacao, qtd_avaliacoes, status_negocio)",
    )
    .eq("search_id", id);

  const leads: LeadLinha[] = (vinculos ?? [])
    .map((v) => {
      const bruto = (v as Record<string, unknown>).leads;
      return (Array.isArray(bruto) ? bruto[0] : bruto) as LeadLinha | null;
    })
    .filter((l): l is LeadLinha => l != null)
    .sort((a, b) => (b.qtd_avaliacoes ?? 0) - (a.qtd_avaliacoes ?? 0));

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

      {jobDescoberta?.ultimo_erro && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Ultimo erro da descoberta: {jobDescoberta.ultimo_erro}
        </p>
      )}

      <RodarDescoberta searchId={id} jobStatus={jobDescoberta?.status ?? null} />

      <div>
        <h2 className="mb-2 text-sm font-semibold">
          Leads {leads.length > 0 && <span className="text-zinc-400">({leads.length})</span>}
        </h2>

        {leads.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Nenhum lead ainda. Clique em &ldquo;Rodar descoberta&rdquo;.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="px-3 py-2 font-medium">Empresa</th>
                  <th className="px-3 py-2 font-medium">Avaliacoes</th>
                  <th className="px-3 py-2 font-medium">Contato</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                    <td className="px-3 py-2">
                      <div className="font-medium">{l.nome}</div>
                      <div className="text-xs text-zinc-500">
                        {l.categoria ?? "—"}
                        {l.status_negocio && l.status_negocio !== "OPERATIONAL" && (
                          <span className="ml-1 text-amber-600">· {l.status_negocio}</span>
                        )}
                      </div>
                      {l.endereco && <div className="text-xs text-zinc-400">{l.endereco}</div>}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {l.avaliacao != null ? `${l.avaliacao} (${l.qtd_avaliacoes ?? 0})` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {l.telefone && <div>{l.telefone}</div>}
                      {l.site_url ? (
                        <a
                          href={l.site_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-600 underline underline-offset-2 dark:text-zinc-300"
                        >
                          site
                        </a>
                      ) : (
                        <span className="text-zinc-400">sem site</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
