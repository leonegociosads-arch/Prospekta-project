// Ponto de entrada do worker local.
//
//   npm run worker            -> fica rodando, pega jobs conforme chegam
//   npm run worker:once       -> processa a fila atual e sai
//   npm run worker -- --max-jobs 5
//   npm run worker -- --intervalo 10   (segundos de espera com a fila vazia)
//
// Ctrl+C: termina o job atual e sai (gracioso). Ctrl+C de novo: forca a saida.

import { createClient } from "@supabase/supabase-js";
import { rodarWorker, type SinalParada } from "./loop";
import { REGISTRO_PADRAO } from "./registro";
import { criarLog } from "./log";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "[worker] .env.local incompleto: preencha NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const temFlag = (f: string) => argv.includes(f);
function valorFlag(f: string): string | undefined {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
}

const once = temFlag("--once");
const maxJobs = valorFlag("--max-jobs") ? Number(valorFlag("--max-jobs")) : undefined;
const intervaloSeg = valorFlag("--intervalo") ? Number(valorFlag("--intervalo")) : undefined;

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const log = criarLog();
const sinal: SinalParada = { parar: false };

let jaAvisou = false;
for (const s of ["SIGINT", "SIGTERM"] as const) {
  process.on(s, () => {
    if (jaAvisou) {
      console.log("\n[worker] encerramento forcado.");
      process.exit(1);
    }
    jaAvisou = true;
    sinal.parar = true;
    console.log(
      `\n[worker] ${s} recebido — terminando o job atual e saindo. (Ctrl+C de novo forca a saida)`,
    );
  });
}

log("worker iniciado", {
  pid: process.pid,
  modo: once ? "once" : "continuo",
  maxJobs: maxJobs ?? "sem limite",
});

try {
  const resumo = await rodarWorker({
    db,
    registro: REGISTRO_PADRAO,
    sinal,
    once,
    maxJobs,
    intervaloOciosoMs: intervaloSeg ? intervaloSeg * 1000 : undefined,
    recuperarTravadosMin: 15,
    log,
  });
  log("worker encerrado", {
    processados: resumo.processados,
    feitos: resumo.feitos,
    reagendados: resumo.reagendados,
    esgotados: resumo.esgotados,
    ignorados: resumo.ignorados,
  });
  process.exit(0);
} catch (e) {
  console.error("[worker] erro fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
}
