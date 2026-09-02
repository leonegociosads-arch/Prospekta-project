// Orquestrador da descoberta.
//
// pesquisa -> job 'rodando' -> geocoding (cache+budget) -> fonte (budget+usage)
// -> normaliza -> deduplica -> places_cache -> leads -> search_leads
// -> job 'feito'/'erro'.

import type { SupabaseClient } from "@supabase/supabase-js";
import { criarStoreSupabase } from "@/lib/guardas/store-supabase";
import { chamarComGuardas, ErroDeOrcamento, type PlanoDeChamada } from "@/lib/guardas";
import type { ContextoDescoberta, FonteDeDados } from "@/lib/sources/types";
import { criarFonteGooglePlaces } from "@/lib/sources/google-places";
import { resolverRegiao } from "./geocoding";
import { persistirLead } from "./persistir";
import { ErroGoogle, mensagemAmigavel } from "./erros";

export type ResumoDescoberta = {
  status: "ok" | "zero-resultados" | "erro";
  encontrados: number;
  novos: number;
  jaExistiam: number;
  fechados: number;
  errosPorLead: string[];
  /** preenchido quando a busca rodou sem raio preciso (Geocoding indisponivel) */
  aviso?: string;
  erro?: string;
};

export type DepsDescoberta = {
  db: SupabaseClient;
  apiKey: string;
  fonte?: FonteDeDados; // injetavel para teste
  fetchImpl?: typeof fetch;
};

const VAZIO = { encontrados: 0, novos: 0, jaExistiam: 0, fechados: 0, errosPorLead: [] as string[] };

export async function executarDescoberta(
  deps: DepsDescoberta,
  searchId: string,
): Promise<ResumoDescoberta> {
  const { db } = deps;
  const store = criarStoreSupabase(db);

  const { data: pesquisa, error: errP } = await db
    .from("searches")
    .select("id, regiao_texto, raio_km, nicho, limite_leads")
    .eq("id", searchId)
    .maybeSingle();

  if (errP) return { status: "erro", ...VAZIO, erro: `searches: ${errP.message}` };
  if (!pesquisa) return { status: "erro", ...VAZIO, erro: "pesquisa nao encontrada" };

  await db.from("searches").update({ status: "descobrindo" }).eq("id", searchId);
  await marcarJob(db, searchId, "rodando", null);

  const ctx: ContextoDescoberta = {
    chamarComGuardas: (plano, executar) =>
      chamarComGuardas(store, { ...plano, searchId } as PlanoDeChamada, executar),
  };

  try {
    // Geocoding e um "reforco": se falhar, a busca continua so por texto
    // (sem raio preciso). Nao derruba a descoberta.
    let centro: { lat: number; lng: number } | null = null;
    let aviso: string | undefined;
    try {
      const geo = await resolverRegiao(store, ctx, deps.apiKey, pesquisa.regiao_texto, {
        fetchImpl: deps.fetchImpl,
      });
      centro = geo.centro;
    } catch (eGeo) {
      if (eGeo instanceof ErroDeOrcamento) throw eGeo; // orcamento e fatal
      const m = eGeo instanceof ErroGoogle ? mensagemAmigavel(eGeo.tipo) : String(eGeo);
      aviso = `Geocodificacao indisponivel (${m}). Busca feita so por texto, sem raio preciso.`;
      console.warn("[descoberta] geocoding falhou, seguindo sem centro:", eGeo);
    }

    const fonte =
      deps.fonte ?? criarFonteGooglePlaces({ apiKey: deps.apiKey, fetchImpl: deps.fetchImpl });

    const res = await fonte.descobrir(
      {
        regiaoTexto: pesquisa.regiao_texto,
        centro,
        raioKm: Number(pesquisa.raio_km),
        nicho: pesquisa.nicho,
        limiteLeads: pesquisa.limite_leads,
      },
      ctx,
    );

    // persiste um a um: falha de um lead nao derruba os outros nem apaga o resto
    let novos = 0;
    let jaExistiam = 0;
    let fechados = 0;
    const errosPorLead: string[] = [];

    for (const lead of res.leads) {
      if (lead.statusNegocio === "CLOSED_PERMANENTLY") fechados++;
      const r = await persistirLead(db, searchId, lead);
      if (r.resultado === "novo") novos++;
      else if (r.resultado === "ja-existia") jaExistiam++;
      else errosPorLead.push(`${lead.nome}: ${r.erro}`);
    }

    await db.from("searches").update({ status: "pronta" }).eq("id", searchId);
    await marcarJob(
      db,
      searchId,
      "feito",
      errosPorLead.length ? `${errosPorLead.length} lead(s) com erro ao gravar` : null,
    );

    return {
      status: res.status === "zero-resultados" ? "zero-resultados" : "ok",
      encontrados: res.leads.length,
      novos,
      jaExistiam,
      fechados,
      errosPorLead,
      aviso,
    };
  } catch (e) {
    const msg =
      e instanceof ErroGoogle
        ? `${e.tipo}: ${mensagemAmigavel(e.tipo)}`
        : e instanceof ErroDeOrcamento
          ? `orcamento bloqueou a chamada: ${e.motivo}`
          : e instanceof Error
            ? e.message
            : String(e);

    await db.from("searches").update({ status: "erro" }).eq("id", searchId);
    await marcarJob(db, searchId, "erro", msg);

    return { status: "erro", ...VAZIO, erro: msg };
  }
}

async function marcarJob(
  db: SupabaseClient,
  searchId: string,
  status: string,
  erro: string | null,
): Promise<void> {
  await db
    .from("jobs")
    .update({ status, ultimo_erro: erro, atualizado_em: new Date().toISOString() })
    .eq("search_id", searchId)
    .eq("tipo", "descobrir");
}
