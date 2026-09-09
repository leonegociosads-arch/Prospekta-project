// Enfileira jobs "detectar_ads" para os leads de uma pesquisa (ou de todos).
// Normalmente nao precisa: o handler de analisar_site ja enfileira este junto.
// Util para reprocessar depois de configurar o META_AD_LIBRARY_TOKEN.
//
// Uso:
//   npm run ads -- <searchId>
//   npm run ads -- --todos
// Depois:  npm run worker

import { createClient } from "@supabase/supabase-js";
import { enfileirarDetecaoAds } from "../lib/ads/enfileirar";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("[x] .env.local sem Supabase");
  process.exit(1);
}

const arg = process.argv[2];
if (!arg) {
  console.error('Informe o id da pesquisa ou "--todos".');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const temToken = (process.env.META_AD_LIBRARY_TOKEN ?? "").trim() !== "";

const r =
  arg === "--todos"
    ? await enfileirarDetecaoAds(db)
    : await enfileirarDetecaoAds(db, { searchId: arg });

console.log(`
Meta Ad Library ....: ${temToken ? "configurada" : "desligada (veredito so pelos sinais do site)"}

Leads candidatos ...: ${r.candidatos}
Ja tinham job ......: ${r.jaTinhamJob}
Jobs enfileirados ..: ${r.enfileirados}

Agora rode:  npm run worker
`);
