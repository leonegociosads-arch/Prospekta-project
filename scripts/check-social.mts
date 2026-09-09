// Integracao da presenca social: Supabase real + fetch/DNS fake (nao toca
// Instagram/Facebook de verdade).
//
// Cobre: link do site tem prioridade; encontrado / nao_encontrado (404) /
// desconhecido (login) / sem_link; falha nunca lanca; cache; handler do worker.
//
// Uso:  npm run check:social   (precisa das migrations 0006 e 0010 aplicadas)

import { createClient } from "@supabase/supabase-js";
import { analisarSocial } from "../lib/analise-social/analisar-social";
import { rodarWorker } from "../worker/loop";
import { REGISTRO_PADRAO } from "../worker/registro";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) { console.error("\n[x] .env.local incompleto\n"); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

const FONTE = "__check_social__";
let ok = 0;
let fail = 0;
const pass = (m: string) => { console.log("  [ok] " + m); ok++; };
const bad = (m: string) => { console.log("  [x]  " + m); fail++; };

const resolver = async () => [{ address: "93.184.216.34", family: 4 }];

const IG_PERFIL = `<!doctype html><html><head>
<meta property="og:title" content="Advocacia A (@advocacia_a) - Instagram photos and videos">
<meta property="og:description" content="1,234 Followers, 88 Following, 267 Posts - See Instagram photos and videos from Advocacia A (@advocacia_a): &quot;Direito trabalhista em Iguape&quot;">
</head><body>instagram</body></html>`;

function htmlResp(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/html" } });
}

const fetchFake = (async (u: string) => {
  const s = String(u);
  if (s.includes("site-a.exemplo")) {
    return htmlResp(`<a href="https://instagram.com/advocacia_a">IG</a><a href="https://www.facebook.com/AdvocaciaA">FB</a>`);
  }
  if (/instagram\.com\/accounts\/login/.test(s)) return htmlResp("<html><body>faca login para ver</body></html>");
  if (/instagram\.com\/advocacia_a/.test(s)) return IG_PERFIL_RESP();
  if (/facebook\.com\/AdvocaciaA/i.test(s)) return htmlResp("<html><body>Sorry, this page isn't available</body></html>", 404);
  if (/instagram\.com\/perfil_b/.test(s)) {
    return new Response(null, { status: 302, headers: { location: "https://www.instagram.com/accounts/login/?next=/perfil_b/" } });
  }
  if (/instagram\.com\/quebra/.test(s)) throw new Error("ECONNRESET");
  return htmlResp("<html><body>?</body></html>");
}) as unknown as typeof fetch;
function IG_PERFIL_RESP() { return htmlResp(IG_PERFIL); }

const deps = { db, fetchImpl: fetchFake, baixarOpts: { resolver } };

async function novoLead(over: Record<string, unknown>): Promise<string> {
  const { data, error } = await db.from("leads").insert({ fonte: FONTE, nome: "Lead social", ...over }).select("id").single();
  if (error) throw new Error("insert lead: " + error.message);
  return String(data!.id);
}
const lerSocial = async (leadId: string) =>
  ((await db.from("social_analyses").select("*").eq("lead_id", leadId)).data ?? []) as Array<Record<string, unknown>>;

async function limpar() {
  const { data } = await db.from("leads").select("id").eq("fonte", FONTE);
  for (const l of data ?? []) await db.from("jobs").delete().eq("lead_id", l.id);
  await db.from("leads").delete().eq("fonte", FONTE); // cascata: social_analyses
}

try {
  await limpar();

  // A) site com links IG + FB. IG -> encontrado; FB -> 404 -> nao_encontrado
  {
    const A = await novoLead({ site_url: "https://site-a.exemplo" });
    const r = await analisarSocial(deps, A, { forcar: true });
    const rows = await lerSocial(A);
    const ig = rows.find((x) => x.plataforma === "instagram");
    const fb = rows.find((x) => x.plataforma === "facebook");
    if (
      r.status === "ok" &&
      ig?.status === "encontrado" && ig.seguidores === 1234 && ig.posts_recentes === 267 &&
      ig.perfil_url === "https://www.instagram.com/advocacia_a/" &&
      (ig.objetivo as { origem?: string }).origem === "site" &&
      fb?.status === "nao_encontrado" && fb.perfil_existe === false
    ) pass("site: IG encontrado (1234 seg, 267 posts, origem site); FB 404 -> nao_encontrado");
    else bad("A inesperado: " + JSON.stringify({ r, ig, fb }));
  }

  // B) sem site; instagram_url do Google -> login -> desconhecido; FB sem link -> sem_link
  {
    const B = await novoLead({ instagram_url: "https://instagram.com/perfil_b" });
    const r = await analisarSocial(deps, B, { forcar: true });
    const rows = await lerSocial(B);
    const ig = rows.find((x) => x.plataforma === "instagram");
    const fb = rows.find((x) => x.plataforma === "facebook");
    if (
      r.status === "ok" &&
      ig?.status === "desconhecido" && ig.perfil_existe === null &&
      fb?.status === "sem_link"
    ) pass("Google Places: IG cai no login -> desconhecido; FB sem link -> sem_link");
    else bad("B inesperado: " + JSON.stringify({ r, ig, fb }));
  }

  // C) fetch do IG lanca -> desconhecido, e analisarSocial NAO lanca; FB segue
  {
    const C = await novoLead({ instagram_url: "https://instagram.com/quebra", facebook_url: "https://facebook.com/PaginaC" });
    let lancou = false;
    let r;
    try {
      r = await analisarSocial(deps, C, { forcar: true });
    } catch {
      lancou = true;
    }
    const rows = await lerSocial(C);
    if (!lancou && r?.status === "ok" && rows.length === 2 &&
        rows.find((x) => x.plataforma === "instagram")?.status === "desconhecido")
      pass("falha de rede no IG -> desconhecido, analisarSocial nao lanca, FB ainda gravado");
    else bad("C inesperado: " + JSON.stringify({ lancou, r, rows }));
  }

  // D) cache: 2a chamada dentro do TTL -> pulado
  {
    const D = await novoLead({ site_url: "https://site-a.exemplo" });
    await analisarSocial(deps, D, { forcar: true });
    const r2 = await analisarSocial(deps, D);
    if (r2.status === "pulado-cache") pass("2a analise dentro do TTL -> pulada");
    else bad("cache inesperado: " + JSON.stringify(r2));
  }

  // E) handler do worker (lead sem link nenhum -> nao toca a rede)
  {
    const E = await novoLead({});
    const { error } = await db.from("jobs").insert({ tipo: "analisar_social", lead_id: E, status: "pendente", payload: {} });
    if (error) throw new Error("insert job: " + error.message);
    const resumo = await rodarWorker({ db, registro: REGISTRO_PADRAO, sinal: { parar: false }, once: true, recuperarTravadosMin: null });
    const rows = await lerSocial(E);
    if (resumo.feitos === 1 && rows.length === 2 && rows.every((x) => x.status === "sem_link"))
      pass("worker processou 'analisar_social' -> 2 linhas 'sem_link'");
    else bad("worker inesperado: " + JSON.stringify({ resumo, rows }));
  }
} catch (e) {
  bad("EXCECAO: " + (e instanceof Error ? e.message : String(e)));
} finally {
  await limpar();
  console.log("  [ok] dados de teste removidos");
}

console.log(`\nResultado: ${ok} ok, ${fail} falha(s).\n`);
process.exit(fail > 0 ? 1 : 0);
