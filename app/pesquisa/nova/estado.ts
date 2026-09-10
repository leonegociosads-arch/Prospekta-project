// Tipos e valor inicial do formulario de nova pesquisa.
// Fica FORA do actions.ts porque um arquivo "use server" so pode exportar
// funcoes async - constantes/objetos como ESTADO_INICIAL quebram o build.

import type { CampoPesquisa } from "@/lib/pesquisa/validacao";

export type EstadoForm =
  | { status: "idle" }
  | { status: "erro-validacao"; erros: Partial<Record<CampoPesquisa, string>> }
  | { status: "erro-supabase"; mensagem: string }
  | { status: "ok"; searchId: string };

export const ESTADO_INICIAL: EstadoForm = { status: "idle" };
