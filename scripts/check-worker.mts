// Integracao do worker contra o Supabase REAL, sem internet e sem Google.
// Usa um tipo de job descartavel ("__check_worker__") — nao toca em "descobrir".
//
// Cobre: job normal; job que falha; retry; fila vazia; duas reivindicacoes
// simultaneas (so uma leva o job); handler "sem internet"; worker interrompido.
//
// Uso:  npm run check:worker
//   (precisa da migration 0006 aplicada no Supabase)

import { createClient } from "@supabase/supabase-js";
import { rodarWorker } from "../worker/loop";
import { reivindicarProximoJob } from "../worker/fila";
import type { Handler, RegistroDeHandlers } from "../worker/tipos";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("\n[x] .env.local incompleto\n");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const TIPO = "__check_worker__";
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

// handlers de teste: o comportamento vem do payload.modo
const registro: RegistroDeHandlers = {
  [TIPO]: (async ({ job }) => {
    const modo = (job.payload as { modo?: string }).modo;
    if (modo === "falha") throw new Error("falha proposital");
    if (modo === "rede") throw new Error("fetch failed"); // simula sem internet
    // modo "ok": nao faz nada
  }) as Handler,
};

async function novoJob(modo: string, over: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await db
    .from("jobs")
    .insert({ tipo: TIPO, status: "pendente", payload: { modo }, ...over })
    .select("id")
    .single();
  if (error) throw new Error("insert job: " + error.message);
  return String(data!.id);
}
const lerJob = async (id: string) =>
  (await db.from("jobs").select("status, tentativas, ultimo_erro, agendado_para").eq("id", id).single())
    .data as { status: string; tentativas: number; ultimo_erro: string | null; agendado_para: string };

async function limpar() {
  await db.from("jobs").delete().eq("tipo", TIPO);
}

try {
  await limpar();

  // 0) a funcao SQL existe?
  try {
    await reivindicarProximoJob(db);
    pass("funcao SQL reivindicar_proximo_job() disponivel");
  } catch (e) {
    bad(e instanceof Error ? e.message : String(e));
    throw new Error("aplique supabase/migrations/0006_worker_fila.sql e rode de novo");
  }

  // 1) job normal -> feito
  {
    const id = await novoJob("ok");
    const r = await rodarWorker({ db, registro, sinal: { parar: false }, once: true, recuperarTravadosMin: null });
    const j = await lerJob(id);
    if (j.status === "feito" && r.feitos === 1) pass("job normal -> feito");
    else bad("job normal inesperado: " + JSON.stringify({ j, r }));
  }

  // 2) job que falha -> reagendado (retry), tentativas=1, agendado_para no futuro
  {
    const id = await novoJob("falha", { max_tentativas: 2 });
    await rodarWorker({ db, registro, sinal: { parar: false }, once: true, recuperarTravadosMin: null });
    const j = await lerJob(id);
    const futuro = Date.parse(j.agendado_para) > Date.now();
    if (j.status === "pendente" && j.tentativas === 1 && j.ultimo_erro?.includes("falha proposital") && futuro)
      pass("job que falha -> reagendado para retry (tentativas 1, backoff no futuro)");
    else bad("retry inesperado: " + JSON.stringify(j));

    // 3) libera o backoff e roda de novo -> tentativas=2 -> esgota -> 'erro'
    //    (timestamp claramente no passado: evita skew de relogio com o servidor)
    await db
      .from("jobs")
      .update({ agendado_para: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", id);
    await rodarWorker({ db, registro, sinal: { parar: false }, once: true, recuperarTravadosMin: null });
    const j2 = await lerJob(id);
    if (j2.status === "erro" && j2.tentativas === 2)
      pass("retry esgotado -> 'erro' definitivo (nao tenta infinitamente)");
    else bad("esgotamento inesperado: " + JSON.stringify(j2));
  }

  // 4) fila vazia -> nao processa nada
  {
    const r = await rodarWorker({ db, registro, sinal: { parar: false }, once: true, recuperarTravadosMin: null });
    if (r.processados === 0) pass("fila vazia -> nada processado, sem erro");
    else bad("fila vazia inesperada: " + JSON.stringify(r));
  }

  // 5) duas reivindicacoes "simultaneas" -> so uma leva o job
  {
    await novoJob("ok");
    const [a, b] = await Promise.all([reivindicarProximoJob(db), reivindicarProximoJob(db)]);
    const pegaram = [a, b].filter(Boolean).length;
    if (pegaram === 1) pass("claim concorrente: exatamente 1 worker pegou o job (SKIP LOCKED)");
    else bad("claim concorrente pegou " + pegaram + " (esperado 1)");
    await limpar();
  }

  // 6) handler "sem internet" -> falha tratada, worker nao quebra
  {
    const id = await novoJob("rede");
    const r = await rodarWorker({ db, registro, sinal: { parar: false }, once: true, recuperarTravadosMin: null });
    const j = await lerJob(id);
    if (r.processados === 1 && (j.status === "pendente" || j.status === "erro"))
      pass("handler sem internet -> falha tratada, worker seguiu vivo");
    else bad("sem internet inesperado: " + JSON.stringify({ j, r }));
    await limpar();
  }

  // 7) worker interrompido no meio -> termina o job atual, deixa o resto
  {
    const id1 = await novoJob("ok", { criado_em: new Date(Date.now() - 2000).toISOString() });
    const id2 = await novoJob("ok", { criado_em: new Date(Date.now() - 1000).toISOString() });
    const sinal = { parar: false };
    const reg: RegistroDeHandlers = {
      [TIPO]: (async () => {
        sinal.parar = true; // simula Ctrl+C durante o 1o job
      }) as Handler,
    };
    const r = await rodarWorker({ db, registro: reg, sinal, recuperarTravadosMin: null });
    const [j1, j2] = [await lerJob(id1), await lerJob(id2)];
    if (r.processados === 1 && j1.status === "feito" && j2.status === "pendente")
      pass("worker interrompido -> 1 job concluido, o outro fica pendente");
    else bad("interrupcao inesperada: " + JSON.stringify({ j1, j2, r }));
  }
} catch (e) {
  bad("EXCECAO: " + (e instanceof Error ? e.message : String(e)));
} finally {
  await limpar();
  console.log("  [ok] jobs de teste removidos");
}

console.log(`\nResultado: ${ok} ok, ${fail} falha(s).\n`);
process.exit(fail > 0 ? 1 : 0);
