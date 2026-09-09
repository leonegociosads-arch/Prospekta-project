// Integracao da analise tecnica de site.
//  - SSRF: destinos internos sao bloqueados ANTES de qualquer fetch;
//  - site controlado real (example.com) -> grava boletim;
//  - site que nao responde -> registra erro, NAO lanca;
//  - sem site -> status "sem-site";
//  - cache -> 2a chamada e pulada;
//  - handler do worker processa o job.
//
// Uso:  npm run check:analise   (precisa das migrations 0006 e 0007 aplicadas)

import { createClient } from "@supabase/supabase-js";
import { validarUrlPublica, ErroSSRF } from "../lib/analise-site/ssrf";
import { analisarSite } from "../lib/analise-site/analisar";
import { rodarWorker } from "../worker/loop";
import { REGISTRO_PADRAO } from "../worker/registro";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("\n[x] .env.local incompleto\n");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

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

const FONTE = "__check_analise__";
const resolverFake = async (host: string) => {
  // dominios "maliciosos" que resolveriam para IP interno
  if (host === "rebind.exemplo") return [{ address: "10.1.2.3", family: 4 }];
  return [{ address: "93.184.216.34", family: 4 }]; // example.com-ish, publico
};

async function novoLead(nome: string, siteUrl: string | null): Promise<string> {
  const { data, error } = await db
    .from("leads")
    .insert({ fonte: FONTE, nome, site_url: siteUrl })
    .select("id")
    .single();
  if (error) throw new Error("insert lead: " + error.message);
  return String(data!.id);
}
const lerAnalise = async (leadId: string) =>
  (await db.from("site_analyses").select("*").eq("lead_id", leadId).maybeSingle()).data as
    | Record<string, unknown>
    | null;

async function limpar() {
  const { data } = await db.from("leads").select("id").eq("fonte", FONTE);
  for (const l of data ?? []) {
    await db.from("jobs").delete().eq("lead_id", l.id);
    await db.from("site_analyses").delete().eq("lead_id", l.id);
  }
  await db.from("leads").delete().eq("fonte", FONTE);
}

try {
  await limpar();

  // 1) SSRF: destinos internos bloqueados (sem tocar em rede)
  const internos = [
    "http://localhost/",
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://192.168.0.1/",
    "http://10.0.0.5/",
    "http://[::1]/",
    "https://metadata.google.internal/",
    "ftp://example.com/",
    "file:///etc/passwd",
  ];
  let bloqueou = 0;
  for (const u of internos) {
    try {
      await validarUrlPublica(u, { resolver: resolverFake });
      bad(`SSRF NAO bloqueou: ${u}`);
    } catch (e) {
      if (e instanceof ErroSSRF) bloqueou++;
      else bad(`SSRF erro inesperado em ${u}: ${e}`);
    }
  }
  if (bloqueou === internos.length) pass(`SSRF bloqueou os ${internos.length} destinos internos/invalidos`);

  // 1b) dominio que resolve para IP interno (rebind) -> bloqueado
  try {
    await validarUrlPublica("http://rebind.exemplo/", { resolver: resolverFake });
    bad("SSRF NAO bloqueou dominio que resolve para 10.x");
  } catch (e) {
    if (e instanceof ErroSSRF) pass("SSRF bloqueou dominio que resolve para IP interno");
    else bad("erro inesperado: " + e);
  }

  // 1c) URL publica normal passa
  try {
    await validarUrlPublica("https://example.com/", { resolver: resolverFake });
    pass("SSRF deixa passar URL publica normal");
  } catch (e) {
    bad("SSRF bloqueou URL publica: " + e);
  }

  // 2) site controlado real
  {
    const id = await novoLead("Site OK", "https://example.com");
    const r = await analisarSite({ db }, id);
    const a = await lerAnalise(id);
    if (r.status === "ok" && a?.site_existe === true && a?.https === true && a?.status_http === 200)
      pass("example.com -> boletim gravado (site_existe, https, 200)");
    else bad("analise de example.com inesperada: " + JSON.stringify({ r, a }));

    // 5) cache: 2a chamada e pulada
    const r2 = await analisarSite({ db }, id);
    if (r2.status === "pulado-cache") pass("2a analise dentro do TTL -> pulada (cache)");
    else bad("cache nao funcionou: " + JSON.stringify(r2));

    // forcar refaz
    const r3 = await analisarSite({ db }, id, { forcar: true });
    if (r3.status === "ok") pass("forcar=true refaz a analise");
    else bad("forcar inesperado: " + JSON.stringify(r3));
  }

  // 3) site que nao responde -> registra erro, NAO lanca
  {
    const id = await novoLead("Site fora do ar", "http://example.com:81");
    const r = await analisarSite({ db, baixarOpts: { timeoutMs: 4000 } }, id);
    const a = await lerAnalise(id);
    if (r.status === "site-falhou" && a?.site_existe === false && typeof a?.erro === "string")
      pass("site sem resposta -> site_existe=false + erro gravado, sem excecao");
    else bad("site fora do ar inesperado: " + JSON.stringify({ r, a }));
  }

  // 4) SSRF via analisarSite -> status bloqueado-ssrf
  {
    const id = await novoLead("Site interno", "http://169.254.169.254/");
    const r = await analisarSite({ db }, id);
    const a = await lerAnalise(id);
    if (r.status === "bloqueado-ssrf" && typeof a?.erro === "string" && a.erro.includes("SSRF"))
      pass("site_url apontando para metadata -> bloqueado-ssrf, erro gravado");
    else bad("bloqueio SSRF via analisarSite inesperado: " + JSON.stringify({ r, a }));
  }

  // 6) sem site
  {
    const id = await novoLead("Sem site", null);
    const r = await analisarSite({ db }, id);
    if (r.status === "sem-site") pass("lead sem site_url -> status 'sem-site'");
    else bad("sem-site inesperado: " + JSON.stringify(r));
  }

  // 7) handler do worker processa o job
  {
    const id = await novoLead("Via worker", "https://example.com");
    const { error } = await db
      .from("jobs")
      .insert({ tipo: "analisar_site", lead_id: id, status: "pendente", payload: {} });
    if (error) throw new Error("insert job: " + error.message);
    const resumo = await rodarWorker({
      db,
      registro: REGISTRO_PADRAO,
      sinal: { parar: false },
      once: true,
      recuperarTravadosMin: null,
    });
    const { data: job } = await db
      .from("jobs")
      .select("status")
      .eq("lead_id", id)
      .eq("tipo", "analisar_site")
      .single();
    // o handler encadeia calcular_score e detectar_ads (jobs a mais no mesmo passo)
    if (resumo.feitos >= 1 && job?.status === "feito") pass("worker processou o job 'analisar_site' -> feito");
    else bad("worker inesperado: " + JSON.stringify({ resumo, job }));
  }
} catch (e) {
  bad("EXCECAO: " + (e instanceof Error ? e.message : String(e)));
} finally {
  await limpar();
  console.log("  [ok] dados de teste removidos");
}

console.log(`\nResultado: ${ok} ok, ${fail} falha(s).\n`);
process.exit(fail > 0 ? 1 : 0);
