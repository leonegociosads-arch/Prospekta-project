// Como mostrar situacao de site e veredito de anuncio como uma pastilha
// colorida. Compartilhado pela tabela de leads e pela pagina do lead - um
// so lugar decide a cor/rotulo de cada estado (etapa 21/23).

import type { SiteSituacao, VereditoAnuncioLead } from "./tipos";

export type TomPastilha = "ok" | "atencao" | "ruim" | "info" | "neutro" | "apagado";

export const SITE_PASTILHA: Record<SiteSituacao, { texto: string; tom: TomPastilha }> = {
  ok: { texto: "no ar", tom: "ok" },
  instavel: { texto: "instável", tom: "atencao" },
  "fora-do-ar": { texto: "fora do ar", tom: "ruim" },
  "nao-analisado": { texto: "checando…", tom: "apagado" },
  "sem-site": { texto: "sem site", tom: "neutro" },
};

/** Regra de ouro do projeto: nunca afirmamos "não anuncia". O máximo é
 *  "sem indício", e só quando de fato houve checagem (etapa 21). */
export function pastilhaAnuncio(
  veredito: VereditoAnuncioLead,
  adsAnalisado: boolean,
): { texto: string; tom: TomPastilha } {
  if (veredito === "forte") return { texto: "anuncia", tom: "ok" };
  if (veredito === "alguns") return { texto: "alguns indícios", tom: "atencao" };
  if (veredito === "nenhum") return { texto: "sem indício", tom: "neutro" };
  if (adsAnalisado) return { texto: "sem dados", tom: "apagado" };
  return { texto: "checando…", tom: "apagado" };
}
