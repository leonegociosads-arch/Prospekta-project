// Primitivos de UI reaproveitados pelas paginas. Sem biblioteca, sem estado.
// Objetivo: consistencia e menos repeticao de classes Tailwind.

import type { ReactNode } from "react";

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
    <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{titulo}</p>
      {descricao && <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500">{descricao}</p>}
      {acao && <div className="mt-4 flex justify-center">{acao}</div>}
    </div>
  );
}

/** Banner de erro amigavel. `tom` muda a cor. */
export function Aviso({
  children,
  tom = "erro",
}: {
  children: ReactNode;
  tom?: "erro" | "atencao" | "ok" | "info";
}) {
  const cores: Record<string, string> = {
    erro: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    atencao: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    ok: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    info: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  };
  return <div className={`rounded-md px-3 py-2 text-xs ${cores[tom]}`}>{children}</div>;
}

/** Retangulo cinza pulsante para telas de carregamento. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800 ${className}`} />;
}

/** Etiqueta pequena (categoria, status). */
export function Chip({ children, tom = "neutro" }: { children: ReactNode; tom?: "neutro" | "alerta" }) {
  const cores =
    tom === "alerta"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${cores}`}>{children}</span>
  );
}

/** Selo de score com cor por faixa. */
export function SeloScore({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-zinc-400">—</span>;
  const cor =
    score >= 70
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : score >= 40
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
  return (
    <span
      className={`inline-block min-w-[2.25rem] rounded-md px-1.5 py-0.5 text-center font-mono text-sm font-semibold tabular-nums ${cor}`}
    >
      {score}
    </span>
  );
}
