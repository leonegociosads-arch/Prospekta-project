// Validacao dos campos da tela "nova pesquisa". Pura e testavel.
// Rejeita valores invalidos com mensagem - nao "corrige" escondido.

import { LIMITES } from "./estimativa";

export type CampoPesquisa = "regiao" | "nicho" | "raioKm" | "limiteLeads";

export type ValoresNovaPesquisa = {
  regiao: string;
  nicho: string;
  raioKm: number;
  limiteLeads: number;
};

export type ResultadoValidacao =
  | { ok: true; valores: ValoresNovaPesquisa }
  | { ok: false; erros: Partial<Record<CampoPesquisa, string>> };

export function validarNovaPesquisa(entrada: {
  regiao?: unknown;
  nicho?: unknown;
  raioKm?: unknown;
  limiteLeads?: unknown;
}): ResultadoValidacao {
  const erros: Partial<Record<CampoPesquisa, string>> = {};

  const regiao = String(entrada.regiao ?? "").trim();
  if (regiao.length < 2) erros.regiao = "Informe a regiao. Ex.: Iguape, SP";
  else if (regiao.length > 120) erros.regiao = "Regiao muito longa (max. 120 caracteres).";

  const nicho = String(entrada.nicho ?? "").trim();
  if (nicho.length < 2) erros.nicho = "Informe o nicho. Ex.: dentistas";
  else if (nicho.length > 60) erros.nicho = "Nicho muito longo (max. 60 caracteres).";

  const raioKm = Number(entrada.raioKm);
  if (!Number.isFinite(raioKm) || raioKm < LIMITES.raioMinKm || raioKm > LIMITES.raioMaxKm) {
    erros.raioKm = `Raio deve ser um numero entre ${LIMITES.raioMinKm} e ${LIMITES.raioMaxKm} km.`;
  }

  const limiteLeads = Math.trunc(Number(entrada.limiteLeads));
  if (
    !Number.isInteger(limiteLeads) ||
    limiteLeads < LIMITES.leadsMin ||
    limiteLeads > LIMITES.leadsMax
  ) {
    erros.limiteLeads = `Limite deve ser um numero inteiro entre ${LIMITES.leadsMin} e ${LIMITES.leadsMax}.`;
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, valores: { regiao, nicho, raioKm, limiteLeads } };
}
