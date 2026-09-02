import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prospekta",
  description: "Ferramenta pessoal de prospeccao de leads.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
            <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
              prospekta<span className="text-amber-600">.</span>
            </Link>
            <Link
              href="/pesquisa/nova"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Nova pesquisa
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
