// Converte a resposta crua do Place Details em algo estavel para a UI e o banco.
// Puro e defensivo: qualquer campo pode faltar.

import type { DetalhesNormalizados, ReviewNormalizada } from "./tipos";

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function textoLocalizado(v: unknown): string | null {
  if (v && typeof v === "object" && "text" in v) {
    return texto((v as { text?: unknown }).text);
  }
  return texto(v);
}

function normalizarReview(r: unknown): ReviewNormalizada | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const autor =
    o.authorAttribution && typeof o.authorAttribution === "object"
      ? texto((o.authorAttribution as { displayName?: unknown }).displayName)
      : null;
  const nota = numero(o.rating);
  const txt = textoLocalizado(o.text) ?? textoLocalizado(o.originalText);
  const quando = texto(o.relativePublishTimeDescription);
  const publicadoEm = texto(o.publishTime);
  if (!txt && nota == null) return null;
  return { autor, nota, texto: txt, quando, publicadoEm };
}

export function normalizarDetalhes(raw: unknown): DetalhesNormalizados {
  const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const horas =
    p.regularOpeningHours && typeof p.regularOpeningHours === "object"
      ? (p.regularOpeningHours as Record<string, unknown>)
      : {};
  const horarios = Array.isArray(horas.weekdayDescriptions)
    ? (horas.weekdayDescriptions as unknown[]).map((x) => texto(x)).filter((x): x is string => !!x)
    : [];
  const abertoAgora = typeof horas.openNow === "boolean" ? horas.openNow : null;

  const reviews = Array.isArray(p.reviews)
    ? (p.reviews as unknown[])
        .map(normalizarReview)
        .filter((r): r is ReviewNormalizada => r !== null)
        .slice(0, 5)
    : [];

  return {
    telefoneInternacional: texto(p.internationalPhoneNumber),
    telefoneNacional: texto(p.nationalPhoneNumber),
    siteUrl: texto(p.websiteUri),
    mapsUri: texto(p.googleMapsUri),
    horarios,
    abertoAgora,
    statusNegocio: texto(p.businessStatus),
    nota: numero(p.rating),
    qtdAvaliacoes: numero(p.userRatingCount),
    reviews,
  };
}
