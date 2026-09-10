// Resumo do processamento de uma pesquisa: quantos leads ja tem score, boletim
// de site, presenca social e veredito de anuncio. Funcao pura - a pagina passa
// os leads ja carregados e o numero de jobs abertos.

import type { LeadEnriquecido } from "./tipos";

export type EtapaProgresso = { rotulo: string; feito: number; total: number };

export type ProgressoPesquisa = {
  etapas: EtapaProgresso[];
  naFila: number;
  /** true quando nada mais esta pendente (nem na fila, nem por fazer) */
  concluido: boolean;
};

function comSite(leads: LeadEnriquecido[]): number {
  return leads.filter((l) => (l.site_url ?? "").trim() !== "").length;
}

export function calcularProgressoPesquisa(
  leads: LeadEnriquecido[],
  naFila: number,
): ProgressoPesquisa {
  const total = leads.length;
  const sites = comSite(leads);

  const etapas: EtapaProgresso[] = [
    { rotulo: "Score", feito: leads.filter((l) => l.score != null).length, total },
    { rotulo: "Site", feito: leads.filter((l) => l.siteAnalisado).length, total: sites },
    { rotulo: "Redes sociais", feito: leads.filter((l) => l.socialAnalisado).length, total },
    {
      rotulo: "Indícios de anúncio",
      feito: leads.filter((l) => l.vereditoAnuncio != null).length,
      total: sites,
    },
  ];

  const faltando = etapas.some((e) => e.feito < e.total);
  return { etapas, naFila, concluido: naFila === 0 && !faltando };
}
