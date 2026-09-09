// Baixa a home de um site, com todas as travas:
//  - timeout (AbortController);
//  - limite de tamanho (le o corpo em pedacos, para em maxBytes);
//  - redirects manuais, no maximo maxRedirects, cada salto revalidado (SSRF);
//  - captura erro de TLS/certificado;
//  - so processa corpo HTML.

import { ErroSSRF, validarUrlPublica, type ResolvedorDns } from "./ssrf";
import type { RespostaSite } from "./tipos";

const UA =
  "ProspektaBot/1.0 (analise tecnica de site; +uso pessoal)";

const CODIGOS_TLS =
  /CERT|TLS|SSL|SELF_SIGNED|ALTNAME|UNABLE_TO_VERIFY|DEPTH_ZERO|HOSTNAME/i;

function ehErroTls(e: unknown): string | null {
  const err = e as { code?: string; cause?: { code?: string; message?: string }; message?: string };
  const code = err?.code ?? err?.cause?.code;
  const msg = err?.message ?? err?.cause?.message ?? "";
  if ((code && CODIGOS_TLS.test(code)) || CODIGOS_TLS.test(msg)) {
    return code ? `${code}` : msg.slice(0, 200);
  }
  return null;
}

export type OpcoesBaixar = {
  fetchImpl?: typeof fetch;
  resolver?: ResolvedorDns;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

export async function baixarPagina(
  urlBruta: string,
  opts: OpcoesBaixar = {},
): Promise<RespostaSite> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024; // 2 MB
  const maxRedirects = opts.maxRedirects ?? 5;

  const base: RespostaSite = {
    respondeu: false,
    status: null,
    urlFinal: urlBruta,
    redirects: 0,
    html: "",
    contentType: null,
    tamanhoBytes: 0,
    truncado: false,
    tlsOk: true,
    tlsErro: null,
    ttfbMs: null,
    headers: {},
    erro: null,
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const t0 = Date.now();

  try {
    let alvo = urlBruta;
    let redirects = 0;

    while (true) {
      // valida ANTES de cada requisicao (inclusive cada salto de redirect)
      let seguro;
      try {
        seguro = await validarUrlPublica(alvo, { resolver: opts.resolver });
      } catch (e) {
        if (e instanceof ErroSSRF) {
          base.erro = `bloqueado por seguranca: ${e.motivo}`;
          base.urlFinal = alvo;
          base.redirects = redirects;
          return base;
        }
        throw e;
      }

      let resp: Response;
      try {
        resp = await fetchImpl(seguro.url.toString(), {
          method: "GET",
          redirect: "manual",
          signal: ac.signal,
          headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
        });
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          base.erro = "timeout ao acessar o site";
        } else {
          const tls = ehErroTls(e);
          if (tls) {
            base.tlsOk = false;
            base.tlsErro = tls;
            base.erro = `erro de TLS/certificado: ${tls}`;
          } else {
            base.erro = `falha de rede: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
        base.urlFinal = alvo;
        base.redirects = redirects;
        return base;
      }

      base.status = resp.status;
      base.urlFinal = seguro.url.toString();
      base.redirects = redirects;
      if (base.ttfbMs === null) base.ttfbMs = Date.now() - t0;

      // redirect?
      if (resp.status >= 300 && resp.status < 400 && resp.headers.get("location")) {
        if (redirects >= maxRedirects) {
          base.erro = `redirects demais (> ${maxRedirects})`;
          return base;
        }
        const loc = resp.headers.get("location")!;
        alvo = new URL(loc, seguro.url).toString();
        redirects += 1;
        continue;
      }

      // resposta final
      base.respondeu = true;
      resp.headers.forEach((v, k) => {
        base.headers[k.toLowerCase()] = v;
      });
      base.contentType = resp.headers.get("content-type");

      const declarado = Number(resp.headers.get("content-length") ?? "");
      if (Number.isFinite(declarado) && declarado > maxBytes) {
        base.erro = `resposta grande demais (content-length ${declarado} > ${maxBytes})`;
        base.tamanhoBytes = declarado;
        base.truncado = true;
        try {
          await resp.body?.cancel();
        } catch {
          /* ignora */
        }
        return base;
      }

      const ehHtml =
        !base.contentType || /text\/html|application\/xhtml/i.test(base.contentType);

      const { texto, bytes, truncado } = await lerLimitado(resp, maxBytes);
      base.tamanhoBytes = bytes;
      base.truncado = truncado;
      base.html = ehHtml ? texto : "";
      if (!ehHtml) {
        base.erro = `conteudo nao e HTML (${base.contentType})`;
      }
      return base;
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Le o corpo em pedacos e para ao atingir maxBytes. */
async function lerLimitado(
  resp: Response,
  maxBytes: number,
): Promise<{ texto: string; bytes: number; truncado: boolean }> {
  const reader = resp.body?.getReader?.();
  if (!reader) {
    // fetch fake sem stream: cai no text() e trunca
    const t = await resp.text();
    const buf = Buffer.from(t, "utf8");
    if (buf.byteLength > maxBytes) {
      return { texto: buf.subarray(0, maxBytes).toString("utf8"), bytes: buf.byteLength, truncado: true };
    }
    return { texto: t, bytes: buf.byteLength, truncado: false };
  }

  const pedacos: Uint8Array[] = [];
  let total = 0;
  let truncado = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        const sobra = value.byteLength - (total - maxBytes);
        pedacos.push(value.subarray(0, Math.max(0, sobra)));
        truncado = true;
        try {
          await reader.cancel();
        } catch {
          /* ignora */
        }
        break;
      }
      pedacos.push(value);
    }
  }
  const texto = Buffer.concat(pedacos.map((p) => Buffer.from(p))).toString("utf8");
  return { texto, bytes: total, truncado };
}
