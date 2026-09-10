"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-card p-6 shadow-card">
      <div>
        <h1 className="text-lg font-semibold">Algo deu errado nesta tela</h1>
        <p className="mt-1 text-sm text-muted">
          O erro foi registrado no terminal do servidor. Você pode tentar de novo — se
          persistir, veja o log lá.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-faint">ref: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-press"
        >
          Tentar de novo
        </button>
        <Link
          href="/"
          className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-medium hover:bg-soft"
        >
          Ir para as pesquisas
        </Link>
      </div>
    </div>
  );
}
