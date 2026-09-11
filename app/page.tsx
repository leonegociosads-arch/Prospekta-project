import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import type { Search } from "@/lib/db-types";
import { EstadoVazio, Aviso, SeloScore, Metrica } from "@/components/ui";
import { ListaPesquisas, type PesquisaResumo } from "./lista-pesquisas";

export const dynamic = "force-dynamic";

type LeadFav = { id: string; nome: string; categoria: string | null };

export default async function Home() {
  const supabase = supabaseServer();

  const { data: searchesRaw, error } = await supabase
    .from("searches")
    .select("*")
    .order("criada_em", { ascending: false });
  const searches = (searchesRaw ?? []) as Search[];

  // contagem de leads por pesquisa, numa consulta so
  const contagem = new Map<string, number>();
  {
    const { data: vinc } = await supabase.from("search_leads").select("search_id");
    for (const v of vinc ?? []) {
      const s = v.search_id as string;
      contagem.set(s, (contagem.get(s) ?? 0) + 1);
    }
  }

  const pesquisas: PesquisaResumo[] = searches.map((s) => ({
    id: s.id,
    nicho: s.nicho,
    regiao_texto: s.regiao_texto,
    raio_km: s.raio_km,
    status: s.status,
    totalLeads: contagem.get(s.id) ?? 0,
  }));

  // favoritos
  const { data: favRaw } = await supabase
    .from("leads")
    .select("id, nome, categoria")
    .eq("favorito", true)
    .order("nome", { ascending: true })
    .limit(50);
  const favoritos = (favRaw ?? []) as LeadFav[];

  // total de leads analisados (tem score) - so contagem, sem trazer linhas
  const { count: leadsAnalisados } = await supabase
    .from("scores")
    .select("id", { count: "exact", head: true });

  const totalLeads = pesquisas.reduce((soma, p) => soma + p.totalLeads, 0);

  const scoreFav = new Map<string, number>();
  if (favoritos.length > 0) {
    const { data: sc } = await supabase
      .from("scores")
      .select("lead_id, total")
      .in(
        "lead_id",
        favoritos.map((f) => f.id),
      );
    for (const s of sc ?? []) scoreFav.set(s.lead_id as string, s.total as number);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Painel</h1>
        <p className="text-sm text-muted">Suas pesquisas de leads, num só lugar.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metrica rotulo="Pesquisas" valor={String(pesquisas.length)} />
        <Metrica rotulo="Leads encontrados" valor={String(totalLeads)} />
        <Metrica rotulo="Leads analisados" valor={String(leadsAnalisados ?? 0)} />
        <Metrica rotulo="Favoritos" valor={String(favoritos.length)} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Pesquisas</h2>

        {error && <Aviso>Erro ao ler o banco: {error.message}</Aviso>}

        {pesquisas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma pesquisa ainda"
            descricao="Comece criando uma busca — cidade, nicho e raio."
            acao={
              <Link
                href="/pesquisa/nova"
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-press"
              >
                Criar a primeira
              </Link>
            }
          />
        ) : (
          <ListaPesquisas pesquisas={pesquisas} />
        )}
      </section>

      {favoritos.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">
            Favoritos <span className="text-faint">({favoritos.length})</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {favoritos.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/lead/${l.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-2.5 shadow-card transition-colors hover:border-line-strong hover:shadow-pop"
                >
                  <span className="text-amber-500">★</span>
                  <SeloScore score={scoreFav.get(l.id) ?? null} />
                  <span className="min-w-0">
                    <span className="font-medium">{l.nome}</span>
                    <span className="block text-xs text-faint">{l.categoria ?? "—"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
