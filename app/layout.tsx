import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Prospekta",
  description: "Ferramenta pessoal de prospeccao de leads.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${figtree.variable} ${bricolage.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-display text-[15px] font-bold tracking-tight">
              <span
                aria-hidden="true"
                className="grid size-7 place-items-center rounded-[9px] bg-accent text-white shadow-sm"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="size-4">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              </span>
              Prospekta
            </Link>
            <nav className="ml-1 flex items-center gap-1 text-[13px]">
              <Link
                href="/config"
                className="rounded-full px-3 py-1.5 font-medium text-muted hover:bg-soft hover:text-ink"
              >
                Config
              </Link>
            </nav>
            <div className="flex-1" />
            <Link
              href="/pesquisa/nova"
              className="rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-accent-press"
            >
              Nova pesquisa
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
