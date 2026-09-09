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
    <div className="flex flex-col items-start gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <div>
        <h1 className="text-lg font-semibold">Algo deu errado nesta tela</h1>
        <p className="mt-1 text-sm text-zinc-500">
          O erro foi registrado no terminal do servidor. Você pode tentar de novo — se
          persistir, veja o log lá.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-zinc-400">ref: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Tentar de novo
        </button>
        <Link
          href="/"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Ir para as pesquisas
        </Link>
      </div>
    </div>
  );
}
