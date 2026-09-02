// Teste minimo do banco: escrita, leitura, relacionamento e tratamento de erro.
// Cria pouquissimos registros com uma TAG unica e APAGA tudo no final (ate se falhar).
// Uso:  npm run db:smoke

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("\n[x] .env.local incompleto (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)\n");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const TAG = "__smoke__" + Date.now();
let ok = 0;
let fail = 0;
const pass = (m) => {
  console.log("  [ok] " + m);
  ok++;
};
const bad = (m) => {
  console.log("  [x]  " + m);
  fail++;
};

const criado = { searches: [], leads: [], places: [] };

try {
  console.log("\n1) ESCRITA");

  const placeId = TAG + "-place";
  {
    const { error } = await db.from("places_cache").insert({
      google_place_id: placeId,
      resultado_busca: { origem: "smoke", nome: TAG },
    });
    if (error) throw new Error("insert places_cache: " + error.message);
    criado.places.push(placeId);
    pass("inseriu places_cache");
  }

  let searchId;
  {
    const { data, error } = await db
      .from("searches")
      .insert({ regiao_texto: TAG, nicho: "Teste", raio_km: 5, status: "nova" })
      .select("id")
      .single();
    if (error) throw new Error("insert searches: " + error.message);
    searchId = data.id;
    criado.searches.push(searchId);
    pass("inseriu search");
  }

  let leadId;
  {
    const { data, error } = await db
      .from("leads")
      .insert({
        nome: TAG + " Advocacia",
        google_place_id: placeId,
        fonte: "google_places",
        bruto: { teste: true },
      })
      .select("id")
      .single();
    if (error) throw new Error("insert leads: " + error.message);
    leadId = data.id;
    criado.leads.push(leadId);
    pass("inseriu lead (com google_place_id -> FK para places_cache)");
  }

  {
    const { error } = await db.from("search_leads").insert({ search_id: searchId, lead_id: leadId });
    if (error) throw new Error("insert search_leads: " + error.message);
    pass("vinculou search_leads (relacionamento N:N)");
  }

  console.log("\n2) LEITURA + RELACIONAMENTO");
  {
    const { data, error } = await db
      .from("search_leads")
      .select("visto_em, leads(id, nome)")
      .eq("search_id", searchId);
    if (error) throw new Error("join search_leads->leads: " + error.message);
    if (data.length === 1 && data[0].leads?.id === leadId) pass("join search -> leads retornou o lead certo");
    else bad("join nao retornou o esperado: " + JSON.stringify(data));
  }
  {
    const { data, error } = await db
      .from("leads")
      .select("nome, places_cache(google_place_id)")
      .eq("id", leadId)
      .single();
    if (error) throw new Error("join leads->places_cache: " + error.message);
    if (data.places_cache?.google_place_id === placeId) pass("join lead -> places_cache ok");
    else bad("join places falhou: " + JSON.stringify(data));
  }

  console.log("\n3) TRATAMENTO DE ERRO  (aqui o esperado e FALHAR de forma controlada)");
  {
    const { error } = await db
      .from("search_leads")
      .insert({ search_id: "00000000-0000-0000-0000-000000000000", lead_id: leadId });
    if (error && (error.code === "23503" || /foreign key/i.test(error.message)))
      pass("FK invalida rejeitada (23503) e o script continua");
    else bad("FK invalida NAO foi rejeitada: " + JSON.stringify(error));
  }
  {
    const { error } = await db.from("leads").insert({ nome: TAG + " dup", google_place_id: placeId });
    if (error && (error.code === "23505" || /duplicate key/i.test(error.message)))
      pass("google_place_id duplicado rejeitado (23505)");
    else bad("UNIQUE de google_place_id NAO respeitado: " + JSON.stringify(error));
  }
  {
    const { error } = await db
      .from("searches")
      .insert({ regiao_texto: TAG, nicho: "x", status: "valor_invalido" });
    if (error && (error.code === "23514" || /check constraint/i.test(error.message)))
      pass("status invalido rejeitado pelo CHECK (23514)");
    else bad("CHECK de status NAO aplicado -> a migration 0003 ja foi rodada no Supabase?");
  }
  {
    const { error } = await db.from("tabela_que_nao_existe").select("*").limit(1);
    if (error) pass("tabela inexistente retorna erro tratavel (nao derruba o processo)");
    else bad("esperava erro para tabela inexistente");
  }
} catch (e) {
  bad("EXCECAO nao esperada: " + e.message);
} finally {
  console.log("\n4) LIMPEZA");
  for (const id of criado.searches) await db.from("searches").delete().eq("id", id);
  for (const id of criado.leads) await db.from("leads").delete().eq("id", id);
  for (const id of criado.places) await db.from("places_cache").delete().eq("google_place_id", id);
  // varredura de seguranca por TAG
  await db.from("searches").delete().eq("regiao_texto", TAG);
  await db.from("leads").delete().like("nome", TAG + "%");
  await db.from("places_cache").delete().eq("google_place_id", TAG + "-place");
  console.log("  [ok] dados de teste removidos");
}

console.log(`\nResultado: ${ok} ok, ${fail} falha(s).\n`);
process.exit(fail > 0 ? 1 : 0);
