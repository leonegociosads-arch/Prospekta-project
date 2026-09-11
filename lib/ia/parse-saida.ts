// Le a resposta do modelo de forma DEFENSIVA: extrai o JSON, valida o formato,
// limita tamanhos. Nunca lanca - devolve { ok:false, motivo } quando nao da.
//
// So "resumo" e obrigatorio (como na etapa 14) - todo o resto do dossie
// (etapa 22) tem um valor de reserva sensato se o modelo esquecer o campo,
// pra um dossie parcial nao virar "erro-modelo" por inteiro.

import type {
  ConfiancaIa,
  DiagnosticoIa,
  EstrategiaAbordagem,
  Gatilho,
  Objecao,
  PropostaComercial,
} from "./tipos";

export type ParseResultado =
  | { ok: true; diagnostico: DiagnosticoIa }
  | { ok: false; motivo: string };

const MAX_ITENS = 12;
const MAX_ITEM = 400;
const MAX_GATILHOS = 6;
const MAX_OBJECOES = 6;

export function parseDiagnostico(texto: string): ParseResultado {
  const bruto = extrairJson(texto);
  if (!bruto) return { ok: false, motivo: "a resposta nao continha um objeto JSON" };

  let obj: unknown;
  try {
    obj = JSON.parse(bruto);
  } catch {
    return { ok: false, motivo: "o JSON da resposta nao e valido" };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { ok: false, motivo: "a resposta nao e um objeto JSON" };
  }

  const o = obj as Record<string, unknown>;
  const resumo = texto1(o.resumo);
  if (!resumo) return { ok: false, motivo: "campo 'resumo' ausente ou vazio" };

  const diagnostico: DiagnosticoIa = {
    resumo: resumo.slice(0, 800),
    pontosFortes: listaTexto(o.pontos_fortes),
    pontosFracos: listaTexto(o.pontos_fracos),
    proposta: proposta(o.proposta),
    estrategia: estrategia(o.estrategia),
    mensagemInicial: (texto1(o.mensagem_inicial) ?? "").slice(0, 800),
    objecoes: objecoes(o.objecoes),
    confianca: confianca(o.confianca),
    fatosUtilizados: listaTexto(o.fatos_utilizados),
  };
  return { ok: true, diagnostico };
}

/** Aceita ```json ... ```, texto solto ao redor, ou JSON puro. */
function extrairJson(texto: string): string | null {
  if (!texto) return null;
  const semFence = texto.replace(/```(?:json)?/gi, "```");
  const emFence = semFence.match(/```\s*([\s\S]*?)\s*```/);
  const alvo = emFence?.[1] ?? semFence;
  const ini = alvo.indexOf("{");
  const fim = alvo.lastIndexOf("}");
  if (ini < 0 || fim <= ini) return null;
  return alvo.slice(ini, fim + 1);
}

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function texto1(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function listaTexto(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const t = texto1(item);
    if (t) out.push(t.slice(0, MAX_ITEM));
    if (out.length >= MAX_ITENS) break;
  }
  return out;
}

function proposta(v: unknown): PropostaComercial {
  const p = objeto(v);
  return {
    servico: (texto1(p.servico) ?? "").slice(0, 200),
    escopo: (texto1(p.escopo) ?? "").slice(0, 500),
    justificativa: (texto1(p.justificativa) ?? "").slice(0, 500),
  };
}

function estrategia(v: unknown): EstrategiaAbordagem {
  const e = objeto(v);
  const brutos = Array.isArray(e.gatilhos) ? e.gatilhos : [];
  const gatilhos: Gatilho[] = [];
  for (const g of brutos) {
    const go = objeto(g);
    const titulo = texto1(go.titulo);
    if (!titulo) continue;
    gatilhos.push({
      titulo: titulo.slice(0, 120),
      descricao: (texto1(go.descricao) ?? "").slice(0, 400),
      fonte: (texto1(go.fonte) ?? "").slice(0, 200),
    });
    if (gatilhos.length >= MAX_GATILHOS) break;
  }
  return {
    canal: (texto1(e.canal) ?? "").slice(0, 120),
    melhorHorario: (texto1(e.melhor_horario) ?? "").slice(0, 200),
    gatilhos,
  };
}

function objecoes(v: unknown): Objecao[] {
  if (!Array.isArray(v)) return [];
  const out: Objecao[] = [];
  for (const item of v) {
    const io = objeto(item);
    const pergunta = texto1(io.pergunta);
    if (!pergunta) continue;
    out.push({
      pergunta: pergunta.slice(0, 200),
      resposta: (texto1(io.resposta) ?? "").slice(0, 500),
    });
    if (out.length >= MAX_OBJECOES) break;
  }
  return out;
}

function confianca(v: unknown): ConfiancaIa {
  return v === "alta" || v === "media" || v === "baixa" ? v : "baixa";
}
