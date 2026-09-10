// Geracao de CSV dos leads. Pura e testavel, sem biblioteca.
//
// Separador ";" e BOM UTF-8: e o formato que o Excel em portugues abre certo.
// Campos com ";", aspas ou quebra de linha sao colocados entre aspas (RFC 4180).

import type { LeadEnriquecido } from "./tipos";
import { FAIXA_SCORE_ALTO, FAIXA_SCORE_MEDIO } from "./filtros";

const BOM = "﻿";
const SEP = ";";

const COLUNAS: Array<{ titulo: string; valor: (l: LeadEnriquecido) => string | number | null }> = [
  { titulo: "nome", valor: (l) => l.nome },
  { titulo: "categoria", valor: (l) => l.categoria },
  { titulo: "endereco", valor: (l) => l.endereco },
  { titulo: "telefone", valor: (l) => l.telefone },
  { titulo: "site", valor: (l) => l.site_url },
  { titulo: "instagram", valor: (l) => l.instagram_url },
  { titulo: "facebook", valor: (l) => l.facebook_url },
  { titulo: "avaliacao", valor: (l) => l.avaliacao },
  { titulo: "qtd_avaliacoes", valor: (l) => l.qtd_avaliacoes },
  { titulo: "situacao", valor: (l) => l.status_negocio },
  { titulo: "score", valor: (l) => l.score },
  { titulo: "faixa_score", valor: (l) => faixa(l.score) },
  { titulo: "site_analisado", valor: (l) => (l.siteAnalisado ? "sim" : "nao") },
  { titulo: "situacao_site", valor: (l) => l.siteSituacao },
  { titulo: "tem_whatsapp", valor: (l) => (l.temWhatsapp == null ? "" : l.temWhatsapp ? "sim" : "nao") },
  { titulo: "tem_rede_social", valor: (l) => (l.temRedeSocial ? "sim" : "nao") },
  {
    titulo: "sinal_anuncio",
    valor: (l) => (l.temSinalAnuncio == null ? "" : l.temSinalAnuncio ? "sim" : "nao"),
  },
  { titulo: "veredito_anuncio", valor: (l) => l.vereditoAnuncio ?? "" },
  { titulo: "tem_diagnostico_ia", valor: (l) => (l.temDiagnostico ? "sim" : "nao") },
  { titulo: "favorito", valor: (l) => (l.favorito ? "sim" : "nao") },
  { titulo: "lead_id", valor: (l) => l.id },
];

function faixa(score: number | null): string {
  if (score == null) return "sem score";
  if (score >= FAIXA_SCORE_ALTO) return "alto";
  if (score >= FAIXA_SCORE_MEDIO) return "medio";
  return "baixo";
}

function celula(v: string | number | null): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(SEP) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function leadsParaCsv(leads: LeadEnriquecido[]): string {
  const linhas = [
    COLUNAS.map((c) => c.titulo).join(SEP),
    ...leads.map((l) => COLUNAS.map((c) => celula(c.valor(l))).join(SEP)),
  ];
  return BOM + linhas.join("\r\n") + "\r\n";
}

/** Nome de arquivo seguro a partir do nicho + regiao da pesquisa. */
export function nomeArquivoCsv(nicho: string, regiao: string): string {
  const base = `${nicho}-${regiao}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const data = new Date().toISOString().slice(0, 10);
  return `prospekta-${base || "leads"}-${data}.csv`;
}
