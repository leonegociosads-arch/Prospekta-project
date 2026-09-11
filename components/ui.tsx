// Primitivos de UI reaproveitados pelas paginas. Sem biblioteca, sem estado.
// Cores vem dos tokens de app/globals.css (trocam sozinhas no modo escuro).

import type { ReactNode } from "react";
import Link from "next/link";

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

/** Cabecalho de secao: um "azulejo" colorido com emoji + titulo + subtitulo.
 *  `acao`, se passado, fica alinhada a direita (ex.: o botao daquele bloco). */
export function SecaoHeader({
  icone,
  tom = "accent",
  titulo,
  subtitulo,
  acao,
}: {
  icone: string;
  tom?: keyof typeof TOM_ICONE;
  titulo: string;
  subtitulo?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <span
        aria-hidden="true"
        className={`grid size-9 flex-shrink-0 place-items-center rounded-xl text-lg ${TOM_ICONE[tom]}`}
      >
        {icone}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        {subtitulo && <p className="mt-0.5 text-xs text-muted">{subtitulo}</p>}
      </div>
      {acao}
    </div>
  );
}

/** Link de volta discreto - mesmo estilo usado no topo do dossie do lead.
 *  Padroniza a navegacao "para tras" em todas as paginas. */
export function Voltar({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-[12.5px] text-muted hover:text-ink">
      &larr; {children}
    </Link>
  );
}

/** Painel: mesmo container do dossie do lead (borda fina, cantos
 *  arredondados, sem sombra). `rotulo`, se passado, vira uma barra fina em
 *  caixa alta no topo - o "PAINEL DO LEAD · DOSSIÊ COMPLETO" generalizado. */
export function Panel({
  rotulo,
  children,
  className = "",
}: {
  rotulo?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-line bg-card ${className}`}>
      {rotulo && (
        <p className="border-b border-line bg-soft px-3.5 py-[7px] text-[11px] font-bold uppercase tracking-[0.06em] text-faint">
          {rotulo}
        </p>
      )}
      {children}
    </section>
  );
}

/** Metrica compacta: rotulo em caixa alta + valor grande em mono. Usada nos
 *  resumos do painel principal, da pesquisa e da configuracao - era o mesmo
 *  padrao reimplementado em cada pagina, agora e um so componente. */
export function Metrica({
  rotulo,
  valor,
  sub,
}: {
  rotulo: string;
  valor: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-faint">{rotulo}</p>
      <p className="mt-[3px] font-mono text-lg font-semibold tabular-nums text-ink">{valor}</p>
      {sub && <p className="text-[11px] text-faint">{sub}</p>}
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
      {/* Único lugar, além do símbolo da marca, onde o radar aparece: aqui ele
          tem função - é a varredura que ainda não achou nada. */}
      <svg
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="mx-auto mb-3 size-8 text-line-strong"
      >
        <circle cx="24" cy="24" r="19" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <circle cx="24" cy="24" r="11" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
        <circle cx="24" cy="24" r="2.5" fill="currentColor" />
      </svg>
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

/** Tag minuscula de evidencia/fonte ("HTTP 522", "Google Places", "IA").
 *  Fica ao lado do texto para dizer de onde o dado saiu. */
export function TagFonte({ children }: { children: ReactNode }) {
  return (
    <span className="ml-1.5 inline-block break-words rounded-[5px] bg-soft px-1.5 py-px align-[1px] font-mono text-[10px] leading-[1.5] text-faint">
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
