// Graficos da home (etapa 31): so os dois tipos que a pagina realmente
// precisa. Sem biblioteca - SVG puro para a rosca, divs para as barras (mesma
// tecnica que a barrinha de score da tabela de leads ja usa).
//
// As cores vem sempre dos tokens semanticos (ok/warn/bad/accent) - nunca um
// hex solto aqui. Nenhum grafico usa cor como unico portador de informacao:
// todo segmento/barra tem numero e rotulo em texto ao lado.

const RAIO = 40;
const ESPESSURA = 13;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

export type FatiaRosca = {
  rotulo: string;
  valor: number;
  /** classe Tailwind de cor (ex.: "text-ok") - o SVG le a cor via `currentColor` */
  corTexto: string;
};

/**
 * Rosca (donut): composicao de um total em poucas categorias. Usada para
 * "qualidade dos leads" (bons/medios/ruins). Nunca pizza 3D, nunca gauge.
 */
export function Rosca({
  fatias,
  centroValor,
  centroRotulo,
}: {
  fatias: FatiaRosca[];
  centroValor: string;
  centroRotulo: string;
}) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <svg viewBox="0 0 100 100" className="size-36 flex-shrink-0">
        {/* o grupo gira so os aneis, para a 1a fatia comecar as 12h - o
            texto do centro fica FORA do grupo, sempre na horizontal */}
        <g transform="rotate(-90 50 50)">
          {total === 0 ? (
            <circle cx="50" cy="50" r={RAIO} fill="none" stroke="var(--line)" strokeWidth={ESPESSURA} />
          ) : (
            (() => {
              const comValor = fatias.filter((f) => f.valor > 0);
              let acumulado = 0;
              return comValor.map((f) => {
                // 2px de folga entre fatias, igual a regra de segmentos empilhados
                const gap = comValor.length > 1 ? 2 : 0;
                const comprimento = Math.max((f.valor / total) * CIRCUNFERENCIA - gap, 0);
                const offset = -((acumulado / total) * CIRCUNFERENCIA);
                acumulado += f.valor;
                return (
                  <circle
                    key={f.rotulo}
                    cx="50"
                    cy="50"
                    r={RAIO}
                    fill="none"
                    stroke="currentColor"
                    className={f.corTexto}
                    strokeWidth={ESPESSURA}
                    strokeDasharray={`${comprimento} ${CIRCUNFERENCIA}`}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                  >
                    <title>
                      {f.rotulo}: {f.valor} ({Math.round((f.valor / total) * 100)}%)
                    </title>
                  </circle>
                );
              });
            })()
          )}
        </g>
        <text x="50" y="47" textAnchor="middle" className="fill-ink font-mono text-[22px] font-bold">
          {centroValor}
        </text>
        <text
          x="50"
          y="63"
          textAnchor="middle"
          className="fill-faint text-[7.5px] font-bold uppercase tracking-[0.06em]"
        >
          {centroRotulo}
        </text>
      </svg>

      <ul className="flex w-full flex-col gap-1.5">
        {fatias.map((f) => (
          <li key={f.rotulo} className="flex items-center gap-2 text-[13px]">
            <span aria-hidden="true" className={`size-2 flex-shrink-0 rounded-full bg-current ${f.corTexto}`} />
            <span className="text-muted">{f.rotulo}</span>
            <span className="ml-auto font-mono font-semibold tabular-nums text-ink">{f.valor}</span>
            <span className="w-10 text-right font-mono text-[11px] tabular-nums text-faint">
              {total > 0 ? `${Math.round((f.valor / total) * 100)}%` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type BarraHorizontal = {
  id: string;
  rotulo: string;
  valor: number;
  /** texto do title nativo (tooltip) ao passar o mouse */
  dica?: string;
  href?: string;
};

/**
 * Barras horizontais: comparar uma quantidade entre categorias (pesquisas).
 * Uma unica cor (roxo da marca) porque e UMA metrica so, so a categoria muda
 * - colorir por barra viraria arco-iris sem significado.
 */
export function BarrasHorizontais({ barras }: { barras: BarraHorizontal[] }) {
  const max = Math.max(1, ...barras.map((b) => b.valor));

  return (
    <ul className="flex flex-col gap-3">
      {barras.map((b) => {
        const linha = (
          <>
            <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="truncate font-medium text-ink">{b.rotulo}</span>
              <span className="flex-shrink-0 font-mono font-semibold tabular-nums text-ink">{b.valor}</span>
            </div>
            <div className="mt-1 h-[7px] overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${Math.max(3, (b.valor / max) * 100)}%` }}
              />
            </div>
          </>
        );
        return (
          <li key={b.id} title={b.dica}>
            {b.href ? (
              <a href={b.href} className="block rounded-lg transition-opacity hover:opacity-80">
                {linha}
              </a>
            ) : (
              linha
            )}
          </li>
        );
      })}
    </ul>
  );
}
