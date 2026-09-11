// Primitivos de UI reaproveitados pelas paginas. Sem biblioteca, sem estado.
// Cores vem dos tokens de app/globals.css (trocam sozinhas no modo escuro).

import type { ReactNode } from "react";

/** Classes de botao, para manter todos iguais. */
const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const BTN_SIZE = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };

export function botaoClasses(
  variante: "primario" | "fantasma" = "primario",
  tamanho: "sm" | "md" = "md",
): string {
  const cor =
    variante === "primario"
      ? "bg-accent text-white shadow-sm hover:bg-accent-press"
      : "border border-line-strong bg-card text-ink hover:bg-soft";
  return `${BTN_BASE} ${BTN_SIZE[tamanho]} ${cor}`;
}

/** Cartao padrao: fundo branco, borda fina, cantos arredondados, sombra suave. */
export function Cartao({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

const TOM_ICONE = {
  accent: "bg-accent-soft",
  ok: "bg-ok-soft",
  warn: "bg-warn-soft",
  info: "bg-info-soft",
};

/** Cabecalho de secao: um "azulejo" colorido com emoji + titulo + subtitulo. */
export function SecaoHeader({
  icone,
  tom = "accent",
  titulo,
  subtitulo,
}: {
  icone: string;
  tom?: keyof typeof TOM_ICONE;
  titulo: string;
  subtitulo?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`grid size-9 flex-shrink-0 place-items-center rounded-xl text-lg ${TOM_ICONE[tom]}`}
      >
        {icone}
      </span>
      <div>
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        {subtitulo && <p className="mt-0.5 text-xs text-muted">{subtitulo}</p>}
      </div>
    </div>
  );
}

/** Bloco de "nao ha nada aqui ainda", com acao opcional. */
export function EstadoVazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">{titulo}</p>
      {descricao && <p className="mx-auto mt-1 max-w-sm text-xs text-muted">{descricao}</p>}
      {acao && <div className="mt-4 flex justify-center">{acao}</div>}
    </div>
  );
}

/** Banner curto. `tom` carrega o significado da cor. */
export function Aviso({
  children,
  tom = "erro",
}: {
  children: ReactNode;
  tom?: "erro" | "atencao" | "ok" | "info";
}) {
  const cores: Record<string, string> = {
    erro: "bg-bad-soft text-bad",
    atencao: "bg-warn-soft text-warn",
    ok: "bg-ok-soft text-ok",
    info: "bg-soft text-muted",
  };
  return <div className={`rounded-xl px-3 py-2 text-xs ${cores[tom]}`}>{children}</div>;
}

/** Retangulo pulsante para telas de carregamento. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-soft ${className}`} />;
}

/** Etiqueta pequena (categoria, status). */
export function Chip({ children, tom = "neutro" }: { children: ReactNode; tom?: "neutro" | "alerta" | "ok" }) {
  const cores = {
    neutro: "bg-soft text-muted",
    alerta: "bg-warn-soft text-warn",
    ok: "bg-ok-soft text-ok",
  }[tom];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cores}`}>{children}</span>;
}

/** Pastilha de estado: bolinha + rotulo curto. `tom` carrega o significado.
 *  Usada nas colunas "Anuncios" e "Site" da tabela de leads. */
export function Pastilha({
  children,
  tom = "neutro",
}: {
  children: ReactNode;
  tom?: "ok" | "atencao" | "ruim" | "info" | "neutro" | "apagado";
}) {
  const cores: Record<string, string> = {
    ok: "bg-ok-soft text-ok",
    atencao: "bg-warn-soft text-warn",
    ruim: "bg-bad-soft text-bad",
    info: "bg-info-soft text-info",
    neutro: "bg-soft text-muted",
    apagado: "bg-soft text-faint",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cores[tom]}`}
    >
      <span aria-hidden="true" className="size-1.5 flex-shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

/** Selo de score com cor por faixa: verde alto, amarelo medio, vermelho baixo. */
export function SeloScore({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-faint">—</span>;
  const cor =
    score >= 70
      ? "bg-ok-soft text-ok"
      : score >= 40
        ? "bg-warn-soft text-warn"
        : "bg-bad-soft text-bad";
  return (
    <span
      className={`inline-block min-w-[2.25rem] rounded-lg px-1.5 py-0.5 text-center font-mono text-sm font-bold tabular-nums ${cor}`}
    >
      {score}
    </span>
  );
}

/** Score grande (numero solto, sem fundo), para o cabecalho da pagina do lead.
 *  Mesma faixa de cor do SeloScore. */
export function ScoreGrande({ score }: { score: number | null }) {
  const cor = score == null ? "text-faint" : score >= 70 ? "text-ok" : score >= 40 ? "text-warn" : "text-bad";
  return (
    <div className="text-right">
      <p className={`font-mono text-3xl font-semibold leading-none tabular-nums ${cor}`}>
        {score ?? "—"}
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-faint">Score</p>
    </div>
  );
}
