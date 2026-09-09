// Integracao do enriquecimento: fluxo cache -> budget -> usage, SEM tocar no Google
// (fetch fake). Usa o Supabase real para lead / places_cache / api_usage.
//
// Uso:  npm run check:enriquecimento   (precisa das migrations 0007-0009 aplicadas)

import { createClient } from "@supabase/supabase-js";
import { enriquecerLead } from "../lib/enriquecimento/enriquecer";
import type { GuardaConfig } from "../lib/guardas/config";
import { ErroDeOrcamento } from "../lib/guardas/erros";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) { console.error("\n[x] .env.local incompleto\n"); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

const FONTE = "__check_enr__";
const PID = "__check_enr_PID__";
const inicio = new Date().toISOString();

let ok = 0;
let fail = 0;
const pass = (m: string) => { console.log("  [ok] " + m); ok++; };
const bad = (m: string) => { console.log("  [x]  " + m); fail++; };

const DET = {
  id: PID,
  displayName: { text: "Enriq Teste" },
  formattedAddress: "Rua X, 1",
  googleMapsUri: "https://maps.google.com/?cid=123",
  internationalPhoneNumber: "+55 13 3841-1234",
  nationalPhoneNumber: "(13) 3841-1234",
  websiteUri: "https://enriqteste.exemplo",
  regularOpeningHours: {
    openNow: true,
    weekdayDescriptions: ["segunda-feira: 09:00 – 18:00", "terca-feira: 09:00 – 18:00"],
  },
  businessStatus: "OPERATIONAL",
  rating: 4.6,
  userRatingCount: 33,
  reviews: [
    { authorAttribution: { displayName: "Fulano" }, rating: 5, text: { text: "Otimo atendimento" }, relativePublishTimeDescription: "ha 1 mes", publishTime: "2026-08-01T00:00:00Z" },
  ],
};

let chamadas = 0;
let ultimoFieldMask = "";
const fetchFake = (async (_u: string, init: RequestInit) => {
  chamadas++;
  ultimoFieldMask = (init.headers as Record<string, string>)["X-Goog-FieldMask"] ?? "";
  return new Response(JSON.stringify(DET), { status: 200, headers: { "content-type": "application/json" } });
}) as unknown as typeof fetch;

const configOk: GuardaConfig = { tetoMensalChamadas: 1_000_000, ttlBuscaDias: 60, ttlDetalhesDias: 30, ttlSiteDias: 14, ttlSocialDias: 30, pagespeedAtivo: false };
const configSemBudget: GuardaConfig = { ...configOk, tetoMensalChamadas: 0 };

async function novoLead(comPlaceId: boolean): Promise<string> {
  const { data, error } = await db
    .from("leads")
    .insert({ fonte: FONTE, nome: "Lead enriquecimento", google_place_id: comPlaceId ? PID : null })
    .select("id")
    .single();
  if (error) throw new Error("insert lead: " + error.message);
  return String(data!.id);
}
const envelhecer = async (leadId: string) => {
  // alem do TTL de 30 dias do cache de detalhes E alem da janela de 90s
  const old = new Date(Date.now() - 40 * 24 * 60 * 60_000).toISOString();
  await db.from("leads").update({ enriquecido_em: old }).eq("id", leadId);
  await db.from("places_cache").update({ detalhes_em: old }).eq("google_place_id", PID);
};
const usosPlaceDetails = async () =>
  ((await db.from("api_usage").select("id").eq("endpoint", "place_details").gte("em", inicio)).data ?? []).length;

async function limpar() {
  const { data } = await db.from("leads").select("id").eq("fonte", FONTE);
  for (const l of data ?? []) await db.from("jobs").delete().eq("lead_id", l.id);
  await db.from("leads").delete().eq("fonte", FONTE);
  await db.from("places_cache").delete().like("google_place_id", "__check_enr%");
  await db.from("api_usage").delete().eq("endpoint", "place_details").gte("em", inicio);
}

try {
  await limpar();

  // 0) sem place id
  {
    const semPid = await novoLead(false);
    const r = await enriquecerLead({ db, apiKey: "K", fetchImpl: fetchFake }, semPid);
    if (r.status === "sem-place-id" && chamadas === 0) pass("lead sem Place ID -> 'sem-place-id', 0 chamadas");
    else bad("sem-place-id inesperado: " + JSON.stringify(r));
  }

  // places_cache antes do lead (leads.google_place_id tem FK -> places_cache)
  await db.from("places_cache").upsert({ google_place_id: PID, resultado_busca: {}, busca_em: new Date().toISOString() });
  const lead = await novoLead(true);

  // 1) primeira chamada -> google, grava tudo, registra uso
  {
    chamadas = 0;
    const r = await enriquecerLead({ db, apiKey: "K", fetchImpl: fetchFake, guardaConfig: configOk }, lead);
    const { data: L } = await db.from("leads").select("maps_uri, horarios, telefone_internacional, enriquecido_em").eq("id", lead).single();
    const { data: PC } = await db.from("places_cache").select("detalhes").eq("google_place_id", PID).single();
    const uso = await usosPlaceDetails();
    if (
      r.status === "enriquecido" && r.fonte === "google" && r.registradoUso &&
      chamadas === 1 && uso === 1 &&
      L?.maps_uri === DET.googleMapsUri && Array.isArray(L?.horarios) && L?.telefone_internacional === DET.internationalPhoneNumber &&
      L?.enriquecido_em && PC?.detalhes
    ) pass("1a chamada: Google + grava lead/places_cache/api_usage");
    else bad("1a chamada inesperada: " + JSON.stringify({ r, L, uso, chamadas }));
  }

  // 2) clique repetido (dentro de 90s) -> nao chama
  {
    chamadas = 0;
    const r = await enriquecerLead({ db, apiKey: "K", fetchImpl: fetchFake, guardaConfig: configOk }, lead);
    if (r.status === "cache" && chamadas === 0 && (await usosPlaceDetails()) === 1)
      pass("clique repetido em <90s -> usa cache, 0 chamadas, 0 novos usos");
    else bad("dedupe 90s inesperado: " + JSON.stringify({ r, chamadas }));
  }

  // 3) fora da janela de 90s, mas cache de detalhes ainda valido no TTL -> nao chama
  {
    await db.from("leads").update({ enriquecido_em: new Date(Date.now() - 5 * 60_000).toISOString() }).eq("id", lead);
    chamadas = 0;
    const r = await enriquecerLead({ db, apiKey: "K", fetchImpl: fetchFake, guardaConfig: configOk }, lead);
    if (r.status === "cache" && chamadas === 0 && (await usosPlaceDetails()) === 1)
      pass("detalhes em cache dentro do TTL -> usa cache, nao chama o Google de novo");
    else bad("cache TTL inesperado: " + JSON.stringify({ r, chamadas }));
  }

  // 4) budget estourado -> ErroDeOrcamento, nao chama, nao registra
  {
    await envelhecer(lead);
    chamadas = 0;
    let bloqueou = false;
    try {
      await enriquecerLead({ db, apiKey: "K", fetchImpl: fetchFake, guardaConfig: configSemBudget }, lead);
    } catch (e) {
      bloqueou = e instanceof ErroDeOrcamento;
    }
    if (bloqueou && chamadas === 0 && (await usosPlaceDetails()) === 1)
      pass("budget estourado -> ErroDeOrcamento, 0 chamadas, 0 novos usos");
    else bad("budget inesperado: " + JSON.stringify({ bloqueou, chamadas }));
  }

  // 5) cache expirado + budget ok -> chama de novo
  {
    await envelhecer(lead);
    chamadas = 0;
    const r = await enriquecerLead({ db, apiKey: "K", fetchImpl: fetchFake, guardaConfig: configOk }, lead);
    if (r.status === "enriquecido" && chamadas === 1 && (await usosPlaceDetails()) === 2)
      pass("cache expirado -> nova chamada + novo registro de uso");
    else bad("reenriquecimento inesperado: " + JSON.stringify({ r, chamadas }));
  }

  // 6) FieldMask: sem "*"; reviews so quando pedido
  {
    await envelhecer(lead);
    await enriquecerLead({ db, apiKey: "K", fetchImpl: fetchFake, guardaConfig: configOk }, lead, { incluirReviews: false });
    const semRev = ultimoFieldMask;
    await envelhecer(lead);
    await enriquecerLead({ db, apiKey: "K", fetchImpl: fetchFake, guardaConfig: configOk }, lead, { incluirReviews: true });
    const comRev = ultimoFieldMask;
    if (!semRev.includes("*") && !semRev.includes("reviews") && comRev.includes("reviews"))
      pass('FieldMask explicito (sem "*"); "reviews" so quando pedido');
    else bad("FieldMask inesperado: " + JSON.stringify({ semRev, comRev }));
  }
} catch (e) {
  bad("EXCECAO: " + (e instanceof Error ? e.message : String(e)));
} finally {
  await limpar();
  console.log("  [ok] dados de teste removidos");
}

console.log(`\nResultado: ${ok} ok, ${fail} falha(s).\n`);
process.exit(fail > 0 ? 1 : 0);
