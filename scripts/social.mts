// Enfileira jobs "analisar_social" para os leads de uma pesquisa (ou de todos).
// Complementar. O worker processa 1 por vez (ritmo normal da fila).
//
// Uso:
//   npm run social -- <searchId>
//   npm run social -- --todos

import { createClient } from "@supabase/supabase-js";
import { enfileirarAnalisesSociais } from "../lib/analise-social/enfileirar";

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

const r =
  arg === "--todos"
    ? await enfileirarAnalisesSociais(db)
    : await enfileirarAnalisesSociais(db, { searchId: arg });

console.log(`
Leads candidatos .....: ${r.candidatos}
Jobs enfileirados ....: ${r.enfileirados}
Ja tinham job ........: ${r.jaTinhamJob}

Agora rode:  npm run worker
`);
