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
