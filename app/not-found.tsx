import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <div>
        <h1 className="text-lg font-semibold">Página não encontrada</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Essa pesquisa ou lead pode ter sido removido, ou o endereço está errado.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Ir para as pesquisas
      </Link>
    </div>
  );
}
