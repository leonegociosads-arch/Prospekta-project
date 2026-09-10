import Link from "next/link";
import { FormNovaPesquisa } from "./form-nova-pesquisa";

export const metadata = { title: "Nova pesquisa · Prospekta" };

export default function NovaPesquisaPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Nova pesquisa</h1>
        <p className="text-sm text-muted">
          Regiao, nicho e raio. Esta etapa cria e salva a pesquisa e coloca a
          descoberta na fila &mdash; a busca de empresas no Google roda depois.
        </p>
      </div>

      <FormNovaPesquisa />

      <Link href="/" className="text-sm text-muted hover:text-ink">
        &larr; Voltar para as pesquisas
      </Link>
    </div>
  );
}
