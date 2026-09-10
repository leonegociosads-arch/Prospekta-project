// Tipos e valores iniciais das acoes da pagina do lead.
// Fica FORA do actions.ts porque um arquivo "use server" so pode exportar
// funcoes async - constantes/objetos como os ESTADO_*_INICIAL quebram o build.

import type { ResultadoAnaliseSite } from "@/lib/analise-site/tipos";
import type { ResultadoEnriquecimento } from "@/lib/enriquecimento/tipos";
import type { ResultadoAnaliseSocial } from "@/lib/analise-social/tipos";
import type { ResultadoDiagnostico } from "@/lib/ia/tipos";
import type { ResultadoDetecaoAds } from "@/lib/ads/tipos";

export type EstadoAnalise =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoAnaliseSite }
  | { status: "erro"; mensagem: string };

export const ESTADO_ANALISE_INICIAL: EstadoAnalise = { status: "idle" };

export type EstadoScore =
  | { status: "idle" }
  | { status: "ok"; total: number }
  | { status: "erro"; mensagem: string };

export const ESTADO_SCORE_INICIAL: EstadoScore = { status: "idle" };

export type EstadoEnriquecimento =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoEnriquecimento }
  | { status: "erro"; mensagem: string };

export const ESTADO_ENRIQUECIMENTO_INICIAL: EstadoEnriquecimento = { status: "idle" };

export type EstadoSocial =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoAnaliseSocial }
  | { status: "erro"; mensagem: string };

export const ESTADO_SOCIAL_INICIAL: EstadoSocial = { status: "idle" };

export type EstadoFavorito = { favorito: boolean; erro?: string };

export type EstadoAds =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoDetecaoAds }
  | { status: "erro"; mensagem: string };

export const ESTADO_ADS_INICIAL: EstadoAds = { status: "idle" };

export type EstadoDiagnostico =
  | { status: "idle" }
  | { status: "ok"; resultado: ResultadoDiagnostico }
  | { status: "erro"; mensagem: string };

export const ESTADO_DIAGNOSTICO_INICIAL: EstadoDiagnostico = { status: "idle" };
