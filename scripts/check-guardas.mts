// Teste de integracao das guardas contra o Supabase real.
// NAO chama Google. Cria 1 pesquisa, faz 2 round-trips por chamarComGuardas
// (a 2a deve ser bloqueada), confere api_usage e o contador, e limpa tudo.
//
// Uso:  npm run check:guardas   (precisa da migration 0004 aplicada)

import { createClient } from "@supabase/supabase-js";
import { chamarComGuardas } from "../lib/guardas/index";
import { ErroDeOrcamento } from "../lib/guardas/erros";
import { criarStoreSupabase } from "../lib/guardas/store-supabase";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("\n[x] .env.local incompleto (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)\n");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const store = criarStoreSupabase(db);
const config = { tetoMensalChamadas: 1_000_000, ttlBuscaDias: 60, ttlDetalhesDias: 30 };

let ok = 0;
let fail = 0;
const pass = (m: string) => { console.log("  [ok] " + m); ok++; };
const bad = (m: string) => { console.log("  [x]  " + m); fail++; };

let searchId: string | null = null;

try {
  // 0. a funcao SQL existe?
  {
    const { error } = await db.rpc("registrar_chamada_pesquisa", {
      p_search_id: "00000000-0000-0000-0000-000000000000",
      p_chamadas: 0,
      p_custo: 0,
    });
    if (error) bad(`RPC registrar_chamada_pesquisa: ${error.message} (rode a migration 0004)`);
    else pass("RPC registrar_chamada_pesquisa existe");
  }

  // 1. cria uma pesquisa com orcamento 1
  {
    const { data, error } = await db
      .from("searches")
      .insert({ regiao_texto: "__check_guardas__", nicho: "Teste", raio_km: 1, status: "nova", orcamento_chamadas: 1 })
      .select("id")
      .single();
    if (error || !data) throw new Error("insert searches: " + error?.message);
    searchId = data.id;
    pass("criou pesquisa de teste (orcamento_chamadas = 1)");
  }

  const plano = { provedor: "google", endpoint: "text_search", searchId, faixaCampos: "pro", custoEstimadoUsd: 0.03 } as const;

  // 2. 1a chamada: permitida
  {
    let executou = false;
    const r = await chamarComGuardas(store, plano, async () => { executou = true; return { fake: true }; }, { config });
    if (executou && (r as { fake: boolean }).fake) pass("1a chamada executou e passou pelas guardas");
    else bad("1a chamada nao executou como esperado");
  }

  // 3. confere api_usage + contador
  {
    const { data: usos } = await db.from("api_usage").select("*").eq("search_id", searchId);
    if (usos && usos.length === 1 && usos[0].endpoint === "text_search") pass("api_usage registrou 1 linha");
    else bad("api_usage: esperado 1 registro, veio " + JSON.stringify(usos));

    const { data: s } = await db.from("searches").select("chamadas_feitas, custo_estimado_usd").eq("id", searchId).single();
    if (s?.chamadas_feitas === 1) pass("chamadas_feitas incrementado para 1 (RPC atomica)");
    else bad("chamadas_feitas: esperado 1, veio " + JSON.stringify(s));
  }

  // 4. 2a chamada: bloqueada pelo orcamento da pesquisa
  {
    let executou = false;
    try {
      await chamarComGuardas(store, plano, async () => { executou = true; return null; }, { config });
      bad("2a chamada deveria ter sido bloqueada");
    } catch (e) {
      if (e instanceof ErroDeOrcamento && e.motivo === "orcamento-da-pesquisa-esgotado" && !executou)
        pass("2a chamada bloqueada (orcamento da pesquisa) sem tocar na API");
      else bad("2a chamada falhou de forma inesperada: " + String(e));
    }
  }
} catch (e) {
  bad("EXCECAO: " + (e instanceof Error ? e.message : String(e)));
} finally {
  if (searchId) {
    await db.from("api_usage").delete().eq("search_id", searchId);
    await db.from("searches").delete().eq("id", searchId);
  }
  await db.from("searches").delete().eq("regiao_texto", "__check_guardas__");
  console.log("  [ok] dados de teste removidos");
}

console.log(`\nResultado: ${ok} ok, ${fail} falha(s).\n`);
process.exit(fail > 0 ? 1 : 0);
