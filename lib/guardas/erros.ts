// Erros das guardas de custo. Sao classes proprias para o codigo que chama
// conseguir distinguir "bloqueado pelo orcamento" de "falha ao registrar" etc.

/** A chamada foi bloqueada por uma guarda de orcamento (teto mensal ou orcamento da pesquisa). */
export class ErroDeOrcamento extends Error {
  readonly motivo: string;
  constructor(motivo: string) {
    super(`Chamada externa bloqueada pela guarda de orcamento: ${motivo}`);
    this.name = "ErroDeOrcamento";
    this.motivo = motivo;
  }
}

/** Falhou ao gravar o registro de consumo em api_usage. Nunca deve ser engolido. */
export class ErroDeRegistroDeUso extends Error {
  readonly causa: unknown;
  constructor(causa: unknown) {
    const detalhe = causa instanceof Error ? causa.message : String(causa);
    super(`Falha ao registrar o consumo em api_usage: ${detalhe}`);
    this.name = "ErroDeRegistroDeUso";
    this.causa = causa;
  }
}
