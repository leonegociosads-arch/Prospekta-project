import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-card p-6 shadow-card">
      <div>
        <h1 className="text-lg font-semibold">Página não encontrada</h1>
        <p className="mt-1 text-sm text-muted">
          Essa pesquisa ou lead pode ter sido removido, ou o endereço está errado.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-press"
      >
        Ir para as pesquisas
      </Link>
    </div>
  );
}
