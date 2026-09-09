import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { inicioDoMesUtc } from "@/lib/guardas";
import {
  blocoLimitesInternos,
  blocoTtlCache,
  blocoIa,
  blocoFontesOpcionais,
  blocoEstimativaConsumo,
  blocoPesosScore,
  resumirUso,
  rotularEndpoint,
  type BlocoConfig,
  type LinhaConfig,
  type UsoBruto,
} from "@/lib/config/inspecao";
import { carregarGuardaConfig } from "@/lib/guardas/config";
import { Aviso } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuração · Prospekta" };

export default async function ConfigPage() {
  const db = supabaseServer();
  const inicioMes = inicioDoMesUtc();

  const { data: usoRaw, error } = await db
    .from("api_usage")
    .select("provedor, endpoint, unidades, custo_estimado_usd")
    .gte("em", inicioMes);

  const uso = resumirUso((usoRaw ?? []) as UsoBruto[]);
  const g = carregarGuardaConfig();

  const blocos: BlocoConfig[] = [
    blocoLimitesInternos(),
    blocoEstimativaConsumo(),
    blocoTtlCache(),
    blocoIa(),
    blocoFontesOpcionais(),
    blocoPesosScore(),
  ];

  const nomeMes = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuração</h1>
        <p className="text-sm text-zinc-500">
          Só leitura. Os valores vêm do <span className="font-mono">.env.local</span> — reinicie o
          servidor depois de mudar.
        </p>
      </div>

      {error && <Aviso>Não foi possível ler o consumo do mês: {error.message}</Aviso>}

      {/* Consumo do mes */}
      <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Consumo em {nomeMes}</h2>
          <span className="text-xs text-zinc-500">teto: {g.tetoMensalChamadas} chamadas</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Cartao rotulo="Chamadas Google" valor={String(uso.googleTotal)} sub={`de ${g.tetoMensalChamadas}`} />
          <Cartao rotulo="Chamadas IA" valor={String(uso.iaTotal)} />
          <Cartao rotulo="Custo estimado" valor={`US$ ${uso.custoUsdTotal.toFixed(4)}`} />
        </div>

        {uso.porEndpoint.length === 0 ? (
          <p className="text-xs text-zinc-500">Nenhuma chamada externa neste mês.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[380px] text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="py-1 font-medium">Serviço</th>
                  <th className="py-1 text-right font-medium">Chamadas</th>
                  <th className="py-1 text-right font-medium">Custo (US$)</th>
                </tr>
              </thead>
              <tbody>
                {uso.porEndpoint.map((e) => (
                  <tr key={`${e.provedor}-${e.endpoint}`} className="border-t border-zinc-100 dark:border-zinc-900">
                    <td className="py-1.5">
                      <span className="text-zinc-400">{e.provedor}</span> · {rotularEndpoint(e.endpoint)}
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{e.chamadas}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{e.custoUsd.toFixed(5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {blocos.map((b) => (
        <BlocoView key={b.titulo} bloco={b} />
      ))}

      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        &larr; Pesquisas
      </Link>
    </div>
  );
}

function Cartao({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <p className="text-xs text-zinc-500">{rotulo}</p>
      <p className="font-mono text-lg font-semibold tabular-nums">{valor}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

function BlocoView({ bloco }: { bloco: BlocoConfig }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-medium">{bloco.titulo}</h2>
      {bloco.descricao && <p className="text-xs text-zinc-500">{bloco.descricao}</p>}
      <dl className="mt-1 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
        {bloco.linhas.map((l) => (
          <LinhaView key={l.rotulo} linha={l} />
        ))}
      </dl>
    </section>
  );
}

function LinhaView({ linha }: { linha: LinhaConfig }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <dt className="text-sm text-zinc-700 dark:text-zinc-200">{linha.rotulo}</dt>
        <dd className="font-mono text-sm tabular-nums">{linha.valor}</dd>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-xs text-zinc-400">
        {linha.envVar && <code>{linha.envVar}</code>}
        {linha.faixa && <span>faixa segura: {linha.faixa}</span>}
      </div>
      {linha.aviso && (
        <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {linha.aviso}
        </p>
      )}
    </div>
  );
}
