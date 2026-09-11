// Tipos do diagnostico comercial com IA (etapa 14).
//
// A IA le um DOSSIE estruturado (EntradaDiagnostico) montado a partir do que o
// Prospekta ja coletou por codigo (lead + score + boletim de site + enriquecimento
// + presenca social) e devolve um DiagnosticoIa com saida estruturada.

export type ConfiancaIa = "alta" | "media" | "baixa";

/** "nao_avaliado" = o dado NAO foi coletado (diferente de "nao existe"). */
export type Desconhecido = "nao_avaliado";
export type Talvez<T> = T | Desconhecido;

export const NAO_AVALIADO: Desconhecido = "nao_avaliado";

export type EntradaEmpresa = {
  nome: string;
  categoria: Talvez<string>;
  endereco: Talvez<string>;
  telefone: Talvez<string>;
  situacao: Talvez<string>; // status_negocio do Google (OPERATIONAL, CLOSED_*, ...)
  avaliacao_media: Talvez<number>;
  qtd_avaliacoes: Talvez<number>;
  site: Talvez<string>;
  instagram: Talvez<string>;
  facebook: Talvez<string>;
  horarios: Talvez<string[]>;
};

export type EntradaScore =
  | {
      total: number;
      confianca: string;
      fatores: Array<{ rotulo: string; pontos: number; peso: number; motivo: string }>;
      ajustes_aplicados: string[];
    }
  | Desconhecido;

export type EntradaSite =
  | {
      responde: Talvez<boolean>;
      https_valido: Talvez<boolean>;
      adaptado_celular: Talvez<boolean>;
      nota_mobile: Talvez<number>;
      nota_desempenho: Talvez<number>;
      tem_whatsapp: Talvez<boolean>;
      tem_telefone: Talvez<boolean>;
      tem_formulario: Talvez<boolean>;
      tem_cta: Talvez<boolean>;
      tem_pagina_contato: Talvez<boolean>;
      tem_meta_pixel: Talvez<boolean>;
      tem_google_analytics: Talvez<boolean>;
      tem_tag_manager: Talvez<boolean>;
      tem_tag_google_ads: Talvez<boolean>;
      tem_remarketing_doubleclick: Talvez<boolean>;
      erro_ao_analisar: string | null;
      /** meta description + trecho de texto visivel da home (etapa 22) - da pro
       *  modelo ler do que a empresa fala, nao so sinais sim/nao. */
      resumo_textual: Talvez<string>;
    }
  | Desconhecido;

export type EntradaSocial =
  | Array<{
      plataforma: string;
      status: string; // encontrado | nao_encontrado | desconhecido | sem_link
      seguidores: Talvez<number>;
    }>
  | Desconhecido;

export type EntradaReviews =
  | Array<{ nota: number | null; texto: string }>
  | Desconhecido;

export type EntradaDiagnostico = {
  empresa: EntradaEmpresa;
  score: EntradaScore;
  site: EntradaSite;
  presenca_social: EntradaSocial;
  avaliacoes_recentes: EntradaReviews;
};

/** Um argumento de venda: sempre amarrado a UM dado real do dossie (nunca solto). */
export type Gatilho = {
  titulo: string;
  descricao: string;
  /** o dado do JSON de onde esse gatilho saiu - pra nunca virar afirmacao vazia */
  fonte: string;
};

export type PropostaComercial = {
  servico: string;
  escopo: string;
  /** por que ESSE servico e nao outro, pra ESSE lead */
  justificativa: string;
};

export type EstrategiaAbordagem = {
  canal: string;
  melhorHorario: string;
  gatilhos: Gatilho[];
};

export type Objecao = {
  pergunta: string;
  resposta: string;
};

/** Saida estruturada do dossie comercial completo (etapa 22).
 *  Continua com a mesma regra de ouro da etapa 14: so fatos do JSON de entrada,
 *  nunca preco/numero/prova inventados. */
export type DiagnosticoIa = {
  resumo: string;
  pontosFortes: string[];
  pontosFracos: string[];
  proposta: PropostaComercial;
  estrategia: EstrategiaAbordagem;
  /** rascunho de 1a mensagem - sempre pra revisar antes de mandar, nunca automatico */
  mensagemInicial: string;
  objecoes: Objecao[];
  confianca: ConfiancaIa;
  fatosUtilizados: string[];
};

export type StatusDiagnostico =
  | "gerado" // chamou o modelo e gravou
  | "cache" // reaproveitou diagnostico valido (nenhuma chamada)
  | "lead-nao-encontrado"
  | "sem-score" // IA so roda depois do score
  | "nao-elegivel" // score abaixo do limite e fora do top N
  | "erro-modelo"; // o modelo respondeu, mas nao deu para aproveitar (gravado com erro)

export type ResultadoDiagnostico = {
  status: StatusDiagnostico;
  leadId: string;
  modelo: string | null;
  versaoPrompt: string | null;
  fonte: "modelo" | "cache" | null;
  diagnostico: DiagnosticoIa | null;
  tokensEntrada: number | null;
  tokensSaida: number | null;
  custoUsd: number;
  erro: string | null;
};
