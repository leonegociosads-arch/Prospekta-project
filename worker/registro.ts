// Registro de handlers: quais tipos de job o worker sabe processar.

import type { RegistroDeHandlers } from "./tipos";
import { handlerDescobrir } from "./handlers/descobrir";
import { handlerAnalisarSite } from "./handlers/analisar-site";
import { handlerCalcularScore } from "./handlers/calcular-score";
import { handlerAnalisarSocial } from "./handlers/analisar-social";
import { handlerDiagnosticarIa } from "./handlers/diagnosticar-ia";
import { handlerDetectarAds } from "./handlers/detectar-ads";

export const REGISTRO_PADRAO: RegistroDeHandlers = {
  descobrir: handlerDescobrir,
  analisar_site: handlerAnalisarSite,
  calcular_score: handlerCalcularScore,
  analisar_social: handlerAnalisarSocial,
  diagnosticar_ia: handlerDiagnosticarIa,
  detectar_ads: handlerDetectarAds,
};
