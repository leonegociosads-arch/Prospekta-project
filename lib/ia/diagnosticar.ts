// Diagnostico comercial com IA de UM lead. Ordem obrigatoria de guardas:
//   score existe? -> anti-clique-duplo -> cache -> elegibilidade -> teto US$ -> chamada
//
// - A chamada ao modelo passa por chamarComGuardas (grava api_usage + conta no mes).
// - Resposta que nao vira JSON aproveitavel: 1 nova tentativa; se falhar de novo,
//   grava a linha com `erro` e retorna "erro-modelo" (NAO lanca - o lote segue).
// - So erro de BANCO e ErroIa transitorio/ErroDeOrcamento sobem (o job decide).

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  carregarGuardaConfig,
  chamarComGuardas,
  inicioDoMesUtc,
  ErroDeOrcamento,
  type PlanoDeChamada,
} from "@/lib/guardas";
import { criarStoreSupabase } from "@/lib/guardas/store-supabase";
import { carregarConfigIa, type ConfigIa } from "./config-ia";
import { chamarModeloIa, type ChamadaModelo, type RespostaModelo } from "./provedor";
import { estimarCustoUsd } from "./custos";
import { ErroIa } from "./erros";
import { montarSystem, montarUser, REFORCO_JSON, PROMPT_VERSAO } from "./prompt";
import { parseDiagnostico } from "./parse-saida";
import { avaliarElegibilidade } from "./elegibilidade";
import { coletarEntradaDiagnostico, marcoMaisRecente } from "./coletar-entrada";
import type { ConfiancaIa, DiagnosticoIa, ResultadoDiagnostico } from "./tipos";

const MS_DIA = 86_400_000;

export type DepsDiagnosticar = {
  db: SupabaseClient;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  config?: ConfigIa;
  /** injecao para teste: substitui a chamada real ao modelo. */
  chamarModelo?: (opts: ChamadaModelo) => Promise<RespostaModelo>;
  agora?: () => Date;
};

export type OpcoesDiagnosticar = {
  /** botao manual: roda mesmo abaixo do limite (ainda respeita cache e teto US$). */
  ignorarElegibilidade?: boolean;
  /** ignora elegibilidade E cache (refaz do zero). */
  forcar?: boolean;
  /** anti-clique-duplo (ms). default 120s. */
  janelaDedupeMs?: number;
};

type LinhaDiag = Record<string, unknown> & {
  modelo?: string | null;
  versao_prompt?: string | null;
  atualizado_em?: string | null;
  erro?: string | null;
};

export async function diagnosticarLead(
  deps: DepsDiagnosticar,
  leadId: string,
  opts: OpcoesDiagnosticar = {},
): Promise<ResultadoDiagnostico> {
  const { db } = deps;
  const config = deps.config ?? carregarConfigIa();
  const guardaConfig = carregarGuardaConfig();
  const agora = deps.agora ? deps.agora() : new Date();
  const nowIso = agora.toISOString();
  const janela = opts.janelaDedupeMs ?? 120_000;

  const vazio = (extra: Partial<ResultadoDiagnostico>): ResultadoDiagnostico => ({
    status: "lead-nao-encontrado",
    leadId,
    modelo: null,
    versaoPrompt: null,
    fonte: null,
    diagnostico: null,
    tokensEntrada: null,
    tokensSaida: null,
    custoUsd: 0,
    erro: null,
    ...extra,
  });

  const coletado = await coletarEntradaDiagnostico(db, leadId);
  if (!coletado) return vazio({ status: "lead-nao-encontrado" });
  if (coletado.scoreTotal == null) return vazio({ status: "sem-score" });

  // linha atual (o indice unico garante no maximo 1)
  const { data: existRaw, error: errEx } = await db
    .from("ai_diagnoses")
    .select("*")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (errEx) throw new Error(`ai_diagnoses: ${errEx.message}`);
  const existente = (existRaw ?? null) as LinhaDiag | null;

  // anti-clique-duplo: gerado ha pouquissimo tempo e sem erro -> devolve o que ha
  if (!opts.forcar && existente && !existente.erro && existente.atualizado_em) {
    const ms = agora.getTime() - new Date(existente.atualizado_em).getTime();
    if (ms >= 0 && ms < janela) return daLinha(leadId, existente);
  }

  // cache: mesmo modelo + mesma versao de prompt + dentro do TTL + nenhum dado-fonte
  // mais novo que o diagnostico
  if (
    !opts.forcar &&
    existente &&
    !existente.erro &&
    existente.modelo === config.modelo &&
    existente.versao_prompt === PROMPT_VERSAO &&
    existente.atualizado_em
  ) {
    const idadeDias = (agora.getTime() - new Date(existente.atualizado_em).getTime()) / MS_DIA;
    const marco = marcoMaisRecente(coletado.marcos);
    const dadosMudaram = marco != null && marco > existente.atualizado_em;
    if (idadeDias < config.ttlDias && !dadosMudaram) return daLinha(leadId, existente);
  }

  // elegibilidade (o botao manual passa ignorarElegibilidade)
  if (!opts.forcar && !opts.ignorarElegibilidade) {
    const v = await avaliarElegibilidade(db, leadId, coletado.scoreTotal, config);
    if (!v.elegivel) {
      return vazio({ status: "nao-elegivel", erro: v.motivo });
    }
  }

  // teto DURO de gasto com IA no mes
  const gastoMes = await gastoIaNoMesUsd(db, agora);
  if (gastoMes >= config.tetoMensalUsd) {
    throw new ErroDeOrcamento(
      `teto mensal de IA atingido (US$ ${gastoMes.toFixed(4)} de US$ ${config.tetoMensalUsd})`,
    );
  }

  const chamar = deps.chamarModelo ?? chamarModeloIa;
  if (!deps.chamarModelo && !(deps.apiKey ?? "").trim()) {
    throw new ErroIa("chave-invalida", "GEMINI_API_KEY nao configurada no ambiente.");
  }

  const system = montarSystem();
  const user = montarUser(coletado.entrada);
  const store = criarStoreSupabase(db);

  async function umaChamada(userMsg: string) {
    const plano: PlanoDeChamada = {
      provedor: "ia",
      endpoint: "ia_diagnosis",
      unidades: 1,
      custoEstimadoUsd: 0,
      obs: config.modelo,
    };
    let out: RespostaModelo = { texto: "", tokensEntrada: 0, tokensSaida: 0 };
    await chamarComGuardas(
      store,
      plano,
      async () => {
        out = await chamar({
          modelo: config.modelo,
          system,
          user: userMsg,
          temperatura: config.temperatura,
          apiKey: (deps.apiKey ?? "").trim(),
          fetchImpl: deps.fetchImpl,
        });
        plano.custoEstimadoUsd = estimarCustoUsd(config.modelo, out.tokensEntrada, out.tokensSaida);
        return out;
      },
      { config: guardaConfig, agora },
    );
    return {
      texto: out.texto,
      tokensIn: out.tokensEntrada,
      tokensOut: out.tokensSaida,
      custo: estimarCustoUsd(config.modelo, out.tokensEntrada, out.tokensSaida),
    };
  }

  const c1 = await umaChamada(user);
  let parse = parseDiagnostico(c1.texto);
  let tokensIn = c1.tokensIn;
  let tokensOut = c1.tokensOut;
  let custo = c1.custo;

  if (!parse.ok) {
    const c2 = await umaChamada(`${user}\n\n${REFORCO_JSON}`);
    tokensIn += c2.tokensIn;
    tokensOut += c2.tokensOut;
    custo += c2.custo;
    parse = parseDiagnostico(c2.texto);
  }

  const custoTotal = Math.round(custo * 1e6) / 1e6;
  const comum: LinhaDiag = {
    lead_id: leadId,
    atualizado_em: nowIso,
    modelo: config.modelo,
    versao_prompt: PROMPT_VERSAO,
    entrada: coletado.entrada,
    tokens_entrada: tokensIn,
    tokens_saida: tokensOut,
    custo_usd: custoTotal,
  };
  if (!existente) comum.criado_em = nowIso;

  let linha: LinhaDiag;
  let erroTxt: string | null = null;
  if (parse.ok) {
    const d = parse.diagnostico;
    linha = {
      ...comum,
      resumo: d.resumo,
      problemas: d.problemas,
      oportunidades: d.oportunidades,
      servico_sugerido: d.servicoSugerido,
      angulo_comercial: d.anguloComercial,
      angulo_de_entrada: d.anguloComercial,
      confianca: d.confianca,
      fatos_utilizados: d.fatosUtilizados,
      erro: null,
    };
  } else {
    erroTxt = `resposta do modelo nao aproveitavel: ${parse.motivo}`;
    linha = {
      ...comum,
      resumo: null,
      problemas: null,
      oportunidades: null,
      servico_sugerido: null,
      angulo_comercial: null,
      angulo_de_entrada: null,
      confianca: null,
      fatos_utilizados: null,
      erro: erroTxt,
    };
  }

  const { error: errUp } = await db
    .from("ai_diagnoses")
    .upsert(linha, { onConflict: "lead_id" });
  if (errUp) throw new Error(`ai_diagnoses upsert: ${errUp.message}`);

  return {
    status: parse.ok ? "gerado" : "erro-modelo",
    leadId,
    modelo: config.modelo,
    versaoPrompt: PROMPT_VERSAO,
    fonte: "modelo",
    diagnostico: parse.ok ? parse.diagnostico : null,
    tokensEntrada: tokensIn,
    tokensSaida: tokensOut,
    custoUsd: custoTotal,
    erro: erroTxt,
  };
}

// ------------------------------------------------------------ helpers

async function gastoIaNoMesUsd(db: SupabaseClient, agora: Date): Promise<number> {
  const { data, error } = await db
    .from("api_usage")
    .select("custo_estimado_usd")
    .eq("provedor", "ia")
    .gte("em", inicioDoMesUtc(agora));
  if (error) throw new Error(`api_usage (gasto IA no mes): ${error.message}`);
  return (data ?? []).reduce(
    (s: number, r: { custo_estimado_usd: number | null }) => s + Number(r.custo_estimado_usd ?? 0),
    0,
  );
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function daLinha(leadId: string, row: LinhaDiag): ResultadoDiagnostico {
  const temErro = !!row.erro;
  const diagnostico: DiagnosticoIa | null = temErro
    ? null
    : {
        resumo: (row.resumo as string) ?? "",
        problemas: arr(row.problemas),
        oportunidades: arr(row.oportunidades),
        servicoSugerido: (row.servico_sugerido as string) ?? "",
        anguloComercial:
          (row.angulo_comercial as string) ?? (row.angulo_de_entrada as string) ?? "",
        confianca: ((row.confianca as ConfiancaIa) ?? "baixa"),
        fatosUtilizados: arr(row.fatos_utilizados),
      };
  return {
    status: "cache",
    leadId,
    modelo: (row.modelo as string) ?? null,
    versaoPrompt: (row.versao_prompt as string) ?? null,
    fonte: "cache",
    diagnostico,
    tokensEntrada: (row.tokens_entrada as number) ?? null,
    tokensSaida: (row.tokens_saida as number) ?? null,
    custoUsd: 0,
    erro: (row.erro as string) ?? null,
  };
}
