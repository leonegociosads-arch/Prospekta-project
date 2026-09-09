// Enfileira jobs "calcular_score" para os leads de uma pesquisa (ou de todos).
// Score nao faz chamada externa. Quem processa e o worker.
//
// Uso:
//   npm run score -- <searchId>
//   npm run score -- --todos

import { createClient } from "@supabase/supabase-js";
import { enfileirarScores } from "../lib/score/enfileirar";

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
    ? await enfileirarScores(db)
    : await enfileirarScores(db, { searchId: arg });

console.log(`
Leads candidatos .....: ${r.candidatos}
Jobs enfileirados ....: ${r.enfileirados}
Ja tinham job ........: ${r.jaTinhamJob}

Agora rode:  npm run worker
`);
