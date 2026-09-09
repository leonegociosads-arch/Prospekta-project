// Busca, filtro e ordenacao da lista de leads. PURO e testavel - roda no
// cliente (a pesquisa tem no maximo ~20 leads, entao e tudo em memoria).

import type { LeadEnriquecido } from "./tipos";

export type FaixaScore = "todos" | "alto" | "medio" | "baixo" | "sem";
export type FiltroTriplo = "todos" | "com" | "sem";
export type Ordenacao = "score" | "avaliacoes" | "nome" | "recentes";

export type CriteriosLeads = {
  busca: string;
  faixaScore: FaixaScore;
  site: FiltroTriplo;
  anuncio: FiltroTriplo;
  soFavoritos: boolean;
  ordenar: Ordenacao;
};

export const CRITERIOS_PADRAO: CriteriosLeads = {
  busca: "",
  faixaScore: "todos",
  site: "todos",
  anuncio: "todos",
  soFavoritos: false,
  ordenar: "score",
};

export const FAIXA_SCORE_ALTO = 70;
export const FAIXA_SCORE_MEDIO = 40;

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function casaBusca(lead: LeadEnriquecido, termo: string): boolean {
  const t = normalizar(termo.trim());
  if (!t) return true;
  const alvo = normalizar(
    [lead.nome, lead.categoria, lead.endereco, lead.telefone].filter(Boolean).join(" "),
  );
  return t.split(/\s+/).every((parte) => alvo.includes(parte));
}

function casaFaixaScore(lead: LeadEnriquecido, faixa: FaixaScore): boolean {
  if (faixa === "todos") return true;
  if (faixa === "sem") return lead.score == null;
  if (lead.score == null) return false;
  if (faixa === "alto") return lead.score >= FAIXA_SCORE_ALTO;
  if (faixa === "medio") return lead.score >= FAIXA_SCORE_MEDIO && lead.score < FAIXA_SCORE_ALTO;
  return lead.score < FAIXA_SCORE_MEDIO; // baixo
}

// "com site" = tem URL cadastrada; "sem site" = nao tem
function casaSite(lead: LeadEnriquecido, filtro: FiltroTriplo): boolean {
  if (filtro === "todos") return true;
  const tem = (lead.site_url ?? "").trim() !== "";
  return filtro === "com" ? tem : !tem;
}

// "com anuncio" = tag detectada; "sem" = site analisado e sem tag; "todos" ignora
function casaAnuncio(lead: LeadEnriquecido, filtro: FiltroTriplo): boolean {
  if (filtro === "todos") return true;
  if (filtro === "com") return lead.temSinalAnuncio === true;
  return lead.temSinalAnuncio === false; // exclui o desconhecido (null)
}

export function contarFiltrosAtivos(c: CriteriosLeads): number {
  let n = 0;
  if (c.busca.trim()) n++;
  if (c.faixaScore !== "todos") n++;
  if (c.site !== "todos") n++;
  if (c.anuncio !== "todos") n++;
  if (c.soFavoritos) n++;
  return n;
}

export function ordenarLeads(leads: LeadEnriquecido[], ordenar: Ordenacao): LeadEnriquecido[] {
  const arr = [...leads];
  if (ordenar === "nome") {
    return arr.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }
  if (ordenar === "recentes") {
    return arr.sort((a, b) => (b.criado_em > a.criado_em ? 1 : b.criado_em < a.criado_em ? -1 : 0));
  }
  if (ordenar === "avaliacoes") {
    return arr.sort((a, b) => (b.qtd_avaliacoes ?? 0) - (a.qtd_avaliacoes ?? 0));
  }
  // score: maior primeiro; sem score no fim; empate -> mais avaliacoes
  return arr.sort((a, b) => {
    if (a.score != null && b.score != null && a.score !== b.score) return b.score - a.score;
    if (a.score != null && b.score == null) return -1;
    if (a.score == null && b.score != null) return 1;
    return (b.qtd_avaliacoes ?? 0) - (a.qtd_avaliacoes ?? 0);
  });
}

export function aplicarCriterios(leads: LeadEnriquecido[], c: CriteriosLeads): LeadEnriquecido[] {
  const filtrados = leads.filter(
    (l) =>
      casaBusca(l, c.busca) &&
      casaFaixaScore(l, c.faixaScore) &&
      casaSite(l, c.site) &&
      casaAnuncio(l, c.anuncio) &&
      (!c.soFavoritos || l.favorito),
  );
  return ordenarLeads(filtrados, c.ordenar);
}
