// Corpo do dossie comercial (etapa 25). Componente de servidor, so exibe.
//
// Blocos, na ordem: Leitura do negocio -> Pontos fortes -> Pontos fracos ->
// Proposta -> Estrategia -> Primeira mensagem -> Objecoes -> Fatos usados.
//
// Os blocos de pontos fortes/fracos mostram DOIS tipos de item:
//   - derivados: medidos pelo proprio Prospekta, cada um com a evidencia real;
//   - da IA: interpretacao do modelo, marcados com a tag "IA".
// Nenhum item e inventado aqui: ou veio de medicao, ou veio do diagnostico.

import type { ReactNode } from "react";
import type { DiagnosticoIa } from "@/lib/ia/tipos";
import type { SinaisObjetivos } from "@/lib/leads/sinais-objetivos";
import { TagFonte } from "@/components/ui";

const CONF_LABEL: Record<string, string> = { alta: "alta", media: "média", baixa: "baixa" };

/** Quantos itens derivados mostrar antes de virar ruido. */
const MAX_DERIVADOS = 6;

export function Dossie({
  diagnostico,
  sinais,
  fontesLeitura,
}: {
  diagnostico: DiagnosticoIa | null;
  sinais: SinaisObjetivos;
  /** de onde vieram os dados que alimentaram a leitura (Places, site, redes, score) */
  fontesLeitura: string[];
}) {
  const temProposta = !!diagnostico && (diagnostico.proposta.servico || diagnostico.proposta.escopo);
  const temEstrategia =
    !!diagnostico && (diagnostico.estrategia.canal || diagnostico.estrategia.gatilhos.length > 0);

  return (
    <div className="flex flex-col gap-5 px-3 py-4 pb-5 sm:px-5 sm:py-[18px] sm:pb-[22px]">
      {/* ------------------------------------------------ leitura do negocio */}
      <Bloco icone="◆" tom="info" titulo="Leitura do negócio">
        {diagnostico ? (
          <>
            <p className="text-ink">{diagnostico.resumo}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {fontesLeitura.map((f) => (
                <TagFonte key={f}>{f}</TagFonte>
              ))}
              <span className="ml-auto text-[11px] text-faint">
                confiança {CONF_LABEL[diagnostico.confianca] ?? diagnostico.confianca}
              </span>
            </div>
          </>
        ) : (
          <Vazio>
            Leitura ainda não gerada. Os dados abaixo já foram coletados — a IA entra para
            interpretá-los.
          </Vazio>
        )}
      </Bloco>

      {/* ------------------------------------------------------ pontos fortes */}
      <Bloco icone="↑" tom="ok" titulo="Pontos fortes">
        <ListaSinais
          derivados={sinais.fortes}
          daIa={diagnostico?.pontosFortes ?? []}
          tipo="forte"
          vazio="Nenhum ponto forte objetivo identificado nos dados coletados até aqui."
        />
      </Bloco>

      {/* ------------------------------------------- pontos fracos / dinheiro */}
      <Bloco icone="↓" tom="ruim" titulo="Pontos fracos e dinheiro na mesa">
        <ListaSinais
          derivados={sinais.fracos}
          daIa={diagnostico?.pontosFracos ?? []}
          tipo="fraco"
          vazio="Nenhum problema identificado nos dados coletados até aqui."
        />
      </Bloco>

      {/* ----------------------------------------------------------- proposta */}
      <Bloco icone="★" tom="accent" titulo="Proposta comercial sugerida" destaque>
        {temProposta && diagnostico ? (
          <div className="flex flex-col gap-1.5">
            {diagnostico.proposta.servico && (
              <Campo rotulo="Serviço">{diagnostico.proposta.servico}</Campo>
            )}
            {diagnostico.proposta.escopo && (
              <Campo rotulo="Escopo">{diagnostico.proposta.escopo}</Campo>
            )}
            {diagnostico.proposta.justificativa && (
              <Campo rotulo="Por que esse é o alvo certo">
                {diagnostico.proposta.justificativa}
              </Campo>
            )}
            <Campo rotulo="Faixa de entrada">
              <span className="text-faint">
                não sugerida de propósito — a IA não conhece sua tabela de preços. O valor é seu.
              </span>
            </Campo>
          </div>
        ) : (
          <Vazio>Proposta ainda não gerada.</Vazio>
        )}
      </Bloco>

      {/* --------------------------------------------------------- estrategia */}
      <Bloco icone="⚡" tom="warn" titulo="Estratégia de abordagem">
        {temEstrategia && diagnostico ? (
          <>
            {(diagnostico.estrategia.canal || diagnostico.estrategia.melhorHorario) && (
              <p className="mb-2.5 text-[12px] text-muted">
                {diagnostico.estrategia.canal && (
                  <>
                    Canal: <strong className="font-semibold text-ink">{diagnostico.estrategia.canal}</strong>
                  </>
                )}
                {diagnostico.estrategia.melhorHorario && (
                  <> · Melhor horário: {diagnostico.estrategia.melhorHorario}</>
                )}
              </p>
            )}
            <ol className="flex flex-col gap-[11px]">
              {diagnostico.estrategia.gatilhos.map((g, i) => (
                <li key={i} className="border-l-2 border-info pl-[11px]">
                  <p className="text-[13px] font-semibold text-ink">{g.titulo}</p>
                  {g.descricao && <p className="mt-0.5 text-[12.5px] text-muted">{g.descricao}</p>}
                  {g.fonte && (
                    <p className="mt-1">
                      <TagFonte>{g.fonte}</TagFonte>
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <Vazio>Estratégia ainda não gerada.</Vazio>
        )}
      </Bloco>

      {/* --------------------------------------------------- primeira mensagem */}
      <Bloco icone="✎" tom="neutro" titulo="Primeira mensagem">
        {diagnostico?.mensagemInicial ? (
          <>
            <p className="whitespace-pre-line rounded-[10px] bg-soft px-3.5 py-[13px] text-[13px] leading-[1.6] text-ink">
              {diagnostico.mensagemInicial}
            </p>
            <p className="mt-2 text-[11px] text-faint">
              Rascunho, não script pronto. Confira antes de enviar — a IA só usou dados deste dossiê.
            </p>
          </>
        ) : (
          <Vazio>Mensagem de abordagem ainda não gerada.</Vazio>
        )}
      </Bloco>

      {/* ------------------------------------------------------------ objecoes */}
      <Bloco icone="?" tom="neutro" titulo="Objeções prováveis">
        {diagnostico && diagnostico.objecoes.length > 0 ? (
          <div className="flex flex-col">
            {diagnostico.objecoes.map((o, i) => (
              <details key={i} className={`group ${i > 0 ? "border-t border-line pt-2 mt-2" : ""}`}>
                <summary className="cursor-pointer select-none list-none text-[13px] font-medium text-muted marker:hidden">
                  <span className="mr-1.5 inline-block text-faint transition-transform group-open:rotate-90">
                    ›
                  </span>
                  &ldquo;{o.pergunta}&rdquo;
                </summary>
                <div className="mt-1 pl-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                    Como responder
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink">{o.resposta}</p>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <Vazio>Objeções ainda não geradas.</Vazio>
        )}
      </Bloco>

      {/* ------------------------------------------------------- fatos usados */}
      {diagnostico && diagnostico.fatosUtilizados.length > 0 && (
        <details className="rounded-xl border border-line px-3.5 py-2.5">
          <summary className="cursor-pointer select-none text-[12px] font-medium text-muted">
            Fatos que a IA usou ({diagnostico.fatosUtilizados.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1 pl-4 text-[12px] text-muted">
            {diagnostico.fatosUtilizados.map((f, i) => (
              <li key={i} className="list-disc">
                {f}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ partes

const TOM_ICONE: Record<string, string> = {
  info: "bg-info-soft text-info",
  ok: "bg-ok-soft text-ok",
  ruim: "bg-bad-soft text-bad",
  warn: "bg-warn-soft text-warn",
  accent: "bg-accent text-white",
  neutro: "bg-soft text-muted",
};

function Bloco({
  icone,
  tom,
  titulo,
  destaque = false,
  children,
}: {
  icone: string;
  tom: keyof typeof TOM_ICONE;
  titulo: string;
  /** bloco da proposta: fundo roxo escuro, o mais destacado da pagina */
  destaque?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border ${
        destaque ? "border-accent/35 bg-accent-soft" : "border-line bg-card"
      }`}
    >
      <header
        className={`flex items-center gap-[9px] px-3.5 py-[9px] ${
          destaque ? "border-b border-accent/25" : "border-b border-line bg-soft"
        }`}
      >
        <span
          aria-hidden="true"
          className={`grid size-5 flex-shrink-0 place-items-center rounded-md text-[11px] font-bold ${TOM_ICONE[tom]}`}
        >
          {icone}
        </span>
        <h2
          className={`font-sans text-[13px] font-semibold ${destaque ? "text-accent-ink" : "text-ink"}`}
        >
          {titulo}
        </h2>
      </header>
      <div className="px-3.5 py-[13px] text-[13.5px] leading-relaxed">{children}</div>
    </section>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <p className="text-[13.5px]">
      <strong className="font-semibold">{rotulo}:</strong> {children}
    </p>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] text-faint">{children}</p>;
}

/** Lista que mistura sinais medidos (com evidencia) e itens escritos pela IA.
 *  Em "fracos": problema real = ✕ vermelho; atencao/oportunidade = ! amarelo. */
function ListaSinais({
  derivados,
  daIa,
  tipo,
  vazio,
}: {
  derivados: SinaisObjetivos["fortes"];
  daIa: string[];
  tipo: "forte" | "fraco";
  vazio: string;
}) {
  const visiveis = derivados.slice(0, MAX_DERIVADOS);
  const sobra = derivados.length - visiveis.length;

  if (visiveis.length === 0 && daIa.length === 0) return <Vazio>{vazio}</Vazio>;

  // Vermelho fica reservado para problema MEDIDO por nos (site fora do ar,
  // sem site...). O que a IA escreve e interpretacao: entra em ambar, para nao
  // dar peso de fato provado a uma leitura do modelo.
  const marcaIa = tipo === "forte" ? "✓" : "!";
  const corIa = tipo === "forte" ? "text-ok" : "text-warn";

  return (
    <ul className="flex flex-col gap-2">
      {visiveis.map((s, i) => {
        const marca = tipo === "forte" ? "✓" : s.grave ? "✕" : "!";
        const cor = tipo === "forte" ? "text-ok" : s.grave ? "text-bad" : "text-warn";
        return (
          <li key={`d${i}`} className="flex items-start gap-2">
            <span aria-hidden="true" className={`w-4 flex-shrink-0 text-center text-[13px] font-bold ${cor}`}>
              {marca}
            </span>
            <span className="flex-1">
              {s.texto}
              <TagFonte>{s.evidencia}</TagFonte>
            </span>
          </li>
        );
      })}
      {daIa.map((t, i) => (
        <li key={`ia${i}`} className="flex items-start gap-2">
          <span aria-hidden="true" className={`w-4 flex-shrink-0 text-center text-[13px] font-bold ${corIa}`}>
            {marcaIa}
          </span>
          <span className="flex-1">
            {t}
            <TagFonte>IA</TagFonte>
          </span>
        </li>
      ))}
      {sobra > 0 && (
        <li className="pl-5 text-[11.5px] text-faint">
          + {sobra} {sobra === 1 ? "outro sinal" : "outros sinais"} em &ldquo;Detalhes técnicos&rdquo;
        </li>
      )}
    </ul>
  );
}

/** Versao em texto simples do dossie, para o botao "Copiar dossiê". */
export function montarTextoDossie(d: DiagnosticoIa): string {
  const linhas: string[] = [];
  linhas.push("RESUMO", d.resumo, "");
  if (d.pontosFortes.length) linhas.push("PONTOS FORTES", ...d.pontosFortes.map((p) => `- ${p}`), "");
  if (d.pontosFracos.length) linhas.push("PONTOS FRACOS", ...d.pontosFracos.map((p) => `- ${p}`), "");
  if (d.proposta.servico) {
    linhas.push(
      "PROPOSTA",
      `Serviço: ${d.proposta.servico}`,
      d.proposta.escopo ? `Escopo: ${d.proposta.escopo}` : "",
      d.proposta.justificativa ? `Por quê: ${d.proposta.justificativa}` : "",
      "",
    );
  }
  if (d.estrategia.gatilhos.length) {
    linhas.push(
      `ESTRATÉGIA (canal: ${d.estrategia.canal || "—"}${
        d.estrategia.melhorHorario ? `, ${d.estrategia.melhorHorario}` : ""
      })`,
      ...d.estrategia.gatilhos.map((g) => `- ${g.titulo}: ${g.descricao} [${g.fonte}]`),
      "",
    );
  }
  if (d.mensagemInicial) linhas.push("MENSAGEM INICIAL", d.mensagemInicial, "");
  if (d.objecoes.length) {
    linhas.push("OBJEÇÕES", ...d.objecoes.map((o) => `P: ${o.pergunta}\nR: ${o.resposta}`), "");
  }
  return linhas.join("\n").trim();
}
