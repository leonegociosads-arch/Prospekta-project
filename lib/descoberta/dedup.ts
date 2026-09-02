// Deduplicacao.
//
// Primaria: Google Place ID (feita direto no persistir.ts, contra a coluna
// unica leads.google_place_id).
//
// Secundaria (esta): chave por nome + endereco normalizados. Serve para
// fontes futuras sem Place ID e para nao duplicar o mesmo negocio vindo de
// fontes diferentes.

const MARCAS_ACENTO = /[\u0300-\u036f]/g;
const NAO_ALFANUM = /[^a-z0-9]+/g;

export function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(MARCAS_ACENTO, "")
    .replace(NAO_ALFANUM, " ")
    .trim();
}

export function chaveNomeEndereco(nome: string, endereco: string | null): string {
  return normalizarTexto(nome) + "|" + normalizarTexto(endereco ?? "");
}
