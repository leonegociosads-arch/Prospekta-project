// Erros das chamadas ao Google, classificados para dar mensagem util
// e para o orquestrador decidir o que fazer.

export type TipoErroGoogle =
  | "http-400"
  | "chave-invalida"
  | "api-nao-ativada"
  | "http-403"
  | "http-429"
  | "http-5xx"
  | "timeout"
  | "resposta-inesperada"
  | "rede";

export class ErroGoogle extends Error {
  readonly tipo: TipoErroGoogle;
  readonly statusHttp?: number;
  constructor(tipo: TipoErroGoogle, mensagem: string, statusHttp?: number) {
    super(mensagem);
    this.name = "ErroGoogle";
    this.tipo = tipo;
    this.statusHttp = statusHttp;
  }
}

export function mensagemAmigavel(tipo: TipoErroGoogle): string {
  switch (tipo) {
    case "chave-invalida":
      return "A chave da API do Google parece invalida ou sem permissao. Confira no Google Cloud.";
    case "api-nao-ativada":
      return "Uma API do Google usada aqui nao esta ativada no seu projeto do Google Cloud.";
    case "http-403":
      return "O Google recusou a chamada (403). Pode ser cota diaria atingida ou restricao da chave.";
    case "http-429":
      return "Muitas chamadas em pouco tempo (429). Espere um pouco e tente de novo.";
    case "http-400":
      return "O Google recusou os parametros da busca (400).";
    case "http-5xx":
      return "O Google esta instavel (erro 5xx). Tente mais tarde.";
    case "timeout":
      return "A chamada ao Google demorou demais e foi cancelada.";
    case "resposta-inesperada":
      return "O Google respondeu num formato que nao esperavamos.";
    case "rede":
      return "Falha de rede ao falar com o Google.";
  }
}
