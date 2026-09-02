// Verifica a conexao com o Supabase e se a migration 0001 foi aplicada.
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

const esperadas = [
  "searches",
  "region_cache",
  "places_cache",
  "leads",
  "search_leads",
  "api_usage",
];

let faltando = 0;

for (const tabela of esperadas) {
  const { error, count } = await supabase
    .from(tabela)
    .select("*", { count: "exact", head: true });

  if (error) {
    faltando++;
    console.log(`  [x] ${tabela.padEnd(14)} -> ${error.message}`);
  } else {
    console.log(`  [ok] ${tabela.padEnd(14)} -> ${count} linha(s)`);
  }
}

if (faltando > 0) {
  console.error(
    `\n[x] ${faltando} tabela(s) faltando. Rode supabase/migrations/0001_descoberta.sql no SQL Editor do Supabase.\n`,
  );
  process.exit(1);
}

console.log("\n[ok] Conexao e schema conferidos.\n");
