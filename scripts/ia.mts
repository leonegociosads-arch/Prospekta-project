// Enfileira jobs "diagnosticar_ia" para os leads ELEGIVEIS de uma pesquisa
// (score >= limite OU top N). NUNCA roda em todos os leads.
//
// Uso:
//   npm run ia -- <searchId>
//   npm run ia -- --todos           (todos os leads que passam do score minimo)
//
// Depois:  npm run worker

import { createClient } from "@supabase/supabase-js";
import { enfileirarDiagnosticos } from "../lib/ia/enfileirar";
import { carregarConfigIa } from "../lib/ia/config-ia";

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
const cfg = carregarConfigIa();

const r =
  arg === "--todos"
    ? await enfileirarDiagnosticos(db)
    : await enfileirarDiagnosticos(db, { searchId: arg });

console.log(`
Modelo ...............: ${cfg.modelo}
Criterio ............: score >= ${cfg.scoreMinimo} ou top ${cfg.topN} da pesquisa
Teto de gasto/mes ...: US$ ${cfg.tetoMensalUsd}

Leads candidatos ....: ${r.candidatos}
Elegiveis ...........: ${r.elegiveis}
Ja diagnosticados ...: ${r.jaDiagnosticados}
Ja tinham job .......: ${r.jaTinhamJob}
Jobs enfileirados ...: ${r.enfileirados}

Agora rode:  npm run worker
`);
