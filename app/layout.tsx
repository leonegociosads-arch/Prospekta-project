import type { Metadata } from "next";
import { Figtree, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Nav } from "./nav";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Prospekta",
  description: "Ferramenta pessoal de prospeccao de leads.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${figtree.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
          <div className="mx-auto flex max-w-[68rem] items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-display text-[15px] font-bold tracking-tight"
            >
              <MarcaRadar />
              Prospekta
            </Link>

            <Nav />

            <div className="flex-1" />

            {/* No celular o rótulo encurta para a barra caber sem quebrar linha. */}
            <Link
              href="/pesquisa/nova"
              className="flex-shrink-0 rounded-full bg-accent px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-press sm:px-3.5"
            >
              Nova<span className="hidden sm:inline"> pesquisa</span>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[68rem] flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}

/**
 * Símbolo da marca: um radar. Os dois anéis são a varredura; o ponto verde é
 * a oportunidade encontrada - que é literalmente o que o Prospekta faz.
 * É o único lugar onde o verde da MARCA aparece, para não competir com o
 * verde de STATUS ("bom/confirmado") usado nos dados.
 */
function MarcaRadar() {
  return (
    <span
      aria-hidden="true"
      className="grid size-7 flex-shrink-0 place-items-center rounded-[9px] border border-line bg-painel"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[17px]">
        <circle cx="12" cy="12" r="8.5" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4" />
        <circle cx="12" cy="12" r="4.25" stroke="var(--accent)" strokeWidth="1.5" />
        <circle cx="17.25" cy="6.75" r="2.5" fill="var(--brand-green)" />
      </svg>
    </span>
  );
}
