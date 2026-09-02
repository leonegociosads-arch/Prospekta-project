// BUDGET - decide se a proxima chamada externa pode acontecer.
// Duas travas: teto mensal interno E orcamento da pesquisa.

import type { GuardaStore } from "./store";
import { carregarGuardaConfig, type GuardaConfig } from "./config";
import { totalChamadasNoMes } from "./usage";

export type MotivoVeredito =
  | "ok"
  | "teto-mensal-atingido"
  | "orcamento-da-pesquisa-esgotado"
  | "pesquisa-nao-encontrada";

export type VerdictoOrcamento = {
  permitido: boolean;
  motivo: MotivoVeredito;
  detalhes: {
    chamadasNoMes: number;
    tetoMensal: number;
    orcamentoPesquisa?: number;
    chamadasFeitasPesquisa?: number;
  };
};

/**
 * Verifica se `unidades` chamadas podem ser feitas agora.
 * - Teto mensal: vale para TODA chamada, tendo ou nao searchId.
 * - Orcamento da pesquisa: so quando a chamada pertence a uma pesquisa.
 *
 * IMPORTANTE: esta funcao so LE. Quem incrementa os contadores e
 * `store.registrarConsumoPesquisa` (chamado depois, no orquestrador).
 */
export async function podeChamar(
  store: GuardaStore,
  alvo: { searchId?: string | null; unidades?: number },
  opts: { agora?: Date; config?: GuardaConfig } = {},
): Promise<VerdictoOrcamento> {
  const config = opts.config ?? carregarGuardaConfig();
  const agora = opts.agora ?? new Date();
  const unidades = alvo.unidades ?? 1;

  const chamadasNoMes = await totalChamadasNoMes(store, agora);
  const base = { chamadasNoMes, tetoMensal: config.tetoMensalChamadas };

  if (chamadasNoMes + unidades > config.tetoMensalChamadas) {
    return { permitido: false, motivo: "teto-mensal-atingido", detalhes: base };
  }

  if (alvo.searchId) {
    const orc = await store.lerOrcamentoPesquisa(alvo.searchId);
    if (!orc) {
      return { permitido: false, motivo: "pesquisa-nao-encontrada", detalhes: base };
    }
    const detalhes = {
      ...base,
      orcamentoPesquisa: orc.orcamento_chamadas,
      chamadasFeitasPesquisa: orc.chamadas_feitas,
    };
    if (orc.chamadas_feitas + unidades > orc.orcamento_chamadas) {
      return { permitido: false, motivo: "orcamento-da-pesquisa-esgotado", detalhes };
    }
    return { permitido: true, motivo: "ok", detalhes };
  }

  return { permitido: true, motivo: "ok", detalhes: base };
}
