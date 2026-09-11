import { Voltar } from "@/components/ui";
import { FormNovaPesquisa } from "./form-nova-pesquisa";

export const metadata = { title: "Nova pesquisa · Prospekta" };

export default function NovaPesquisaPage() {
  return (
    <div className="flex flex-col gap-6">
      <Voltar href="/">Pesquisas</Voltar>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Nova pesquisa</h1>
        <p className="text-sm text-muted">Escolha região, nicho e alcance.</p>
      </div>

      <FormNovaPesquisa />
    </div>
  );
}
