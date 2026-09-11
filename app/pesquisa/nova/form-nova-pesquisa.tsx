"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NICHOS } from "@/lib/nichos";
import { LIMITES, estimarConsumo } from "@/lib/pesquisa/estimativa";
import { Metrica, Panel } from "@/components/ui";
import { criarPesquisaAction } from "./actions";
import { ESTADO_INICIAL, type EstadoForm } from "./estado";

const campoBase =
  "rounded-xl border bg-painel px-3 py-2 text-sm text-ink outline-none transition-colors " +
  "border-line focus:border-accent";

function erroDe(estado: EstadoForm, campo: string): string | undefined {
  return estado.status === "erro-validacao" ? estado.erros[campo as keyof typeof estado.erros] : undefined;
}

function MsgErro({ children }: { children?: string }) {
  if (!children) return null;
  return <span className="text-xs text-bad">{children}</span>;
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
      <Panel className="flex flex-col gap-5 p-4 sm:p-5">
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
          <span className="text-xs text-muted">Cidade, ou &ldquo;cidade, UF&rdquo;.</span>
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
          <span className="text-xs text-muted">Texto livre. Ex.: advocacia, lanchonetes, academias.</span>
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
            <span className="text-xs text-muted">
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
            <span className="text-xs text-muted">
              Maximo {LIMITES.leadsMax} (1 chamada, sem paginacao).
            </span>
            <MsgErro>{erroDe(estado, "limiteLeads")}</MsgErro>
          </label>
        </div>
      </fieldset>
      </Panel>

      {/* Estimativa ao vivo */}
      <Panel rotulo="Estimativa da pesquisa" className="p-4 text-sm sm:p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <Metrica
            rotulo="Leads solicitados"
            valor={`${est.leadsAlvo}`}
            sub={`empresa${est.leadsAlvo === 1 ? "" : "s"}`}
          />
          <Metrica
            rotulo="Chamadas estimadas"
            valor={`${est.chamadasMin}–${est.chamadasMax}`}
            sub="Google Places"
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          1 busca + até 1 geocodificação se a região for nova — dentro da cota gratuita. Esta
          etapa só cria a pesquisa e coloca a descoberta na fila; a busca de empresas no Google
          roda depois, na página da pesquisa.
        </p>
      </Panel>

      {/* Banners de estado */}
      {estado.status === "erro-supabase" && (
        <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">
          {estado.mensagem}
        </p>
      )}
      {estado.status === "erro-validacao" && (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          Confira os campos destacados acima.
        </p>
      )}
      {estado.status === "ok" && (
        <p className="rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">
          Pesquisa criada. Redirecionando&hellip;
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={travado}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Salvando…" : estado.status === "ok" ? "Criada" : "Iniciar pesquisa"}
        </button>
      </div>
    </form>
  );
}
