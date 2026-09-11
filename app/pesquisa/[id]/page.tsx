import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Search } from "@/lib/db-types";
import { carregarConfigIa } from "@/lib/ia/config-ia";
import { carregarLeadsDaPesquisa } from "@/lib/leads/consulta";
import { ordenarLeads } from "@/lib/leads/filtros";
import { calcularProgressoPesquisa } from "@/lib/leads/progresso";
import { Aviso, Metrica, Panel, Voltar } from "@/components/ui";
import { RodarDescoberta } from "./rodar-descoberta";
import { Progresso } from "./progresso";
import { GerarDiagnosticos } from "./gerar-diagnosticos";
import { LeadsTabela } from "./leads-tabela";

export const dynamic = "force-dynamic";

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

  const leads = await carregarLeadsDaPesquisa(supabase, id);
  const ids = leads.map((l) => l.id);

  // uma unica consulta para as tarefas abertas (fila do worker)
  const naFila = {
    analisar_site: 0,
    calcular_score: 0,
    analisar_social: 0,
    detectar_ads: 0,
    diagnosticar_ia: 0,
  };
  if (ids.length > 0) {
    const { data: jobs } = await supabase
      .from("jobs")
      .select("tipo")
      .in("tipo", Object.keys(naFila))
      .in("status", ["pendente", "rodando"])
      .in("lead_id", ids);
    for (const j of jobs ?? []) {
      const t = j.tipo as keyof typeof naFila;
      if (t in naFila) naFila[t]++;
    }
  }

  const filaProcessamento =
    naFila.analisar_site + naFila.calcular_score + naFila.analisar_social + naFila.detectar_ads;
  const progresso = calcularProgressoPesquisa(leads, filaProcessamento);

  // elegiveis ao diagnostico: score >= limite OU entre os topN da pesquisa
  const cfgIa = carregarConfigIa();
  const porScore = ordenarLeads(
    leads.filter((l) => l.score != null),
    "score",
  );
  const topIds = new Set(porScore.slice(0, cfgIa.topN).map((l) => l.id));
  const elegiveis = leads.filter(
    (l) => l.score != null && (l.score >= cfgIa.scoreMinimo || topIds.has(l.id)),
  );
  const comDiagnostico = elegiveis.filter((l) => l.temDiagnostico).length;

  // resumo da pesquisa: derivado dos leads ja carregados, sem consulta nova
  const analisados = leads.filter((l) => l.score != null).length;
  const scores = leads.map((l) => l.score).filter((s): s is number => s != null);
  const scoreMedio = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const favoritosCount = leads.filter((l) => l.favorito).length;

  return (
    <div className="flex flex-col gap-6">
      <Voltar href="/">Pesquisas</Voltar>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {pesquisa.nicho} <span className="text-faint">em</span> {pesquisa.regiao_texto}
        </h1>
        <p className="text-sm text-muted">
          Raio {pesquisa.raio_km} km · limite {pesquisa.limite_leads} leads · status{" "}
          <span className="font-mono">{pesquisa.status}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metrica rotulo="Leads encontrados" valor={String(leads.length)} />
        <Metrica rotulo="Analisados" valor={String(analisados)} />
        <Metrica rotulo="Score médio" valor={scoreMedio != null ? String(scoreMedio) : "—"} />
        <Metrica rotulo="Favoritos" valor={String(favoritosCount)} />
      </div>

      <Panel rotulo="Consumo de API desta pesquisa">
        <dl className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          <Info rotulo="Descoberta" valor={jobDescoberta?.status ?? "sem job"} />
          <Info rotulo="Orçamento de chamadas" valor={String(pesquisa.orcamento_chamadas)} />
          <Info rotulo="Chamadas feitas" valor={String(pesquisa.chamadas_feitas)} />
          <Info rotulo="Custo estimado" valor={`US$ ${pesquisa.custo_estimado_usd}`} />
        </dl>
      </Panel>

      {jobDescoberta?.ultimo_erro && (
        <Aviso>Último erro da descoberta: {jobDescoberta.ultimo_erro}</Aviso>
      )}

      <RodarDescoberta searchId={id} jobStatus={jobDescoberta?.status ?? null} />

      {leads.length > 0 && (
        <>
          <Progresso searchId={id} progresso={progresso} />
          <GerarDiagnosticos
            searchId={id}
            progresso={{
              elegiveis: elegiveis.length,
              comDiagnostico,
              naFila: naFila.diagnosticar_ia,
              criterio: `score ≥ ${cfgIa.scoreMinimo} ou top ${cfgIa.topN}`,
            }}
          />
        </>
      )}

      <LeadsTabela searchId={id} leads={leads} />
    </div>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="bg-card px-3.5 py-2.5 text-sm">
      <dt className="text-[11px] text-faint">{rotulo}</dt>
      <dd className="font-mono">{valor}</dd>
    </div>
  );
}
