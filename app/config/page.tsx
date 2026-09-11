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
import { Aviso, Metrica, Panel, Voltar } from "@/components/ui";

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
      <Voltar href="/">Pesquisas</Voltar>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuração</h1>
        <p className="text-sm text-muted">
          Só leitura. Os valores vêm do <span className="font-mono">.env.local</span> — reinicie o
          servidor depois de mudar.
        </p>
      </div>

      {error && <Aviso>Não foi possível ler o consumo do mês: {error.message}</Aviso>}

      {/* Consumo do mes */}
      <Panel rotulo={`Consumo em ${nomeMes}`} className="flex flex-col gap-3 p-4">
        <p className="text-xs text-muted">Teto configurado: {g.tetoMensalChamadas} chamadas Google/mês.</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metrica rotulo="Chamadas Google" valor={String(uso.googleTotal)} sub={`de ${g.tetoMensalChamadas}`} />
          <Metrica rotulo="Chamadas IA" valor={String(uso.iaTotal)} />
          <Metrica rotulo="Custo estimado" valor={`US$ ${uso.custoUsdTotal.toFixed(4)}`} />
        </div>

        {uso.porEndpoint.length === 0 ? (
          <p className="text-xs text-muted">Nenhuma chamada externa neste mês.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[380px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 font-medium">Serviço</th>
                  <th className="py-1 text-right font-medium">Chamadas</th>
                  <th className="py-1 text-right font-medium">Custo (US$)</th>
                </tr>
              </thead>
              <tbody>
                {uso.porEndpoint.map((e) => (
                  <tr key={`${e.provedor}-${e.endpoint}`} className="border-t border-line">
                    <td className="py-1.5">
                      <span className="text-faint">{e.provedor}</span> · {rotularEndpoint(e.endpoint)}
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{e.chamadas}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{e.custoUsd.toFixed(5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {blocos.map((b) => (
        <BlocoView key={b.titulo} bloco={b} />
      ))}
    </div>
  );
}

function BlocoView({ bloco }: { bloco: BlocoConfig }) {
  return (
    <Panel rotulo={bloco.titulo} className="flex flex-col gap-2 p-4">
      {bloco.descricao && <p className="text-xs text-muted">{bloco.descricao}</p>}
      <dl className="mt-1 flex flex-col divide-y divide-line">
        {bloco.linhas.map((l) => (
          <LinhaView key={l.rotulo} linha={l} />
        ))}
      </dl>
    </Panel>
  );
}

function LinhaView({ linha }: { linha: LinhaConfig }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <dt className="text-sm text-ink">{linha.rotulo}</dt>
        <dd className="font-mono text-sm tabular-nums">{linha.valor}</dd>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-xs text-faint">
        {linha.envVar && <code>{linha.envVar}</code>}
        {linha.faixa && <span>faixa segura: {linha.faixa}</span>}
      </div>
      {linha.aviso && (
        <p className="mt-1 rounded-xl bg-warn-soft px-2 py-1 text-xs text-warn">
          {linha.aviso}
        </p>
      )}
    </div>
  );
}
