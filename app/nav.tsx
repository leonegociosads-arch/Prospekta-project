"use client";

// Navegação do topo. É cliente só para saber a rota atual e marcar o item
// ativo - nenhuma rota, URL ou comportamento mudou.

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", rotulo: "Painel" },
  { href: "/config", rotulo: "Config" },
];

/** O "Painel" cobre a pesquisa e o lead: são telas da mesma seção. */
function estaAtivo(href: string, caminho: string): boolean {
  if (href === "/") {
    return caminho === "/" || caminho.startsWith("/pesquisa") || caminho.startsWith("/lead");
  }
  return caminho.startsWith(href);
}

export function Nav() {
  const caminho = usePathname() ?? "/";

  return (
    <nav className="flex items-center gap-1 text-[13px]">
      {ITENS.map((i) => {
        const ativo = estaAtivo(i.href, caminho);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={ativo ? "page" : undefined}
            className={`flex-shrink-0 rounded-full px-2.5 py-1.5 font-medium transition-colors sm:px-3 ${
              ativo ? "bg-accent-soft text-accent-ink" : "text-muted hover:bg-soft hover:text-ink"
            }`}
          >
            {i.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
