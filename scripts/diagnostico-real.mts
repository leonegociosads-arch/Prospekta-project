// Diagnostico com IA de UM lead real, com UMA chamada real ao modelo.
// Use so depois de aplicar a migration 0011 e por GEMINI_API_KEY no .env.local.
//
// Uso:  npm run diagnostico:real -- <leadId>

import { createClient } from "@supabase/supabase-js";
import { diagnosticarLead } from "../lib/ia/diagnosticar";
import { carregarConfigIa } from "../lib/ia/config-ia";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const apiKey = process.env.GEMINI_API_KEY;
if (!url || !key) {
  console.error("[x] .env.local sem Supabase");
  process.exit(1);
}
if (!apiKey) {
  console.error("[x] GEMINI_API_KEY nao esta no .env.local");
  process.exit(1);
}

const leadId = process.argv[2];
if (!leadId) {
  console.error("Informe o id do lead: npm run diagnostico:real -- <leadId>");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const cfg = carregarConfigIa();

console.log(`\nModelo: ${cfg.modelo} · lead: ${leadId}\nChamando o modelo (1 chamada)...\n`);

const r = await diagnosticarLead({ db, apiKey }, leadId, { ignorarElegibilidade: true });

console.log("status .........:", r.status);
console.log("fonte ..........:", r.fonte);
console.log("tokens .........:", (r.tokensEntrada ?? 0) + "in +" + (r.tokensSaida ?? 0) + "out");
console.log("custo (USD) ....:", r.custoUsd);
if (r.erro) console.log("erro ...........:", r.erro);
if (r.diagnostico) {
  console.log("\n--- dossie ---");
  console.log("resumo:", r.diagnostico.resumo);
  console.log("pontos fortes:", r.diagnostico.pontosFortes);
  console.log("pontos fracos:", r.diagnostico.pontosFracos);
  console.log("proposta:", r.diagnostico.proposta);
  console.log("estrategia:", r.diagnostico.estrategia);
  console.log("mensagem inicial:", r.diagnostico.mensagemInicial);
  console.log("objecoes:", r.diagnostico.objecoes);
  console.log("confianca:", r.diagnostico.confianca);
  console.log("fatos utilizados:", r.diagnostico.fatosUtilizados);
}
console.log("");
