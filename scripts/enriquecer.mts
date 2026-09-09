// Enriquecimento profundo de UM lead real. Mostra o disclosure antes e so
// entao faz (no maximo) 1 chamada ao Place Details.
//
// Uso:
//   npm run enriquecer -- <leadId>
//   npm run enriquecer -- <leadId> --reviews

import { createClient } from "@supabase/supabase-js";
import { enriquecerLead } from "../lib/enriquecimento/enriquecer";
import { montarFieldMask, ENDPOINT_PLACE_DETAILS } from "../lib/enriquecimento/place-details";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const apiKey = process.env.GOOGLE_MAPS_API_KEY;
if (!url || !key) { console.error("[x] .env.local sem Supabase"); process.exit(1); }
if (!apiKey) { console.error("[x] GOOGLE_MAPS_API_KEY ausente"); process.exit(1); }

const leadId = process.argv[2];
const incluirReviews = process.argv.includes("--reviews");
if (!leadId) { console.error("Informe o id do lead."); process.exit(1); }

const db = createClient(url, key, { auth: { persistSession: false } });

const { data: lead } = await db
  .from("leads")
  .select("nome, google_place_id, enriquecido_em")
  .eq("id", leadId)
  .maybeSingle();
if (!lead) { console.error("[x] lead nao encontrado:", leadId); process.exit(1); }

const fieldMask = montarFieldMask(incluirReviews);

console.log(`
============================================================
 ENRIQUECIMENTO - antes de chamar o Google
============================================================
 Lead ............: ${lead.nome}
 Place ID .........: ${lead.google_place_id ?? "(sem place id -> nao vai chamar)"}
 Ja enriquecido ...: ${lead.enriquecido_em ?? "nao"}

 Endpoint .........: ${ENDPOINT_PLACE_DETAILS}{PLACE_ID}
 FieldMask (sem "*"):
   ${fieldMask}
   ${incluirReviews ? "-> INCLUI reviews (SKU Atmosphere)" : "-> sem reviews (SKU Enterprise)"}

 Numero MAXIMO de chamadas: 1
 Travas:
   - se places_cache.detalhes estiver valido no TTL (30 dias) -> usa cache, 0 chamadas
   - se o lead foi enriquecido nos ultimos 90s -> usa o que ja temos, 0 chamadas
   - chamarComGuardas verifica o teto mensal antes de chamar
   - registra em api_usage depois de chamar
============================================================
`);

const r = await enriquecerLead({ db, apiKey }, leadId, { incluirReviews });
console.log("RESULTADO:", JSON.stringify(r, null, 2));

const { data: usos } = await db
  .from("api_usage")
  .select("em, endpoint, faixa_campos, unidades, custo_estimado_usd, obs")
  .eq("endpoint", "place_details")
  .order("em", { ascending: false })
  .limit(3);
console.log("\nUltimos usos place_details:", JSON.stringify(usos, null, 2));
console.log(`\nVeja:  http://localhost:3100/lead/${leadId}\n`);
