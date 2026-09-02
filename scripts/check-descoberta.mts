// Integracao do orquestrador de descoberta contra o Supabase real,
// com uma FONTE FALSA (nenhuma chamada ao Google).
// Cobre: gravacao, dedup por Place ID, isolamento de falha de 1 lead,
// transicoes de status do job. Limpa tudo no final.
//
// Uso:  npm run check:descoberta

import { createClient } from "@supabase/supabase-js";
import { executarDescoberta } from "../lib/descoberta/executar";
import type { FonteDeDados, LeadDescoberto } from "../lib/sources/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("\n[x] .env.local incompleto\n");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let ok = 0;
let fail = 0;
const pass = (m: string) => { console.log("  [ok] " + m); ok++; };
const bad = (m: string) => { console.log("  [x]  " + m); fail++; };

const REGIAO = "__check_descoberta__";
let searchId: string | null = null;

function lead(over: Partial<LeadDescoberto>): LeadDescoberto {
  return {
    fonte: "fake", fonteRef: null, placeId: null, nome: "Sem nome", categoria: null,
    endereco: null, lat: null, lng: null, telefone: null, siteUrl: null,
    instagramUrl: null, facebookUrl: null, avaliacao: null, qtdAvaliacoes: null,
    statusNegocio: null, bruto: {}, ...over,
  };
}

/** Fonte falsa: chama a guarda 1x e devolve leads fixos. */
function fonteFalsa(leads: LeadDescoberto[]): FonteDeDados {
  return {
    nome: "fake",
    async descobrir(_params, ctx) {
      await ctx.chamarComGuardas(
        { provedor: "google", endpoint: "text_search", faixaCampos: "enterprise", unidades: 1 },
        async () => ({ places: leads }),
      );
      return { status: "ok", leads };
    },
  };
}

try {
  // pre-seed do cache de regiao -> geocoding nao roda
  await db.from("region_cache").upsert({
    regiao_texto: REGIAO.toLowerCase(),
    centro_lat: -24.7, centro_lng: -47.55, resolvido_em: new Date().toISOString(),
  });

  const { data, error } = await db.rpc("criar_pesquisa", {
    p_regiao: REGIAO, p_nicho: "teste", p_raio_km: 10, p_limite_leads: 20, p_orcamento_chamadas: 5,
  });
  if (error) throw new Error("criar_pesquisa: " + error.message);
  searchId = String(data);
  pass("pesquisa de teste criada");

  // ---- 1a rodada: 3 leads (1 fechado) ----
  const leads1 = [
    lead({ placeId: "fake-1", nome: "Advocacia Um", endereco: "R. 1", avaliacao: 4.5, qtdAvaliacoes: 10 }),
    lead({ placeId: "fake-2", nome: "Advocacia Dois", endereco: "R. 2", statusNegocio: "CLOSED_PERMANENTLY" }),
    lead({ placeId: "fake-3", nome: "Advocacia Tres", endereco: "R. 3" }),
  ];
  const r1 = await executarDescoberta({ db, apiKey: "x", fonte: fonteFalsa(leads1) }, searchId);
  if (r1.status === "ok" && r1.encontrados === 3 && r1.novos === 3 && r1.fechados === 1) {
    pass("1a rodada: 3 encontrados, 3 novos, 1 fechado");
  } else bad("1a rodada inesperada: " + JSON.stringify(r1));

  {
    const { data: sl } = await db.from("search_leads").select("lead_id").eq("search_id", searchId);
    if (sl?.length === 3) pass("search_leads: 3 vinculos"); else bad("search_leads: " + JSON.stringify(sl));
    const { data: usos } = await db.from("api_usage").select("endpoint").eq("search_id", searchId);
    if (usos?.some((u) => u.endpoint === "text_search")) pass("api_usage: chamada text_search registrada");
    else bad("api_usage sem registro: " + JSON.stringify(usos));
    const { data: job } = await db.from("jobs").select("status").eq("search_id", searchId).single();
    if (job?.status === "feito") pass("job -> 'feito'"); else bad("job status: " + JSON.stringify(job));
    const { data: s } = await db.from("searches").select("status").eq("id", searchId).single();
    if (s?.status === "pronta") pass("search -> 'pronta'"); else bad("search status: " + JSON.stringify(s));
  }

  // ---- 2a rodada: mesmos Place IDs -> dedup, 0 novos ----
  const r2 = await executarDescoberta({ db, apiKey: "x", fonte: fonteFalsa(leads1) }, searchId);
  if (r2.novos === 0 && r2.jaExistiam === 3) pass("2a rodada: dedup por Place ID (0 novos, 3 ja existiam)");
  else bad("2a rodada inesperada: " + JSON.stringify(r2));

  {
    const { count } = await db.from("leads").select("*", { count: "exact", head: true }).like("google_place_id", "fake-%");
    if (count === 3) pass("leads: continua 3 (nao duplicou)"); else bad("leads count: " + count);
  }

  // ---- isolamento: 1 lead com dado invalido nao derruba os outros ----
  const leads3 = [
    lead({ placeId: "fake-9", nome: "Boa A", endereco: "R. 9" }),
    // avaliacao string -> coluna numeric recusa -> persistirLead retorna {erro}
    lead({ placeId: "fake-10", nome: "Ruim", endereco: "R. 10", avaliacao: "x" as unknown as number }),
    lead({ placeId: "fake-11", nome: "Boa B", endereco: "R. 11" }),
  ];
  const r3 = await executarDescoberta({ db, apiKey: "x", fonte: fonteFalsa(leads3) }, searchId);
  const { count: boas } = await db.from("leads").select("*", { count: "exact", head: true }).in("google_place_id", ["fake-9", "fake-11"]);
  if (r3.novos === 2 && r3.errosPorLead.length === 1 && boas === 2) {
    pass("isolamento: 1 lead com erro, os outros 2 foram gravados, nada foi apagado");
  } else bad("isolamento inesperado: " + JSON.stringify(r3) + " boas=" + boas);
} catch (e) {
  bad("EXCECAO: " + (e instanceof Error ? e.message : String(e)));
} finally {
  if (searchId) {
    await db.from("api_usage").delete().eq("search_id", searchId);
    await db.from("searches").delete().eq("id", searchId); // cascata: search_leads, jobs
  }
  await db.from("searches").delete().eq("regiao_texto", REGIAO);
  await db.from("leads").delete().like("google_place_id", "fake-%");
  await db.from("places_cache").delete().like("google_place_id", "fake-%");
  await db.from("region_cache").delete().eq("regiao_texto", REGIAO.toLowerCase());
  console.log("  [ok] dados de teste removidos");
}

console.log(`\nResultado: ${ok} ok, ${fail} falha(s).\n`);
process.exit(fail > 0 ? 1 : 0);
