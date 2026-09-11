// Lista TODAS as pesquisas (etapa 31). Rota nova - a home passou a mostrar so
// as recentes, entao esta pagina virou o "ver todas". Reaproveita o mesmo
// componente que a home usava antes (ListaPesquisas, com a busca embutida) e
// a mesma consulta que ja existia: nenhuma logica nova, so mudou de lugar.

import { supabaseServer } from "@/lib/supabase/server";
import type { Search } from "@/lib/db-types";
import { Aviso, EstadoVazio, Voltar } from "@/components/ui";
import { ListaPesquisas, type PesquisaResumo } from "@/app/lista-pesquisas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pesquisas · Prospekta" };

export default async function PesquisasPage() {
  const supabase = supabaseServer();

  const { data: searchesRaw, error } = await supabase
    .from("searches")
    .select("*")
    .order("criada_em", { ascending: false });
  const searches = (searchesRaw ?? []) as Search[];

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

  return (
    <div className="flex flex-col gap-5">
      <Voltar href="/">Visão geral</Voltar>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Pesquisas <span className="text-faint">({pesquisas.length})</span>
        </h1>
        <p className="text-sm text-muted">Todas as buscas já feitas, mais recentes primeiro.</p>
      </div>

      {error && <Aviso>Erro ao ler o banco: {error.message}</Aviso>}

      {pesquisas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma pesquisa ainda"
          descricao="Comece criando uma busca — cidade, nicho e raio."
        />
      ) : (
        <ListaPesquisas pesquisas={pesquisas} />
      )}
    </div>
  );
}
