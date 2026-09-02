// UNICA chamada real ao Google desta etapa.
// Mostra o disclosure (endpoint / FieldMask / max chamadas / trava) e so
// depois executa 1 descoberta controlada.
//
// Uso:  npm run descoberta:real
//       npm run descoberta:real -- "restaurantes" "Registro, SP" 15

import { createClient } from "@supabase/supabase-js";
import { executarDescoberta } from "../lib/descoberta/executar";
import {
  ENDPOINT_TEXT_SEARCH,
  FIELD_MASK_BUSCA,
  MAX_LEADS_POR_BUSCA,
} from "../lib/sources/google-places";
import { ENDPOINT_GEOCODING } from "../lib/descoberta/geocoding";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const apiKey = process.env.GOOGLE_MAPS_API_KEY;
if (!url || !key) { console.error("[x] .env.local sem Supabase"); process.exit(1); }
if (!apiKey) { console.error("[x] GOOGLE_MAPS_API_KEY ausente"); process.exit(1); }

const nicho = process.argv[2] ?? "advocacia";
const regiao = process.argv[3] ?? "Iguape, SP";
const raioKm = Number(process.argv[4] ?? 10);
const limite = 20;

console.log(`
============================================================
 TESTE CONTROLADO DE DESCOBERTA - antes de chamar o Google
============================================================
 Busca ...........: "${nicho} em ${regiao}"   raio ${raioKm} km   limite ${limite}

 Endpoints:
   1) Geocoding ....: ${ENDPOINT_GEOCODING}   (so se a regiao NAO estiver em cache)
   2) Text Search ..: ${ENDPOINT_TEXT_SEARCH}

 FieldMask (Text Search), explicito, sem "*":
   ${FIELD_MASK_BUSCA}
   -> sem photos, sem reviews, sem Place Details

 Numero MAXIMO de chamadas ao Google nesta execucao: 2
   (1 Geocoding + 1 Text Search; menos se a regiao ja estiver em cache)

 Travas que impedem chamadas adicionais:
   - orcamento_chamadas da pesquisa = 2  -> podeChamar() bloqueia a 3a
   - pageSize = ${MAX_LEADS_POR_BUSCA}, e o codigo NUNCA segue nextPageToken
   - teto mensal PROSPEKTA_TETO_MENSAL_CHAMADAS (${process.env.PROSPEKTA_TETO_MENSAL_CHAMADAS ?? "2000"})
   - cota rigida diaria configurada no Google Cloud (bloqueia, nao cobra)
============================================================
`);

const db = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await db.rpc("criar_pesquisa", {
  p_regiao: regiao, p_nicho: nicho, p_raio_km: raioKm, p_limite_leads: limite, p_orcamento_chamadas: 2,
});
if (error) { console.error("[x] criar_pesquisa:", error.message); process.exit(1); }
const searchId = String(data);
console.log("Pesquisa criada:", searchId, "\nExecutando...\n");

const resumo = await executarDescoberta({ db, apiKey }, searchId);
console.log("RESUMO:", JSON.stringify(resumo, null, 2));

const { data: usos } = await db.from("api_usage").select("endpoint, unidades, faixa_campos, em").eq("search_id", searchId);
console.log("\napi_usage desta pesquisa:", JSON.stringify(usos, null, 2));

const { data: s } = await db.from("searches").select("status, chamadas_feitas, custo_estimado_usd").eq("id", searchId).single();
console.log("searches:", JSON.stringify(s));

const { data: sl } = await db
  .from("search_leads")
  .select("leads(nome, categoria, avaliacao, qtd_avaliacoes, site_url, telefone, status_negocio)")
  .eq("search_id", searchId);
console.log(`\nLEADS (${sl?.length ?? 0}):`);
for (const v of sl ?? []) {
  const bruto = (v as Record<string, unknown>).leads;
  const l = (Array.isArray(bruto) ? bruto[0] : bruto) as Record<string, unknown>;
  if (!l) continue;
  const semOp = l.status_negocio && l.status_negocio !== "OPERATIONAL" ? " | " + l.status_negocio : "";
  console.log(` - ${l.nome} | ${l.categoria ?? "-"} | nota ${l.avaliacao ?? "-"} (${l.qtd_avaliacoes ?? 0}) | ${l.site_url ?? "sem site"} | ${l.telefone ?? "sem tel"}${semOp}`);
}

console.log(`\nVeja no navegador:  http://localhost:3100/pesquisa/${searchId}\n`);
