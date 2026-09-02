// Verifica a conexao com o Supabase e se as 12 tabelas do Prospekta existem.
// Uso:  npm run check:supabase

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("\n[x] Falta preencher no .env.local:");
  if (!url) console.error("    NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) console.error("    SUPABASE_SERVICE_ROLE_KEY");
  console.error("");
  process.exit(1);
}

console.log("\nProjeto:", url);

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

// Ordem = ordem das migrations
const esperadas = [
  // 0001
  "searches",
  "region_cache",
  "places_cache",
  "leads",
  "search_leads",
  "api_usage",
  // 0003
  "site_analyses",
  "ad_signals",
  "social_analyses",
  "scores",
  "ai_diagnoses",
  "jobs",
];

let faltando = 0;

for (const tabela of esperadas) {
  // .select("*").limit(1) da erro claro (PGRST205) se a tabela nao existe
  const { error } = await supabase.from(tabela).select("*").limit(1);

  if (error) {
    faltando++;
    console.log(`  [x]  ${tabela.padEnd(16)} -> ${error.message}`);
  } else {
    console.log(`  [ok] ${tabela.padEnd(16)}`);
  }
}

if (faltando > 0) {
  console.error(
    `\n[x] ${faltando} tabela(s) faltando.` +
      `\n    Rode as migrations que faltam (supabase/migrations/) no SQL Editor do Supabase.\n`,
  );
  process.exit(1);
}

console.log("\n[ok] Conexao e as 12 tabelas conferidas.\n");
