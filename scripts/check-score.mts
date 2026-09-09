// Integracao do Score de Oportunidade contra o Supabase real.
//  - calcula e grava em `scores` (upsert);
//  - handler do worker processa o job 'calcular_score';
//  - ranking dos 4 perfis artificiais faz sentido.
//
// Uso:  npm run check:score   (precisa das migrations 0006 e 0008 aplicadas)

import { createClient } from "@supabase/supabase-js";
import { calcularEPersistirScore } from "../lib/score/persistir";
import { rodarWorker } from "../worker/loop";
import { REGISTRO_PADRAO } from "../worker/registro";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("\n[x] .env.local incompleto\n");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const FONTE = "__check_score__";
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

type PerfilLead = {
  nome: string;
  status_negocio?: string | null;
  avaliacao?: number | null;
  qtd_avaliacoes?: number | null;
  telefone?: string | null;
  site_url?: string | null;
  instagram_url?: string | null;
};
type PerfilAnalise = Record<string, unknown> | null;

async function criar(lead: PerfilLead, analise: PerfilAnalise): Promise<string> {
  const { data, error } = await db
    .from("leads")
    .insert({ fonte: FONTE, ...lead })
    .select("id")
    .single();
  if (error) throw new Error("insert lead: " + error.message);
  const id = String(data!.id);
  if (analise) {
    const { error: e2 } = await db
      .from("site_analyses")
      .upsert({ lead_id: id, verificado_em: new Date().toISOString(), ...analise }, { onConflict: "lead_id" });
    if (e2) throw new Error("insert site_analyses: " + e2.message);
  }
  return id;
}

async function limpar() {
  const { data } = await db.from("leads").select("id").eq("fonte", FONTE);
  for (const l of data ?? []) {
    await db.from("jobs").delete().eq("lead_id", l.id);
    await db.from("scores").delete().eq("lead_id", l.id);
    await db.from("site_analyses").delete().eq("lead_id", l.id);
  }
  await db.from("leads").delete().eq("fonte", FONTE);
}

const SITE_RUIM = {
  site_existe: true, https: true, tls_ok: true, status_http: 200,
  tem_viewport: false, nota_mobile: 20, nota_desempenho: 30, peso_kb: 4200, ttfb_ms: 3800,
  tem_whatsapp: false, tem_formulario: false, tem_cta: false, tem_pagina_contato: false,
  tem_meta_pixel: false, tem_ga: false, tem_gtm: false, tem_google_ads: false, tem_doubleclick: false,
};
const SITE_OTIMO = {
  site_existe: true, https: true, tls_ok: true, status_http: 200,
  tem_viewport: true, nota_mobile: 100, nota_desempenho: 92, peso_kb: 700, ttfb_ms: 320,
  tem_whatsapp: true, tem_formulario: true, tem_cta: true, tem_pagina_contato: true,
  tem_meta_pixel: true, tem_ga: true, tem_gtm: true, tem_google_ads: true, tem_doubleclick: true,
};
const SITE_MEDIANO = {
  site_existe: true, https: true, tls_ok: true, status_http: 200,
  tem_viewport: true, nota_mobile: 80, nota_desempenho: 70, peso_kb: 1500, ttfb_ms: 900,
  tem_whatsapp: true, tem_formulario: true, tem_cta: true, tem_pagina_contato: true,
  tem_meta_pixel: false, tem_ga: true, tem_gtm: false, tem_google_ads: false, tem_doubleclick: false,
};

try {
  await limpar();

  // Perfil A: ativa + muitas avaliacoes + site ruim
  const A = await criar(
    { nome: "A - ativa, site ruim", status_negocio: "OPERATIONAL", avaliacao: 4.3, qtd_avaliacoes: 80, telefone: "(13) 3333-0000", site_url: "https://a.exemplo" },
    SITE_RUIM,
  );
  // Perfil B: quase inexistente + sem site
  const B = await criar(
    { nome: "B - quase inexistente", status_negocio: null, avaliacao: null, qtd_avaliacoes: 0, telefone: null, site_url: null },
    null,
  );
  // Perfil C: excelente digitalmente
  const C = await criar(
    { nome: "C - excelente", status_negocio: "OPERATIONAL", avaliacao: 4.8, qtd_avaliacoes: 210, telefone: "(13) 3333-1111", site_url: "https://c.exemplo", instagram_url: "https://instagram.com/c" },
    SITE_OTIMO,
  );
  // Perfil D: boa + marketing mediano + contato facil
  const D = await criar(
    { nome: "D - boa, mediana", status_negocio: "OPERATIONAL", avaliacao: 4.2, qtd_avaliacoes: 30, telefone: "(13) 3333-2222", site_url: "https://d.exemplo" },
    SITE_MEDIANO,
  );

  const totais: Record<string, number> = {};
  for (const [k, id] of Object.entries({ A, B, C, D })) {
    const r = await calcularEPersistirScore(db, id);
    if (r.status !== "ok") { bad(`perfil ${k}: ${r.status}`); continue; }
    totais[k] = r.total;
  }
  console.log("  ..  totais:", JSON.stringify(totais));

  // gravou em scores?
  {
    const { data } = await db.from("scores").select("total, detalhamento").eq("lead_id", A).maybeSingle();
    const det = data?.detalhamento as { fatores?: Array<{ pontos: number }> } | undefined;
    const soma = (det?.fatores ?? []).reduce((s, f) => s + f.pontos, 0);
    if (data && data.total === soma && soma === totais.A) pass("scores gravado; composicao soma o total");
    else bad("scores inconsistente: " + JSON.stringify({ data, soma, totalA: totais.A }));
  }

  // regras de ranking
  if (totais.A > totais.C) pass("A (ativa+site ruim) > C (excelente) — ha o que vender"); else bad(`A(${totais.A}) deveria > C(${totais.C})`);
  if (totais.D > totais.C) pass("D (boa+mediana) > C (excelente)"); else bad(`D(${totais.D}) deveria > C(${totais.C})`);
  if (totais.A >= totais.D) pass("A >= D"); else bad(`A(${totais.A}) deveria >= D(${totais.D})`);
  if (totais.B === Math.min(...Object.values(totais))) pass("B (quase inexistente) e o menor de todos"); else bad(`B(${totais.B}) deveria ser o menor`);
  if (totais.B < 40) pass("B tem score baixo (< 40)"); else bad(`B(${totais.B}) deveria ser < 40`);
  if (totais.C < 100 && totais.A < 100) pass("nenhum perfil chega a 100"); else bad("algum perfil bateu 100");

  // negocio fechado -> ~0
  {
    const F = await criar(
      { nome: "Fechado", status_negocio: "CLOSED_PERMANENTLY", avaliacao: 4.9, qtd_avaliacoes: 300, telefone: "(13) 3333-9999", site_url: "https://f.exemplo" },
      SITE_RUIM,
    );
    const r = await calcularEPersistirScore(db, F);
    if (r.status === "ok" && r.total === 0) pass("negocio permanentemente fechado -> score 0 (mesmo com site ruim)");
    else bad("fechado inesperado: " + JSON.stringify(r));
  }

  // falta de informacao != informacao negativa
  {
    const semAnalise = await criar(
      { nome: "Site nao analisado", status_negocio: "OPERATIONAL", avaliacao: 4.4, qtd_avaliacoes: 40, telefone: "(13) 3333-4444", site_url: "https://x.exemplo" },
      null,
    );
    const comAnaliseRuim = await criar(
      { nome: "Site analisado e ruim", status_negocio: "OPERATIONAL", avaliacao: 4.4, qtd_avaliacoes: 40, telefone: "(13) 3333-5555", site_url: "https://y.exemplo" },
      SITE_RUIM,
    );
    const r1 = await calcularEPersistirScore(db, semAnalise);
    const r2 = await calcularEPersistirScore(db, comAnaliseRuim);
    if (r1.status === "ok" && r2.status === "ok" && r2.total > r1.total && r1.resultado.confianca !== "alta")
      pass("site nao analisado (info faltando, conf. baixa) pontua MENOS que site comprovadamente ruim");
    else bad("falta-de-info inesperado: " + JSON.stringify({ r1: r1, r2: r2 }));
  }

  // worker processa o job
  {
    const id = await criar(
      { nome: "Via worker", status_negocio: "OPERATIONAL", avaliacao: 4.0, qtd_avaliacoes: 12, telefone: "(13) 3333-7777", site_url: null },
      null,
    );
    const { error } = await db.from("jobs").insert({ tipo: "calcular_score", lead_id: id, status: "pendente", payload: {} });
    if (error) throw new Error("insert job: " + error.message);
    const resumo = await rodarWorker({ db, registro: REGISTRO_PADRAO, sinal: { parar: false }, once: true, recuperarTravadosMin: null });
    const { data: sc } = await db.from("scores").select("total").eq("lead_id", id).maybeSingle();
    if (resumo.feitos === 1 && sc && typeof sc.total === "number") pass("worker processou 'calcular_score' -> gravou score");
    else bad("worker inesperado: " + JSON.stringify({ resumo, sc }));
  }
} catch (e) {
  bad("EXCECAO: " + (e instanceof Error ? e.message : String(e)));
} finally {
  await limpar();
  console.log("  [ok] dados de teste removidos");
}

console.log(`\nResultado: ${ok} ok, ${fail} falha(s).\n`);
process.exit(fail > 0 ? 1 : 0);
