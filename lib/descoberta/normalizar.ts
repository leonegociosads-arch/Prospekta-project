// Converte um objeto "place" da Places API (New) em LeadDescoberto.
// Puro e defensivo: qualquer campo pode faltar ou vir com tipo errado.

import type { LeadDescoberto } from "@/lib/sources/types";

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

export function normalizarPlace(place: unknown): LeadDescoberto | null {
  if (!place || typeof place !== "object") return null;
  const p = place as Record<string, unknown>;

  const nome = textoLocalizado(p.displayName);
  if (!nome) return null; // sem nome nao serve como lead

  const placeId = texto(p.id);

  const loc =
    p.location && typeof p.location === "object" ? (p.location as Record<string, unknown>) : {};

  const categoria =
    textoLocalizado(p.primaryTypeDisplayName) ??
    texto(p.primaryType) ??
    (Array.isArray(p.types) ? texto(p.types[0]) : null);

  // Separa site "de verdade" de link de rede social
  let siteUrl = texto(p.websiteUri);
  let instagramUrl: string | null = null;
  let facebookUrl: string | null = null;
  if (siteUrl) {
    try {
      const host = new URL(siteUrl).hostname.replace(/^www\./, "").toLowerCase();
      if (host.endsWith("instagram.com")) {
        instagramUrl = siteUrl;
        siteUrl = null;
      } else if (host.endsWith("facebook.com") || host.endsWith("fb.com")) {
        facebookUrl = siteUrl;
        siteUrl = null;
      }
    } catch {
      // URL invalida: deixa como siteUrl mesmo
    }
  }

  return {
    fonte: "google_places",
    fonteRef: placeId,
    placeId,
    nome,
    categoria,
    endereco: texto(p.formattedAddress),
    lat: numero(loc.latitude),
    lng: numero(loc.longitude),
    telefone: texto(p.nationalPhoneNumber),
    siteUrl,
    instagramUrl,
    facebookUrl,
    avaliacao: numero(p.rating),
    qtdAvaliacoes: numero(p.userRatingCount),
    statusNegocio: texto(p.businessStatus),
    bruto: place,
  };
}
