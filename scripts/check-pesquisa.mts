// Integracao da criacao de pesquisa contra o Supabase real.
// - RPC criar_pesquisa cria 1 linha em searches + 1 job de descoberta (atomico)
// - status inicial correto ('nova' / 'pendente')
// - conexao ruim -> erro tratado, sem crash
// NAO chama Google.  Uso:  npm run check:pesquisa   (precisa da migration 0005)

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("\n[x] .env.local incompleto\n");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

let ok = 0;
let fail = 0;
const pass = (m: string) => { console.log("  [ok] " + m); ok++; };
const bad = (m: string) => { console.log("  [x]  " + m); fail++; };

let searchId: string | null = null;

try {
  // 1. cria via RPC
  {
    const { data, error } = await db.rpc("criar_pesquisa", {
      p_regiao: "  __check_pesquisa__  ",
      p_nicho: "  dentistas  ",
      p_raio_km: 12,
      p_limite_leads: 20,
      p_orcamento_chamadas: 2,
    });
    if (error) {
      bad(`RPC criar_pesquisa: ${error.message} (rode a migration 0005)`);
    } else {
      searchId = String(data);
      pass("RPC criar_pesquisa retornou um id: " + searchId);
    }
  }

  if (searchId) {
    // 2. searches: linha correta, texto trimado, status 'nova'
    const { data: s } = await db.from("searches").select("*").eq("id", searchId).single();
    if (s && s.regiao_texto === "__check_pesquisa__" && s.nicho === "dentistas" && s.status === "nova") {
      pass("searches: linha criada, texto trimado, status = 'nova'");
    } else {
      bad("searches: linha inesperada -> " + JSON.stringify(s));
    }

    // 3. jobs: job de descoberta enfileirado
    const { data: jobs } = await db.from("jobs").select("*").eq("search_id", searchId);
    if (jobs && jobs.length === 1 && jobs[0].tipo === "descobrir" && jobs[0].status === "pendente") {
      pass("jobs: 1 job 'descobrir' com status 'pendente'");
    } else {
      bad("jobs: esperado 1 job pendente -> " + JSON.stringify(jobs));
    }
  }

  // 4. atomicidade: chamada invalida (orcamento nulo) nao deixa lixo
  {
    const antes = (await db.from("searches").select("id", { count: "exact", head: true })).count ?? 0;
    const { error } = await db.rpc("criar_pesquisa", {
      p_regiao: "__check_atomic__",
      p_nicho: "x",
      p_raio_km: 1,
      p_limite_leads: 1,
      p_orcamento_chamadas: null, // NOT NULL -> a funcao inteira deve falhar
    });
    const depois = (await db.from("searches").select("id", { count: "exact", head: true })).count ?? 0;
    if (error && antes === depois) pass("chamada invalida falhou SEM criar pesquisa nem job (atomico)");
    else bad(`atomicidade: error=${Boolean(error)} antes=${antes} depois=${depois}`);
    await db.from("searches").delete().eq("regiao_texto", "__check_atomic__");
  }

  // 5. conexao ruim -> erro tratavel, sem crash
  {
    const ruim = createClient(url, "chave-invalida-de-proposito", { auth: { persistSession: false } });
    const { error } = await ruim.rpc("criar_pesquisa", {
      p_regiao: "x", p_nicho: "y", p_raio_km: 1, p_limite_leads: 1, p_orcamento_chamadas: 1,
    });
    if (error) pass("conexao/credencial ruim retorna { error } (nao derruba o processo)");
    else bad("esperava erro com credencial invalida");
  }
} catch (e) {
  bad("EXCECAO: " + (e instanceof Error ? e.message : String(e)));
} finally {
  if (searchId) await db.from("searches").delete().eq("id", searchId); // cascata apaga o job
  await db.from("searches").delete().eq("regiao_texto", "__check_pesquisa__");
  await db.from("searches").delete().eq("regiao_texto", "__check_atomic__");
  console.log("  [ok] dados de teste removidos");
}

console.log(`\nResultado: ${ok} ok, ${fail} falha(s).\n`);
process.exit(fail > 0 ? 1 : 0);
