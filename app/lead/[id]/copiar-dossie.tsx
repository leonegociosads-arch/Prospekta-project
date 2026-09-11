"use client";

import { useState } from "react";
import { botaoClasses } from "@/components/ui";

/** Botão "Copiar dossiê" do rodapé do dossiê (etapa 23 - visual do mockup). */
export function CopiarDossie({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard indisponivel (contexto sem HTTPS, permissao negada etc.) - so nao faz nada
    }
  }

  return (
    <button type="button" onClick={() => void copiar()} className={botaoClasses("fantasma", "sm")}>
      {copiado ? "Copiado ✓" : "Copiar dossiê"}
    </button>
  );
}
