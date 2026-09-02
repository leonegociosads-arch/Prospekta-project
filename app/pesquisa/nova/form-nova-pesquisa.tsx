"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NICHOS } from "@/lib/nichos";
import { LIMITES, estimarConsumo } from "@/lib/pesquisa/estimativa";
import { criarPesquisaAction, ESTADO_INICIAL, type EstadoForm } from "./actions";

const campoBase =
  "rounded-md border bg-white px-3 py-2 text-sm outline-none dark:bg-zinc-900 " +
  "border-zinc-300 focus:border-zinc-500 dark:border-zinc-700 dark:focus:border-zinc-400";

function erroDe(estado: EstadoForm, campo: string): string | undefined {
  return estado.status === "erro-validacao" ? estado.erros[campo as keyof typeof estado.erros] : undefined;
}

function MsgErro({ children }: { children?: string }) {
  if (!children) return null;
  return <span className="text-xs text-red-600 dark:text-red-400">{children}</span>;
}

export function FormNovaPesquisa() {
  const router = useRouter();
  const [estado, formAction, pending] = useActionState(criarPesquisaAction, ESTADO_INICIAL);
  const [limite, setLimite] = useState<number>(LIMITES.leadsPadrao);

  const est = estimarConsumo(limite);
  const travado = pending || estado.status === "ok";

  useEffect(() => {
    if (estado.status === "ok") {
      router.push(`/pesquisa/${estado.searchId}`);
    }
  }, [estado, router]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <fieldset disabled={travado} className="flex flex-col gap-5">
        {/* Regiao */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Regiao</span>
          <input
            name="regiao"
            required
            maxLength={120}
            placeholder="Iguape, SP"
            aria-invalid={Boolean(erroDe(estado, "regiao"))}
            className={campoBase}
          />
          <span className="text-xs text-zinc-500">Cidade, ou &ldquo;cidade, UF&rdquo;.</span>
          <MsgErro>{erroDe(estado, "regiao")}</MsgErro>
        </label>

        {/* Nicho */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Nicho</span>
          <input
            name="nicho"
            required
            maxLength={60}
            list="lista-nichos"
            placeholder="dentistas"
            aria-invalid={Boolean(erroDe(estado, "nicho"))}
            className={campoBase}
          />
          <datalist id="lista-nichos">
            {NICHOS.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <span className="text-xs text-zinc-500">Texto livre. Ex.: advocacia, lanchonetes, academias.</span>
          <MsgErro>{erroDe(estado, "nicho")}</MsgErro>
        </label>

        {/* Raio + Limite */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Raio (km)</span>
            <input
              name="raio_km"
              type="number"
              inputMode="numeric"
              min={LIMITES.raioMinKm}
              max={LIMITES.raioMaxKm}
              step={1}
              defaultValue={LIMITES.raioPadraoKm}
              aria-invalid={Boolean(erroDe(estado, "raioKm"))}
              className={campoBase}
            />
            <span className="text-xs text-zinc-500">
              Entre {LIMITES.raioMinKm} e {LIMITES.raioMaxKm} km.
            </span>
            <MsgErro>{erroDe(estado, "raioKm")}</MsgErro>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Limite de leads</span>
            <input
              name="limite_leads"
              type="number"
              inputMode="numeric"
              min={LIMITES.leadsMin}
              max={LIMITES.leadsMax}
              step={1}
              value={limite}
              onChange={(e) => setLimite(Number(e.target.value))}
              aria-invalid={Boolean(erroDe(estado, "limiteLeads"))}
              className={campoBase}
            />
            <span className="text-xs text-zinc-500">
              Maximo {LIMITES.leadsMax} (1 chamada, sem paginacao).
            </span>
            <MsgErro>{erroDe(estado, "limiteLeads")}</MsgErro>
          </label>
        </div>
      </fieldset>

      {/* Estimativa ao vivo */}
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
        <p>
          Vamos buscar ate <strong>{est.leadsAlvo} empresa{est.leadsAlvo === 1 ? "" : "s"}</strong>.
        </p>
        <p className="mt-1 text-zinc-500">
          Consumo estimado: <strong>{est.chamadasMin} a {est.chamadasMax} chamada{est.chamadasMax === 1 ? "" : "s"}</strong>{" "}
          a Google Places (1 busca + ate 1 geocodificacao se a regiao for nova). Dentro da cota gratuita.
        </p>
      </div>

      {/* Banners de estado */}
      {estado.status === "erro-supabase" && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {estado.mensagem}
        </p>
      )}
      {estado.status === "erro-validacao" && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Confira os campos destacados acima.
        </p>
      )}
      {estado.status === "ok" && (
        <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Pesquisa criada. Redirecionando&hellip;
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={travado}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Salvando…" : estado.status === "ok" ? "Criada" : "Criar pesquisa"}
        </button>
      </div>
    </form>
  );
}
