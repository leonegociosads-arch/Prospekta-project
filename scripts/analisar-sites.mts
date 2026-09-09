// Enfileira jobs "analisar_site" para os leads de uma pesquisa (ou de todas).
// NAO analisa nada aqui — quem processa e o worker (npm run worker).
//
// Uso:
//   npm run analisar:sites -- <searchId>     enfileira os leads dessa pesquisa
//   npm run analisar:sites -- --todos        enfileira todos os leads com site

import { createClient } from "@supabase/supabase-js";
import { enfileirarAnalisesDeSite } from "../lib/analise-site/enfileirar";

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
    ? await enfileirarAnalisesDeSite(db)
    : await enfileirarAnalisesDeSite(db, { searchId: arg });

console.log(`
Leads com site .......: ${r.candidatos}
Jobs enfileirados ....: ${r.enfileirados}
Ja tinham job ........: ${r.jaTinhamJob}
Leads sem site .......: ${r.semSite}

Agora rode:  npm run worker
`);
