// Le sinais OBJETIVOS de uma pagina de perfil publica, so do que costuma vir
// em meta-tags og:* SEM login. Funcao PURA. Nao inventa nada (sem IA).

import { SINAIS_VAZIOS, type SinaisPerfil } from "./tipos";

function meta(html: string, prop: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  if (m?.[1]) return decodeHtml(m[1].trim());
  // ordem invertida (content antes de property)
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
    "i",
  );
  const m2 = html.match(re2);
  return m2?.[1] ? decodeHtml(m2[1].trim()) : null;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => codePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => codePoint(Number(d)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function codePoint(n: number): string {
  try {
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  } catch {
    return "";
  }
}

/** "1,234" | "12.345" | "1.2K" | "3,5 mil" | "1,2 mi" | "2.500" (pt-BR) -> numero. */
export function parseNumeroSocial(bruto: string): number | null {
  const s = bruto.trim().toLowerCase();
  // sufixos do mais longo para o mais curto (senao "m" ganha de "mil")
  const m = s.match(/([\d][\d.,]*)\s*(mil|mm|mi|bi|k|m|b)?(?![a-z])/);
  if (!m) return null;

  let numStr = m[1].replace(/[.,]$/, "");
  const suf = m[2];
  const temSuf = !!suf;
  const temVirg = numStr.includes(",");
  const temPonto = numStr.includes(".");

  if (temVirg && temPonto) {
    // o ultimo separador e o decimal
    numStr =
      numStr.lastIndexOf(",") > numStr.lastIndexOf(".")
        ? numStr.replace(/\./g, "").replace(",", ".")
        : numStr.replace(/,/g, "");
  } else if (temVirg) {
    numStr = /^\d{1,3}(,\d{3})+$/.test(numStr) ? numStr.replace(/,/g, "") : numStr.replace(",", ".");
  } else if (temPonto && !temSuf && /^\d{1,3}(\.\d{3})+$/.test(numStr)) {
    numStr = numStr.replace(/\./g, ""); // "12.345" -> milhares (pt-BR)
  }
  // "1.2k" (ponto + sufixo) fica como decimal

  const base = Number(numStr);
  if (!Number.isFinite(base)) return null;

  const mult =
    suf === "k" || suf === "mil" ? 1e3 :
    suf === "m" || suf === "mm" || suf === "mi" ? 1e6 :
    suf === "bi" || suf === "b" ? 1e9 :
    1;
  return Math.round(base * mult);
}

const RE_IG_CONTAGENS =
  /([\d][\d.,]*\s?[kmb]?)\s*(?:followers|seguidores)[\s\S]{0,25}?([\d][\d.,]*\s?[kmb]?)\s*(?:following|seguindo)[\s\S]{0,25}?([\d][\d.,]*\s?[kmb]?)\s*(?:posts|publica[çc][õo]es)/i;

export function extrairSinaisInstagram(html: string): SinaisPerfil {
  const h = html ?? "";
  const desc = meta(h, "og:description") ?? "";
  const out: SinaisPerfil = { ...SINAIS_VAZIOS };

  const c = desc.match(RE_IG_CONTAGENS);
  if (c) {
    out.seguidores = parseNumeroSocial(c[1]);
    out.posts = parseNumeroSocial(c[3]);
  }

  // bio: costuma vir depois de: `... on Instagram: "BIO"`  ou  `- Nome (@h): "BIO"`
  const bio =
    desc.match(/on instagram:\s*"([^"]{2,})"/i)?.[1] ??
    desc.match(/:\s*"([^"]{2,})"\s*$/)?.[1] ??
    null;
  if (bio) out.bio = bio.trim().slice(0, 500);

  // link externo: JSON embutido de contas comerciais, quando aparece
  const link =
    h.match(/"external_url":"(https?:\\?\/\\?\/[^"]+)"/i)?.[1]?.replace(/\\\//g, "/") ??
    h.match(/"bio_links":\[\{[^}]*"url":"(https?:\\?\/\\?\/[^"]+)"/i)?.[1]?.replace(/\\\//g, "/") ??
    null;
  if (link) out.linkExterno = link;

  return out;
}

export function extrairSinaisFacebook(html: string): SinaisPerfil {
  const h = html ?? "";
  const desc = meta(h, "og:description") ?? "";
  const out: SinaisPerfil = { ...SINAIS_VAZIOS };

  const seg =
    desc.match(/([\d.,]+[kmb]?)\s*(?:followers|seguidores|curtiram|likes|people like this|pessoas curtiram)/i)?.[1] ??
    h.match(/([\d.,]+[kmb]?)\s*(?:followers|seguidores)\b/i)?.[1] ??
    null;
  if (seg) out.seguidores = parseNumeroSocial(seg);

  // a descricao curta do FB as vezes e a propria bio da pagina
  if (desc && !/^\s*[\d.,]/.test(desc) && desc.length <= 300) {
    out.bio = desc.trim();
  }
  return out;
}
