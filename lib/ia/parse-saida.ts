// Le a resposta do modelo de forma DEFENSIVA: extrai o JSON, valida o formato,
// limita tamanhos. Nunca lanca - devolve { ok:false, motivo } quando nao da.

import type { ConfiancaIa, DiagnosticoIa } from "./tipos";

export type ParseResultado =
  | { ok: true; diagnostico: DiagnosticoIa }
  | { ok: false; motivo: string };

const MAX_ITENS = 12;
const MAX_ITEM = 400;

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
    problemas: listaTexto(o.problemas),
    oportunidades: listaTexto(o.oportunidades),
    servicoSugerido: (texto1(o.servico_sugerido) ?? "").slice(0, 300),
    anguloComercial: (texto1(o.angulo_comercial) ?? "").slice(0, 600),
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

function confianca(v: unknown): ConfiancaIa {
  return v === "alta" || v === "media" || v === "baixa" ? v : "baixa";
}
