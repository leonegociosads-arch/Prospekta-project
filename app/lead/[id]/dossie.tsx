// Renderiza o dossie comercial completo da IA (etapa 22/23): leitura do
// negocio, pontos fortes/fracos, proposta, estrategia com gatilhos + fonte,
// rascunho de mensagem e objecoes. Componente de servidor - so exibe o que
// ja esta gravado, nao tem interatividade propria.

import type { ReactNode } from "react";
import type { DiagnosticoIa } from "@/lib/ia/tipos";
import { Cartao } from "@/components/ui";

export function Dossie({
  diagnostico,
  modelo,
  atualizadoEm,
}: {
  diagnostico: DiagnosticoIa;
  modelo: string | null;
  atualizadoEm: string | null;
}) {
  const CONF_LABEL: Record<string, string> = { alta: "alta", media: "média", baixa: "baixa" };

  return (
    <div className="flex flex-col gap-4">
      <Cartao className="flex flex-col gap-2">
        <SecaoTitulo icone="◆" tom="info" titulo="Leitura do negócio" />
        <p className="text-sm text-ink">{diagnostico.resumo}</p>
        <p className="text-xs text-faint">
          Confiança do dossiê: <strong className="text-muted">{CONF_LABEL[diagnostico.confianca] ?? diagnostico.confianca}</strong>
        </p>
      </Cartao>

      {diagnostico.pontosFortes.length > 0 && (
        <Cartao className="flex flex-col gap-2">
          <SecaoTitulo icone="↑" tom="ok" titulo="Pontos fortes" />
          <ul className="flex flex-col gap-1.5 text-sm">
            {diagnostico.pontosFortes.map((p, i) => (
              <Item key={i} marca="✓" cor="text-ok">
                {p}
              </Item>
            ))}
          </ul>
        </Cartao>
      )}

      {diagnostico.pontosFracos.length > 0 && (
        <Cartao className="flex flex-col gap-2">
          <SecaoTitulo icone="↓" tom="ruim" titulo="Pontos fracos e dinheiro na mesa" />
          <ul className="flex flex-col gap-1.5 text-sm">
            {diagnostico.pontosFracos.map((p, i) => (
              <Item key={i} marca="✕" cor="text-bad">
                {p}
              </Item>
            ))}
          </ul>
        </Cartao>
      )}

      {(diagnostico.proposta.servico || diagnostico.proposta.escopo) && (
        <Cartao className="flex flex-col gap-2 border-accent/30 bg-accent-soft">
          <SecaoTitulo icone="★" tom="accent" titulo="Proposta comercial sugerida" />
          {diagnostico.proposta.servico && (
            <p className="text-sm">
              <strong>Serviço:</strong> {diagnostico.proposta.servico}
            </p>
          )}
          {diagnostico.proposta.escopo && (
            <p className="text-sm">
              <strong>Escopo:</strong> {diagnostico.proposta.escopo}
            </p>
          )}
          {diagnostico.proposta.justificativa && (
            <p className="text-sm">
              <strong>Por que essa e não outra:</strong> {diagnostico.proposta.justificativa}
            </p>
          )}
          <p className="text-xs text-faint">
            Preço não incluído de propósito — a IA não conhece sua tabela. Defina o valor você.
          </p>
        </Cartao>
      )}

      {(diagnostico.estrategia.canal || diagnostico.estrategia.gatilhos.length > 0) && (
        <Cartao className="flex flex-col gap-2">
          <SecaoTitulo icone="⚡" tom="warn" titulo="Estratégia de abordagem" />
          {(diagnostico.estrategia.canal || diagnostico.estrategia.melhorHorario) && (
            <p className="text-xs text-muted">
              {diagnostico.estrategia.canal && (
                <>
                  Canal: <strong className="text-ink">{diagnostico.estrategia.canal}</strong>
                </>
              )}
              {diagnostico.estrategia.melhorHorario && (
                <> · Melhor horário: {diagnostico.estrategia.melhorHorario}</>
              )}
            </p>
          )}
          <div className="flex flex-col gap-2.5">
            {diagnostico.estrategia.gatilhos.map((g, i) => (
              <div key={i} className="border-l-2 border-info pl-3">
                <p className="text-sm font-semibold">{g.titulo}</p>
                {g.descricao && <p className="text-xs text-muted">{g.descricao}</p>}
                {g.fonte && (
                  <p className="mt-0.5 font-mono text-[10px] text-faint">fonte: {g.fonte}</p>
                )}
              </div>
            ))}
          </div>
        </Cartao>
      )}

      {diagnostico.mensagemInicial && (
        <Cartao className="flex flex-col gap-2">
          <SecaoTitulo icone="✎" tom="neutro" titulo="Rascunho da primeira mensagem" />
          <p className="whitespace-pre-line rounded-xl bg-soft px-3 py-2.5 text-sm leading-relaxed">
            {diagnostico.mensagemInicial}
          </p>
          <p className="text-[11px] text-faint">
            Rascunho, não script pronto. Confira antes de enviar — a IA só usou os dados deste
            dossiê.
          </p>
        </Cartao>
      )}

      {diagnostico.objecoes.length > 0 && (
        <Cartao className="flex flex-col gap-3">
          <SecaoTitulo icone="?" tom="neutro" titulo="Objeções prováveis" />
          {diagnostico.objecoes.map((o, i) => (
            <div key={i} className={i > 0 ? "border-t border-line pt-2.5" : ""}>
              <p className="text-sm font-medium text-muted">{o.pergunta}</p>
              <p className="mt-0.5 text-sm">{o.resposta}</p>
            </div>
          ))}
        </Cartao>
      )}

      {diagnostico.fatosUtilizados.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer select-none font-medium">
            Fatos usados neste dossiê ({diagnostico.fatosUtilizados.length})
          </summary>
          <ul className="mt-1.5 list-disc pl-4">
            {diagnostico.fatosUtilizados.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-[11px] text-faint">
        Texto gerado por {modelo ?? "IA"}
        {atualizadoEm ? ` em ${new Date(atualizadoEm).toLocaleString("pt-BR")}` : ""}. Baseado só
        nos dados coletados pelo Prospekta — confira antes de usar.
      </p>
    </div>
  );
}

const TOM_TITULO: Record<string, string> = {
  info: "bg-info-soft text-info",
  ok: "bg-ok-soft text-ok",
  ruim: "bg-bad-soft text-bad",
  accent: "bg-accent text-white",
  warn: "bg-warn-soft text-warn",
  neutro: "bg-soft text-muted",
};

function SecaoTitulo({ icone, tom, titulo }: { icone: string; tom: keyof typeof TOM_TITULO; titulo: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`grid size-6 flex-shrink-0 place-items-center rounded-md text-xs font-bold ${TOM_TITULO[tom]}`}
      >
        {icone}
      </span>
      <h3 className="text-sm font-semibold">{titulo}</h3>
    </div>
  );
}

function Item({ marca, cor, children }: { marca: string; cor: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden="true" className={`w-4 flex-shrink-0 text-center text-sm font-bold ${cor}`}>
        {marca}
      </span>
      <span>{children}</span>
    </li>
  );
}
