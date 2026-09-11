"use client";

// Botão de trocar tema (etapa 32). Fica no cabeçalho, entao aparece em TODAS
// as abas - o cabeçalho e compartilhado pelo layout raiz.
//
// O padrao (sem escolha salva) e escuro - a identidade do Prospekta. A
// escolha do usuario fica em localStorage e e aplicada via atributo
// data-theme na tag <html>, que os tokens de app/globals.css leem.
//
// Le o tema atual com useSyncExternalStore em vez de useState+useEffect: o
// valor real so existe no DOM do navegador (o script inline do layout ja
// pode te-lo alterado antes de qualquer JS React rodar), entao isso e
// literalmente o caso que o hook foi feito para resolver - sem o efeito
// colateral de "setState dentro de effect" que useEffect(() => setX(...))
// causaria.

import { useSyncExternalStore } from "react";

const CHAVE_TEMA = "prospekta-tema";

function obterTema(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

/** o padrao do servidor (sem DOM) e sempre escuro - o mesmo do :root sem atributo */
function obterTemaNoServidor(): "light" | "dark" {
  return "dark";
}

function assinarMudancasDeTema(notificar: () => void): () => void {
  const observador = new MutationObserver(notificar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observador.disconnect();
}

export function TrocarTema() {
  const tema = useSyncExternalStore(assinarMudancasDeTema, obterTema, obterTemaNoServidor);
  const claro = tema === "light";

  function alternar() {
    const novoTema = claro ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", novoTema);
    try {
      localStorage.setItem(CHAVE_TEMA, novoTema);
    } catch {
      // localStorage bloqueado (modo privado, etc.) - a troca ainda funciona
      // nesta visita, so nao e lembrada na proxima.
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={claro ? "Mudar para tema escuro" : "Mudar para tema claro"}
      title={claro ? "Tema claro (clique para escurecer)" : "Tema escuro (clique para clarear)"}
      className="grid size-8 flex-shrink-0 place-items-center rounded-full border border-line text-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      {claro ? <IconeSol /> : <IconeLua />}
    </button>
  );
}

function IconeSol() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8" />
    </svg>
  );
}

function IconeLua() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />
    </svg>
  );
}
