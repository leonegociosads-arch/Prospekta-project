import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { NICHOS } from "@/lib/nichos";

export const metadata = { title: "Nova pesquisa · Prospekta" };
export const dynamic = "force-dynamic";

const MENSAGENS_ERRO: Record<string, string> = {
  campos: "Preencha a regiao e o nicho.",
  banco: "Nao foi possivel salvar a pesquisa. Tente de novo.",
};

// Server Action: roda no servidor quando o formulario e enviado.
async function criarPesquisa(formData: FormData) {
  "use server";

  const regiao = String(formData.get("regiao") ?? "").trim();
  const nicho = String(formData.get("nicho") ?? "").trim();
  const raioBruto = Number(formData.get("raio_km"));
  const limiteBruto = Number(formData.get("limite_leads"));

  if (!regiao || !nicho) {
    redirect("/pesquisa/nova?erro=campos");
  }

  // Limites de seguranca: raio 1-50 km, ate 60 leads por pesquisa.
  const raio = Number.isFinite(raioBruto) ? Math.min(Math.max(raioBruto, 1), 50) : 10;
  const limite = Number.isFinite(limiteBruto) ? Math.min(Math.max(limiteBruto, 1), 60) : 20;

  // Cada chamada Text Search cobre 20 resultados; +1 para o geocoding da regiao.
  const orcamentoChamadas = Math.ceil(limite / 20) + 1;

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("searches")
    .insert({
      regiao_texto: regiao,
      nicho,
      raio_km: raio,
      limite_leads: limite,
      orcamento_chamadas: orcamentoChamadas,
      status: "nova",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Erro ao criar pesquisa:", error);
    redirect("/pesquisa/nova?erro=banco");
  }

  redirect(`/pesquisa/${data.id}`);
}

export default async function NovaPesquisaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const mensagemErro = erro ? MENSAGENS_ERRO[erro] ?? "Algo deu errado." : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Nova pesquisa</h1>
        <p className="text-sm text-zinc-500">
          Regiao, raio e nicho. A busca de empresas ainda nao roda nesta etapa —
          por enquanto so salvamos a pesquisa.
        </p>
      </div>

      {mensagemErro && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {mensagemErro}
        </p>
      )}

      <form action={criarPesquisa} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Regiao</span>
          <input
            name="regiao"
            required
            placeholder="Iguape, SP"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <span className="text-xs text-zinc-500">Cidade, bairro ou &ldquo;cidade, UF&rdquo;.</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Nicho</span>
          <input
            name="nicho"
            required
            list="lista-nichos"
            placeholder="Advocacia"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <datalist id="lista-nichos">
            {NICHOS.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <span className="text-xs text-zinc-500">Escolha da lista ou digite o seu.</span>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Raio (km)</span>
            <input
              name="raio_km"
              type="number"
              min={1}
              max={50}
              defaultValue={10}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Limite de leads</span>
            <input
              name="limite_leads"
              type="number"
              min={1}
              max={60}
              defaultValue={20}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <span className="text-xs text-zinc-500">20 = 1 chamada da Google.</span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Salvar pesquisa
          </button>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
