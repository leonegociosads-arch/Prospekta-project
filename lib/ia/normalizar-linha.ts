// Reconstroi um DiagnosticoIa a partir de uma linha crua de ai_diagnoses (as
// colunas jsonb voltam do Supabase como `unknown`). Usado tanto por
// diagnosticarLead (quando devolve o que ja estava em cache) quanto pela
// pagina do lead (quando so precisa mostrar o dossie ja gravado).

import type { ConfiancaIa, DiagnosticoIa, EstrategiaAbordagem, Objecao, PropostaComercial } from "./tipos";

export function arrTexto(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function txt(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function propostaDaLinha(v: unknown): PropostaComercial {
  const p = objeto(v);
  return { servico: txt(p.servico), escopo: txt(p.escopo), justificativa: txt(p.justificativa) };
}

export function estrategiaDaLinha(v: unknown): EstrategiaAbordagem {
  const e = objeto(v);
  const gatilhos = Array.isArray(e.gatilhos)
    ? e.gatilhos.map((g) => {
        const go = objeto(g);
        return { titulo: txt(go.titulo), descricao: txt(go.descricao), fonte: txt(go.fonte) };
      })
    : [];
  return { canal: txt(e.canal), melhorHorario: txt(e.melhorHorario ?? e.melhor_horario), gatilhos };
}

export function objecoesDaLinha(v: unknown): Objecao[] {
  if (!Array.isArray(v)) return [];
  return v.map((o) => {
    const oo = objeto(o);
    return { pergunta: txt(oo.pergunta), resposta: txt(oo.resposta) };
  });
}

export function confiancaDaLinha(v: unknown): ConfiancaIa {
  return v === "alta" || v === "media" || v === "baixa" ? v : "baixa";
}

/** Uma linha de ai_diagnoses (ou so os campos do dossie dela) - qualquer
 *  objeto serve, os campos que faltarem viram valor de reserva abaixo. */
export type LinhaDossie = Record<string, unknown>;

export function montarDiagnosticoDaLinha(row: LinhaDossie): DiagnosticoIa {
  const pontosFracos = arrTexto(row.pontos_fracos);
  const proposta = propostaDaLinha(row.proposta);
  const estrategia = estrategiaDaLinha(row.estrategia);

  // ---- fallback para diagnosticos da etapa 14 (prompt v1) ----
  // Diagnosticos antigos gravaram em outras colunas. Em vez de mostrar o
  // dossie vazio, reaproveitamos o que existe. Nada e inventado: e o mesmo
  // texto que a IA escreveu na epoca, so remapeado para o bloco equivalente.
  const legadoProblemas = arrTexto(row.problemas);
  const legadoOportunidades = arrTexto(row.oportunidades);
  const legadoServico = txt(row.servico_sugerido);
  const legadoAngulo = txt(row.angulo_comercial) || txt(row.angulo_de_entrada);

  const temPropostaV2 = proposta.servico !== "" || proposta.escopo !== "";
  const temEstrategiaV2 = estrategia.canal !== "" || estrategia.gatilhos.length > 0;

  return {
    resumo: txt(row.resumo),
    pontosFortes: arrTexto(row.pontos_fortes),
    // "oportunidades" do v1 era exatamente o "dinheiro na mesa" deste bloco
    pontosFracos:
      pontosFracos.length > 0 ? pontosFracos : [...legadoProblemas, ...legadoOportunidades],
    proposta: temPropostaV2
      ? proposta
      : { servico: legadoServico, escopo: "", justificativa: "" },
    estrategia: temEstrategiaV2
      ? estrategia
      : {
          canal: "",
          melhorHorario: "",
          gatilhos: legadoAngulo
            ? [{ titulo: "Ângulo comercial", descricao: legadoAngulo, fonte: "diagnóstico anterior" }]
            : [],
        },
    mensagemInicial: txt(row.mensagem_inicial),
    objecoes: objecoesDaLinha(row.objecoes),
    confianca: confiancaDaLinha(row.confianca),
    fatosUtilizados: arrTexto(row.fatos_utilizados),
  };
}
