// Erros das chamadas ao modelo de IA, classificados como os do Google
// (lib/descoberta/erros.ts). O worker usa `.tipo` para decidir se vale retry.

export type TipoErroIa =
  | "chave-invalida" // chave errada / sem permissao / projeto sem a API -> retry NAO ajuda
  | "http-403"
  | "http-429" // rate limit -> retry ajuda
  | "http-5xx" // instabilidade -> retry ajuda
  | "timeout"
  | "conteudo-bloqueado" // o provedor recusou gerar (safety) -> retry raramente ajuda
  | "resposta-inesperada"
  | "rede";

export class ErroIa extends Error {
  readonly tipo: TipoErroIa;
  readonly statusHttp?: number;
  constructor(tipo: TipoErroIa, mensagem: string, statusHttp?: number) {
    super(mensagem);
    this.name = "ErroIa";
    this.tipo = tipo;
    this.statusHttp = statusHttp;
  }
}

/** true quando repetir a chamada mais tarde tem chance real de dar certo. */
export function vaLePenaRetentarIa(tipo: TipoErroIa): boolean {
  return tipo === "http-429" || tipo === "http-5xx" || tipo === "timeout" || tipo === "rede";
}

export function mensagemAmigavelIa(tipo: TipoErroIa): string {
  switch (tipo) {
    case "chave-invalida":
      return "A chave da API de IA parece invalida, sem permissao ou o modelo nao esta habilitado.";
    case "http-403":
      return "O provedor de IA recusou a chamada (403). Verifique cota e permissoes da chave.";
    case "http-429":
      return "Muitas chamadas de IA em pouco tempo (429). Espere e tente de novo.";
    case "http-5xx":
      return "O provedor de IA esta instavel (erro 5xx). Tente mais tarde.";
    case "timeout":
      return "A chamada de IA demorou demais e foi cancelada.";
    case "conteudo-bloqueado":
      return "O provedor de IA se recusou a gerar uma resposta para este conteudo.";
    case "resposta-inesperada":
      return "O provedor de IA respondeu num formato que nao esperavamos.";
    case "rede":
      return "Falha de rede ao falar com o provedor de IA.";
  }
}
