// Extrai links de rede social do HTML de um site. Funcao PURA.
// So aceita URLs que parecem de PERFIL/PAGINA (nao de post, share, plugin...).

import type { RedesEncontradas } from "./tipos";

const IG_HANDLE = /^[A-Za-z0-9._]{1,30}$/;
const IG_NAO_PERFIL = new Set([
  "p", "reel", "reels", "explore", "accounts", "about", "developer", "directory",
  "legal", "privacy", "tv", "stories", "share", "web", "graphql", "api", "s",
]);
const FB_NAO_PERFIL = new Set([
  "sharer", "sharer.php", "share.php", "plugins", "tr", "tr.php", "dialog", "l.php",
  "permalink.php", "story.php", "photo.php", "photo", "events", "watch", "gaming",
  "marketplace", "login", "login.php", "recover", "help", "policies", "terms",
  "business", "ads", "groups", "hashtag", "media", "pages",
]);

function coletarUrls(html: string, host: RegExp): string[] {
  const achados = new Set<string>();
  const re = new RegExp(
    `https?:\\/\\/(?:[a-z0-9-]+\\.)?${host.source}\\/[^\\s"'<>)]*`,
    "gi",
  );
  for (const m of html.matchAll(re)) {
    achados.add(m[0].replace(/[.,;)\]]+$/, ""));
  }
  return [...achados];
}

export function normalizarUrlInstagram(bruta: string): string | null {
  let u: URL;
  try {
    u = new URL(bruta);
  } catch {
    return null;
  }
  if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null;
  const partes = u.pathname.split("/").filter(Boolean);
  if (partes.length === 0) return null;
  const handle = partes[0].toLowerCase();
  if (IG_NAO_PERFIL.has(handle)) return null;
  if (!IG_HANDLE.test(partes[0])) return null;
  return `https://www.instagram.com/${partes[0]}/`;
}

export function normalizarUrlFacebook(bruta: string): string | null {
  let u: URL;
  try {
    u = new URL(bruta);
  } catch {
    return null;
  }
  if (!/(^|\.)facebook\.com$/i.test(u.hostname) && !/(^|\.)fb\.com$/i.test(u.hostname)) {
    return null;
  }
  const partes = u.pathname.split("/").filter(Boolean);

  // facebook.com/profile.php?id=123  ou  facebook.com/people/Nome/123
  if (partes[0] === "profile.php") {
    const id = u.searchParams.get("id");
    return id && /^\d+$/.test(id) ? `https://www.facebook.com/profile.php?id=${id}` : null;
  }
  if (partes[0] === "people" && partes.length >= 2) {
    return `https://www.facebook.com/${partes.slice(0, 3).join("/")}`;
  }
  if (partes.length === 0) return null;
  const slug = partes[0].toLowerCase();
  if (FB_NAO_PERFIL.has(slug)) return null;
  if (!/^[A-Za-z0-9.\-]{2,}$/.test(partes[0])) return null;
  return `https://www.facebook.com/${partes[0]}`;
}

/** Escolhe a URL que mais aparece (mais provavel de ser a "oficial"). */
function maisFrequente(urls: string[]): string | null {
  if (urls.length === 0) return null;
  const cont = new Map<string, number>();
  for (const u of urls) cont.set(u, (cont.get(u) ?? 0) + 1);
  return [...cont.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function extrairRedesDoHtml(html: string): RedesEncontradas {
  const h = html ?? "";

  const ig = coletarUrls(h, /instagram\.com/)
    .map(normalizarUrlInstagram)
    .filter((x): x is string => !!x);
  const fb = coletarUrls(h, /(?:facebook|fb)\.com/)
    .map(normalizarUrlFacebook)
    .filter((x): x is string => !!x);

  const outras: string[] = [];
  for (const [nome, re] of [
    ["linkedin", /https?:\/\/(?:[a-z]+\.)?linkedin\.com\/(?:company|in|school)\/[^\s"'<>)]+/gi],
    ["youtube", /https?:\/\/(?:www\.)?youtube\.com\/(?:@|c\/|channel\/|user\/)[^\s"'<>)]+/gi],
    ["tiktok", /https?:\/\/(?:www\.)?tiktok\.com\/@[^\s"'<>)]+/gi],
  ] as const) {
    const m = h.match(re);
    if (m) outras.push(`${nome}: ${m[0].replace(/[.,;)\]]+$/, "")}`);
  }

  return {
    instagram: maisFrequente(ig),
    facebook: maisFrequente(fb),
    outras: [...new Set(outras)],
  };
}
