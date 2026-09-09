// Integracao do diagnostico com IA: Supabase real + MODELO FAKE (nao chama
// nenhuma API paga). Cobre: sem-score, nao-elegivel, gerado, cache, forcar,
// resposta inaproveitavel -> erro-modelo (sem lancar), teto de gasto, handler
// do worker.
//
// Uso:  npm run check:ia   (precisa das migrations 0003, 0006, 0008 e 0011)

import { createClient } from "@supabase/supabase-js";
import { diagnosticarLead } from "../lib/ia/diagnosticar";
import { carregarConfigIa } from "../lib/ia/config-ia";
import { rodarWorker } from "../worker/loop";
import { REGISTRO_PADRAO } from "../worker/registro";
// import direto do arquivo (nao pelo barrel): sob `node --import tsx`, um .mts
// que faz import ESTATICO de nome vindo de `export *` no index nao enxerga o
// simbolo. Os arquivos .ts do lib/ usam o barrel sem problema (viram require).
import { ErroDeOrcamento } from "../lib/guardas/erros";
import type { RespostaModelo } from "../lib/ia/provedor";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("\n[x] .env.local incompleto\n");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const FONTE = "__check_ia__";
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

// ---- modelo fake ----
let chamadasModelo = 0;
let modoModelo: "ok" | "lixo" = "ok";
const RESPOSTA_OK = JSON.stringify({
  resumo: "Empresa ativa com boa reputacao, mas o site nao converte: sem WhatsApp e sem formulario.",
  problemas: ["site sem WhatsApp em destaque", "site sem formulario de contato"],
  oportunidades: ["adicionar captacao de leads no site", "campanha de trafego para a pagina"],
  servico_sugerido: "Landing page de captacao + trafego pago",
  angulo_comercial: "O site recebe visita mas nao gera contato - mostrar o gargalo",
  confianca: "media",
  fatos_utilizados: ["score total 85", "site tem_whatsapp=false", "qtd_avaliacoes=120"],
});
const fakeModelo = async (): Promise<RespostaModelo> => {
  chamadasModelo++;
  if (modoModelo === "lixo") {
    return { texto: "desculpe, nao consigo responder em JSON agora", tokensEntrada: 800, tokensSaida: 40 };
  }
  return { texto: RESPOSTA_OK, tokensEntrada: 1500, tokensSaida: 380 };
};

async function novoLead(over: Record<string, unknown>): Promise<string> {
  const { data, error } = await db
    .from("leads")
    .insert({ fonte: FONTE, nome: "Lead IA", ...over })
    .select("id")
    .single();
  if (error) throw new Error("insert lead: " + error.message);
  return String(data!.id);
}
async function porScore(leadId: string, total: number) {
  const { error } = await db
    .from("scores")
    .upsert(
      { lead_id: leadId, total, versao_formula: "v1", detalhamento: { confianca: "alta", fatores: [], moderadores: [] } },
      { onConflict: "lead_id" },
    );
  if (error) throw new Error("upsert score: " + error.message);
}
const lerDiag = async (leadId: string) =>
  (await db.from("ai_diagnoses").select("*").eq("lead_id", leadId).maybeSingle()).data as
    | Record<string, unknown>
    | null;

async function limpar() {
  const { data } = await db.from("leads").select("id").eq("fonte", FONTE);
  for (const l of data ?? []) await db.from("jobs").delete().eq("lead_id", l.id);
  await db.from("leads").delete().eq("fonte", FONTE); // cascata: scores, ai_diagnoses
  await db.from("api_usage").delete().eq("endpoint", "ia_diagnosis").gte("em", INICIO);
}

const cfg = carregarConfigIa();

try {
  await limpar();

  // A) lead sem score -> sem-score, nada gravado
  {
    const A = await novoLead({});
    const r = await diagnosticarLead({ db, chamarModelo: fakeModelo }, A, { ignorarElegibilidade: true });
    if (r.status === "sem-score" && chamadasModelo === 0 && (await lerDiag(A)) === null)
      pass("lead sem score -> sem-score (nao chama o modelo)");
    else bad("A inesperado: " + JSON.stringify(r));
  }

  // B) score 40, sem pesquisa -> nao-elegivel (sem forcar), nada gravado
  {
    const B = await novoLead({});
    await porScore(B, 40);
    const r = await diagnosticarLead({ db, chamarModelo: fakeModelo }, B, {});
    if (r.status === "nao-elegivel" && chamadasModelo === 0 && (await lerDiag(B)) === null)
      pass("score 40 fora do top -> nao-elegivel (nao chama o modelo)");
    else bad("B inesperado: " + JSON.stringify(r));
  }

  // C) score 85 -> gera; grava diagnostico + api_usage
  const C = await novoLead({ site_url: "https://exemplo-c.com.br", qtd_avaliacoes: 120, avaliacao: 4.6 });
  {
    await porScore(C, 85);
    await db.from("site_analyses").upsert(
      { lead_id: C, site_existe: true, https: true, tem_whatsapp: false, tem_formulario: false },
      { onConflict: "lead_id" },
    );
    const antes = chamadasModelo;
    const r = await diagnosticarLead({ db, chamarModelo: fakeModelo }, C, { ignorarElegibilidade: true });
    const row = await lerDiag(C);
    const { data: usos } = await db
      .from("api_usage")
      .select("provedor, endpoint, custo_estimado_usd")
      .eq("endpoint", "ia_diagnosis")
      .gte("em", INICIO);
    if (
      r.status === "gerado" &&
      chamadasModelo === antes + 1 &&
      row &&
      typeof row.resumo === "string" &&
      row.modelo === cfg.modelo &&
      Number(row.custo_usd) > 0 &&
      Number(row.tokens_entrada) === 1500 &&
      (usos ?? []).some((u) => u.provedor === "ia")
    )
      pass("score 85 -> gerado, linha em ai_diagnoses + api_usage (provedor ia)");
    else bad("C inesperado: " + JSON.stringify({ r, row, usos }));
  }

  // D) 2a chamada sem forcar -> cache, sem nova chamada ao modelo
  {
    const antes = chamadasModelo;
    const r = await diagnosticarLead({ db, chamarModelo: fakeModelo }, C, { ignorarElegibilidade: true });
    if (r.status === "cache" && chamadasModelo === antes) pass("2a chamada -> cache (modelo nao e chamado)");
    else bad("D inesperado: " + JSON.stringify({ r, chamadasModelo, antes }));
  }

  // E) forcar -> chama de novo
  {
    const antes = chamadasModelo;
    const r = await diagnosticarLead({ db, chamarModelo: fakeModelo }, C, { forcar: true });
    if (r.status === "gerado" && r.fonte === "modelo" && chamadasModelo === antes + 1)
      pass("forcar -> ignora cache e chama de novo");
    else bad("E inesperado: " + JSON.stringify({ r, chamadasModelo, antes }));
  }

  // F) modelo devolve lixo -> retry -> erro-modelo, linha com erro, NAO lanca
  {
    const F = await novoLead({});
    await porScore(F, 90);
    modoModelo = "lixo";
    const antes = chamadasModelo;
    let lancou = false;
    let r;
    try {
      r = await diagnosticarLead({ db, chamarModelo: fakeModelo }, F, { ignorarElegibilidade: true });
    } catch {
      lancou = true;
    }
    modoModelo = "ok";
    const row = await lerDiag(F);
    if (
      !lancou &&
      r?.status === "erro-modelo" &&
      chamadasModelo === antes + 2 && // 1a + retry
      row &&
      typeof row.erro === "string" &&
      row.resumo === null
    )
      pass("resposta inaproveitavel -> retry -> erro-modelo gravado, sem lancar");
    else bad("F inesperado: " + JSON.stringify({ lancou, r, row }));
  }

  // G) teto de gasto atingido -> ErroDeOrcamento
  {
    const G = await novoLead({});
    await porScore(G, 95);
    let erro: unknown = null;
    try {
      await diagnosticarLead(
        { db, chamarModelo: fakeModelo, config: { ...cfg, tetoMensalUsd: 0 } },
        G,
        { ignorarElegibilidade: true },
      );
    } catch (e) {
      erro = e;
    }
    if (erro instanceof ErroDeOrcamento) pass("teto de gasto de IA -> ErroDeOrcamento (bloqueia a chamada)");
    else bad("G inesperado: " + JSON.stringify(erro));
  }

  // H) handler do worker (registro com modelo fake)
  {
    const H = await novoLead({});
    await porScore(H, 88);
    const { error } = await db
      .from("jobs")
      .insert({ tipo: "diagnosticar_ia", lead_id: H, status: "pendente", payload: { ignorarElegibilidade: true } });
    if (error) throw new Error("insert job: " + error.message);
    const registroFake = {
      ...REGISTRO_PADRAO,
      diagnosticar_ia: async (ctx: { db: typeof db; job: { lead_id: string | null } }) => {
        await diagnosticarLead({ db: ctx.db, chamarModelo: fakeModelo }, ctx.job.lead_id!, {
          ignorarElegibilidade: true,
        });
      },
    };
    const resumo = await rodarWorker({
      db,
      registro: registroFake as unknown as typeof REGISTRO_PADRAO,
      sinal: { parar: false },
      once: true,
      recuperarTravadosMin: null,
    });
    const row = await lerDiag(H);
    if (resumo.feitos === 1 && row && typeof row.resumo === "string")
      pass("worker processou 'diagnosticar_ia' -> linha gravada");
    else bad("H inesperado: " + JSON.stringify({ resumo, row }));
  }
} catch (e) {
  bad("EXCECAO: " + (e instanceof Error ? e.message : String(e)));
} finally {
  await limpar();
  console.log("  [ok] dados de teste removidos");
}

console.log(`\nResultado: ${ok} ok, ${fail} falha(s).\n`);
process.exit(fail > 0 ? 1 : 0);
