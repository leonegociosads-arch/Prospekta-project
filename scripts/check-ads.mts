// Integracao da deteccao de indicios de trafego pago: Supabase real + Meta Ad
// Library FAKE (nao chama a API do Facebook). Cobre: veredito pelos sinais do
// site, "nenhum", sem site, Meta "sim", Meta com erro (nao lanca), cache, worker.
//
// Uso:  npm run check:ads   (precisa das migrations 0003, 0006 e 0013)

import { createClient } from "@supabase/supabase-js";
import { analisarAds } from "../lib/ads/analisar-ads";
import { rodarWorker } from "../worker/loop";
import { REGISTRO_PADRAO } from "../worker/registro";
import type { ResultadoMetaAdLibrary } from "../lib/ads/tipos";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("\n[x] .env.local incompleto\n");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const FONTE = "__check_ads__";
const INICIO = new Date().toISOString();
let ok = 0;
let fail = 0;
const pass = (m: string) => {
  console.log("  [ok] " + m);
  ok++;
};
const bad = (m: string) => {
  console.log("  [x]  " + m);
  fail++;
};

const metaComAnuncios: ResultadoMetaAdLibrary = { encontrado: "sim", quantidade: 3, fonte: "api", detalhe: "3 anuncios" };
const consultarComAnuncios = async () => metaComAnuncios;
const consultarQuebra = async () => {
  throw new Error("ECONNRESET");
};

async function novoLead(over: Record<string, unknown>): Promise<string> {
  const { data, error } = await db
    .from("leads")
    .insert({ fonte: FONTE, nome: "Lead ads", ...over })
    .select("id")
    .single();
  if (error) throw new Error("insert lead: " + error.message);
  return String(data!.id);
}
async function porSite(leadId: string, campos: Record<string, unknown>) {
  const { error } = await db
    .from("site_analyses")
    .upsert({ lead_id: leadId, verificado_em: new Date().toISOString(), site_existe: true, ...campos }, { onConflict: "lead_id" });
  if (error) throw new Error("upsert site_analyses: " + error.message);
}
const lerAds = async (leadId: string) =>
  (await db.from("ad_signals").select("*").eq("lead_id", leadId).maybeSingle()).data as Record<string, unknown> | null;

async function limpar() {
  const { data } = await db.from("leads").select("id").eq("fonte", FONTE);
  for (const l of data ?? []) await db.from("jobs").delete().eq("lead_id", l.id);
  await db.from("leads").delete().eq("fonte", FONTE); // cascata: site_analyses, ad_signals
  await db.from("api_usage").delete().eq("endpoint", "meta_ad_library").gte("em", INICIO);
}

try {
  await limpar();

  // A) site com tag de conversao + pixel -> forte/alguns, google_ads_no_site true
  {
    const A = await novoLead({});
    await porSite(A, { tem_google_ads: true, tem_doubleclick: false, tem_meta_pixel: true, tem_gtm: true });
    const r = await analisarAds({ db }, A, { forcar: true });
    const row = await lerAds(A);
    if (
      r.status === "ok" &&
      (r.veredito === "forte" || r.veredito === "alguns") &&
      row?.google_ads_no_site === true &&
      row?.meta_ads_encontrado === "desconhecido"
    )
      pass(`site com tag de conversao -> veredito "${r.veredito}", Meta desconhecida`);
    else bad("A inesperado: " + JSON.stringify({ r, row }));
  }

  // B) site sem nenhuma tag -> "nenhum" / confianca baixa
  {
    const B = await novoLead({});
    await porSite(B, { tem_google_ads: false, tem_doubleclick: false, tem_meta_pixel: false, tem_gtm: false });
    const r = await analisarAds({ db }, B, { forcar: true });
    if (r.veredito === "nenhum" && r.confianca === "baixa")
      pass('site sem tags -> veredito "nenhum", confianca baixa (nao afirma "nao anuncia")');
    else bad("B inesperado: " + JSON.stringify(r));
  }

  // C) sem site analisado -> veredito null
  {
    const C = await novoLead({});
    const r = await analisarAds({ db }, C, { forcar: true });
    const row = await lerAds(C);
    if (r.veredito === null && row && (row.evidencias as { resumo?: string }).resumo?.includes("não foi analisado"))
      pass("sem boletim de site -> sem veredito, resumo explica");
    else bad("C inesperado: " + JSON.stringify({ r, row }));
  }

  // D) Meta fake retorna "sim" -> forte / confianca alta
  {
    const D = await novoLead({});
    await porSite(D, { tem_google_ads: false, tem_meta_pixel: false });
    const r = await analisarAds({ db, metaToken: "fake", consultarMeta: consultarComAnuncios }, D, { forcar: true });
    const row = await lerAds(D);
    if (r.veredito === "forte" && r.confianca === "alta" && row?.meta_ads_encontrado === "sim" && row?.meta_ads_qtd === 3)
      pass('Meta Ad Library "sim" -> veredito forte, confianca alta');
    else bad("D inesperado: " + JSON.stringify({ r, row }));
  }

  // E) Meta fake lanca -> analisarAds NAO lanca; veredito ainda sai dos sinais do site
  {
    const E = await novoLead({});
    await porSite(E, { tem_google_ads: true, tem_meta_pixel: true, tem_doubleclick: true });
    let lancou = false;
    let r;
    try {
      r = await analisarAds({ db, metaToken: "fake", consultarMeta: consultarQuebra }, E, { forcar: true });
    } catch {
      lancou = true;
    }
    const row = await lerAds(E);
    if (!lancou && r?.status === "ok" && r.veredito && row?.meta_ads_encontrado === "desconhecido")
      pass("Meta com erro -> analisarAds nao lanca, veredito sai dos sinais do site");
    else bad("E inesperado: " + JSON.stringify({ lancou, r, row }));
  }

  // F) cache: 2a chamada dentro do TTL -> pulado
  {
    const F = await novoLead({});
    await porSite(F, { tem_google_ads: true });
    await analisarAds({ db }, F, { forcar: true });
    const r2 = await analisarAds({ db }, F);
    if (r2.status === "pulado-cache") pass("2a deteccao dentro do TTL -> pulada");
    else bad("F inesperado: " + JSON.stringify(r2));
  }

  // G) worker processa "detectar_ads"
  {
    const G = await novoLead({});
    await porSite(G, { tem_google_ads: false, tem_meta_pixel: true });
    const { error } = await db.from("jobs").insert({ tipo: "detectar_ads", lead_id: G, status: "pendente", payload: {} });
    if (error) throw new Error("insert job: " + error.message);
    const resumo = await rodarWorker({ db, registro: REGISTRO_PADRAO, sinal: { parar: false }, once: true, recuperarTravadosMin: null });
    const row = await lerAds(G);
    if (resumo.feitos === 1 && row && typeof row.veredito !== "undefined")
      pass("worker processou 'detectar_ads' -> linha em ad_signals");
    else bad("G inesperado: " + JSON.stringify({ resumo, row }));
  }
} catch (e) {
  bad("EXCECAO: " + (e instanceof Error ? e.message : String(e)));
} finally {
  await limpar();
  console.log("  [ok] dados de teste removidos");
}

console.log(`\nResultado: ${ok} ok, ${fail} falha(s).\n`);
process.exit(fail > 0 ? 1 : 0);
