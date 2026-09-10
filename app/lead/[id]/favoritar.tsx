"use client";

import { useState, useTransition } from "react";
import { definirFavoritoAction } from "./actions";

export function Favoritar({
  leadId,
  inicial,
  tamanho = "md",
}: {
  leadId: string;
  inicial: boolean;
  tamanho?: "sm" | "md";
}) {
  const [favorito, setFavorito] = useState(inicial);
  const [pendente, startTransition] = useTransition();

  function alternar() {
    const alvo = !favorito;
    setFavorito(alvo); // otimista
    startTransition(async () => {
      const r = await definirFavoritoAction(leadId, alvo);
      setFavorito(r.favorito);
    });
  }

  const cls = tamanho === "sm" ? "text-base" : "text-lg";
  return (
    <button
      type="button"
      onClick={alternar}
      disabled={pendente}
      aria-pressed={favorito}
      aria-label={favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      title={favorito ? "Favorito" : "Favoritar"}
      className={`${cls} leading-none transition-opacity disabled:opacity-50 ${
        favorito ? "text-amber-500" : "text-muted hover:text-amber-400"
      }`}
    >
      {favorito ? "★" : "☆"}
    </button>
  );
}
