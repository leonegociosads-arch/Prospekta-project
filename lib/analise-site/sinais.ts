// Extrai sinais tecnicos do HTML de uma pagina. Funcao PURA (string -> objeto),
// sem rede. Deteccao por regex/substring — simples e explicavel, sem IA.

import type { SinaisSite } from "./tipos";
import { extrairRedesDoHtml } from "@/lib/analise-social/extrair-redes";

type Regra = { chave: string; padroes: RegExp[] };

function achou(html: string, padroes: RegExp[]): string[] {
  const hits: string[] = [];
  for (const p of padroes) {
    const m = html.match(p);
    if (m) hits.push(m[0].slice(0, 120));
  }
  return hits;
}

// --- analytics / ads / pixels ---
const REGRAS_TAGS: Regra[] = [
  {
    chave: "metaPixel",
    padroes: [/connect\.facebook\.net\/[^"']*fbevents\.js/i, /fbq\s*\(\s*['"]init['"]/i, /_fbq\b/i],
  },
  {
    chave: "ga",
    padroes: [
      /googletagmanager\.com\/gtag\/js/i,
      /gtag\s*\(\s*['"]config['"]\s*,\s*['"](?:G|UA|AW)-/i,
      /google-analytics\.com\/(?:analytics|ga)\.js/i,
      /ga\s*\(\s*['"]create['"]/i,
    ],
  },
  {
    chave: "gtm",
    padroes: [/googletagmanager\.com\/gtm\.js/i, /GTM-[A-Z0-9]{4,}/],
  },
  {
    chave: "googleAds",
    padroes: [
      /googleadservices\.com/i,
      /gtag\s*\(\s*['"]config['"]\s*,\s*['"]AW-/i,
      /google_conversion_id/i,
      /\/pagead\/conversion/i,
    ],
  },
  {
    chave: "doubleclick",
    padroes: [
      /doubleclick\.net/i,
      /googlesyndication\.com/i,
      /google_remarketing_only/i,
      /stats\.g\.doubleclick\.net/i,
    ],
  },
];

// --- stack ---
const REGRAS_STACK: Regra[] = [
  { chave: "WordPress", padroes: [/wp-content\//i, /wp-includes\//i, /\/wp-json\//i] },
  { chave: "Elementor", padroes: [/elementor-(?:page|widget|frontend)/i, /"elementor/i] },
  { chave: "Wix", padroes: [/static\.parastorage\.com/i, /_wixCssState/i, /wix\.com/i] },
  { chave: "Squarespace", padroes: [/static1\.squarespace\.com/i, /squarespace\.com/i] },
  { chave: "Shopify", padroes: [/cdn\.shopify\.com/i, /Shopify\.theme/i, /myshopify\.com/i] },
  { chave: "Webflow", padroes: [/\.webflow\.io/i, /data-wf-(?:page|site)/i] },
  { chave: "Next.js", padroes: [/id="__next"/i, /\/_next\/static\//i, /__NEXT_DATA__/] },
  { chave: "Nuxt", padroes: [/id="__nuxt"/i, /window\.__NUXT__/] },
  { chave: "React", padroes: [/data-reactroot/i, /react(?:-dom)?(?:\.production)?\.min\.js/i] },
  { chave: "jQuery", padroes: [/jquery(?:-|\.)(?:\d|min)/i] },
  { chave: "Bootstrap", padroes: [/bootstrap(?:\.min)?\.(?:css|js)/i] },
  { chave: "RD Station", padroes: [/rdstation|d335luupugsy2\.cloudfront\.net/i] },
  { chave: "Google Sites", padroes: [/sites\.google\.com/i, /gstatic\.com\/atari/i] },
  { chave: "GoDaddy Website Builder", padroes: [/img1\.wsimg\.com/i] },
];

function primeiroGrupo(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m && m[1] ? m[1].trim().replace(/\s+/g, " ").slice(0, 200) : null;
}

const MAX_RESUMO_TEXTUAL = 900;

/** Meta description + um trecho do texto visivel da home, para o dossie da IA
 *  (etapa 22). PURO, sem biblioteca de parsing HTML - so regex, no mesmo
 *  estilo do resto do arquivo. Nao e "scraping" de dado privado: e so o texto
 *  publico que qualquer visitante ve na pagina. */
function extrairResumoTextual(html: string): string | null {
  const descricao = primeiroGrupo(
    html,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,400})["']/i,
  );

  const semLixo = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const textoVisivel = semLixo
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&(?:ldquo|rdquo|quot);/gi, '"')
    .replace(/&(?:lsquo|rsquo|apos);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

  const partes = [descricao, textoVisivel].filter((t): t is string => !!t && t.length > 0);
  if (partes.length === 0) return null;
  const texto = partes.join(" — ").slice(0, MAX_RESUMO_TEXTUAL).trim();
  return texto.length > 0 ? texto : null;
}

export function extrairSinais(
  html: string,
  urlFinal: string,
  headers: Record<string, string> = {},
): SinaisSite {
  const h = html ?? "";
  const evidencias: Record<string, string[]> = {};
  const marcar = (chave: string, hits: string[]) => {
    if (hits.length) evidencias[chave] = hits;
    return hits.length > 0;
  };

  // viewport / responsividade
  const viewportTag = h.match(/<meta[^>]+name=["']viewport["'][^>]*>/i)?.[0] ?? "";
  const temViewport = viewportTag !== "";
  const viewportDeviceWidth = /width\s*=\s*device-width/i.test(viewportTag);
  if (temViewport) evidencias.viewport = [viewportTag.slice(0, 120)];

  const mediaQueries = /@media[^{]*\((?:max|min)-width/i.test(h);
  const srcset = /<img[^>]+srcset=/i.test(h) || /<source[^>]+srcset=/i.test(h);
  const larguraFixaSuspeita =
    /<meta[^>]+name=["']viewport["'][^>]*width\s*=\s*\d{3,}/i.test(h) ||
    /<body[^>]+style=["'][^"']*width\s*:\s*\d{3,}px/i.test(h);

  // contato
  const temWhatsapp = marcar("whatsapp", achou(h, [
    /wa\.me\/\d/i,
    /api\.whatsapp\.com\/send/i,
    /chat\.whatsapp\.com\//i,
    /whatsapp:\/\//i,
    /href=["'][^"']*whatsapp[^"']*["']/i,
  ]));
  const temTelefone = marcar("telefone", achou(h, [
    /href=["']tel:\+?[\d\s()-]{6,}["']/i,
    /\(\d{2}\)\s?\d{4,5}-?\d{4}/,
  ]));
  const temFormulario = marcar("formulario", achou(h, [
    /<form[\s>]/i,
    /typeform\.com|docs\.google\.com\/forms|jotform|wufoo|rdstation/i,
  ]));
  const temCta = marcar("cta", achou(h, [
    /<button[\s>]/i,
    /\b(fale conosco|faça um orçamento|solicite (?:um |uma )?(?:orçamento|proposta|contato)|peça (?:um |seu )?orçamento|agende|agendar|entre em contato|compre agora|assine|cadastre-se)\b/i,
  ]));
  const temPaginaContato = marcar("paginaContato", achou(h, [
    /href=["'][^"']*(?:\/contato|\/contact|\/fale-conosco|\/fale_conosco)[^"']*["']/i,
  ]));

  // tags
  const temMetaPixel = marcar("metaPixel", achou(h, REGRAS_TAGS[0].padroes));
  const temGa = marcar("ga", achou(h, REGRAS_TAGS[1].padroes));
  const temGtm = marcar("gtm", achou(h, REGRAS_TAGS[2].padroes));
  const temGoogleAds = marcar("googleAds", achou(h, REGRAS_TAGS[3].padroes));
  const temDoubleclick = marcar("doubleclick", achou(h, REGRAS_TAGS[4].padroes));

  // parametros de campanha nos proprios links (utm_*) -> a empresa marca as
  // proprias campanhas. Sinal fraco de que faz trafego pago (etapa 12).
  marcar("parametrosCampanha", achou(h, [
    /href=["'][^"']*[?&]utm_(?:source|medium|campaign)=[^"'\s]+/i,
  ]));

  // stack
  const stack: string[] = [];
  for (const regra of REGRAS_STACK) {
    const hits = achou(h, regra.padroes);
    if (hits.length) {
      stack.push(regra.chave);
      evidencias[`stack:${regra.chave}`] = hits;
    }
  }
  const gerador = primeiroGrupo(h, /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i);
  if (gerador && !stack.some((s) => gerador.toLowerCase().includes(s.toLowerCase()))) {
    stack.push(gerador);
  }

  const titulo = primeiroGrupo(h, /<title[^>]*>([^<]{1,300})<\/title>/i);
  const servidor = headers["server"] ?? headers["x-powered-by"] ?? null;
  const redesSociais = extrairRedesDoHtml(h);
  const resumoTextual = extrairResumoTextual(h);
  void urlFinal;

  return {
    temViewport,
    viewportDeviceWidth,
    responsividade: { mediaQueries, srcset, larguraFixaSuspeita },
    temWhatsapp,
    temTelefone,
    temFormulario,
    temCta,
    temPaginaContato,
    temMetaPixel,
    temGa,
    temGtm,
    temGoogleAds,
    temDoubleclick,
    stack,
    titulo,
    servidor,
    redesSociais,
    evidencias,
    resumoTextual,
  };
}

/** Heuristica 0-100 de "amigavel para celular", so com sinais de codigo. */
export function notaMobile(s: SinaisSite): number {
  let n = 0;
  if (s.temViewport) n += 45;
  if (s.viewportDeviceWidth) n += 25;
  if (s.responsividade.mediaQueries) n += 20;
  if (s.responsividade.srcset) n += 10;
  if (s.responsividade.larguraFixaSuspeita) n -= 30;
  return Math.max(0, Math.min(100, n));
}
