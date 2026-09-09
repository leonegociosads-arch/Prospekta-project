// Protecao SSRF: uma URL vinda de um lead NAO pode fazer o servidor acessar
// destinos internos (localhost, IPs privados, servico de metadata da nuvem...).
//
// Estrategia:
//  1. so aceita http/https;
//  2. bloqueia hostnames obviamente internos (localhost, *.local, *.internal...);
//  3. resolve o DNS e REJEITA se qualquer IP resolvido for interno/reservado.
//
// Residual conhecido: "DNS rebinding" (o dominio resolve para um IP publico
// na validacao e para um IP interno no fetch seguinte). Para uma ferramenta
// pessoal, rodando na maquina do usuario, com timeout e sem seguir redirect
// para destino interno, o risco e baixo. Anotado no RESUMO.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ResolvedorDns = (
  host: string,
) => Promise<Array<{ address: string; family: number }>>;

const lookupTodos: ResolvedorDns = async (host) => {
  const r = await lookup(host, { all: true });
  return r.map((e) => ({ address: e.address, family: e.family }));
};

export class ErroSSRF extends Error {
  readonly motivo: string;
  constructor(motivo: string) {
    super(motivo);
    this.name = "ErroSSRF";
    this.motivo = motivo;
  }
}

const HOST_PROIBIDO =
  /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.intranet|.*\.lan|.*\.home|.*\.corp|metadata|metadata\.google\.internal|.*\.svc|.*\.cluster\.local)$/i;

export function ehHostProibido(host: string): boolean {
  const h = host.replace(/\.$/, "").toLowerCase();
  return HOST_PROIBIDO.test(h);
}

function ipv4EmFaixa(ip: string, prefixo: string, bits: number): boolean {
  const toN = (s: string) =>
    s.split(".").reduce((acc, o) => (acc << 8) + (Number(o) & 255), 0) >>> 0;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (toN(ip) & mask) === (toN(prefixo) & mask);
}

/** true se o IP (v4 ou v6) NAO deve ser acessado a partir do servidor. */
export function ehIpInterno(ipBruto: string): boolean {
  const versao = isIP(ipBruto);
  if (versao === 0) return true; // nao e IP valido -> trata como perigoso

  let ip = ipBruto;

  if (versao === 6) {
    const baixo = ip.toLowerCase();
    if (baixo === "::1" || baixo === "::") return true;
    if (baixo.startsWith("fe80") || baixo.startsWith("fe9") || baixo.startsWith("fea") || baixo.startsWith("feb")) {
      return true; // link-local fe80::/10
    }
    if (/^f[cd][0-9a-f]{2}:/.test(baixo)) return true; // ULA fc00::/7
    if (baixo.startsWith("ff")) return true; // multicast
    if (baixo.startsWith("2001:db8")) return true; // documentacao
    // IPv4 embutido (::ffff:1.2.3.4 ou ::1.2.3.4)
    const m = baixo.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (m) ip = m[1];
    else return false;
  }

  // IPv4
  const faixas: Array<[string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10], // CGNAT
    ["127.0.0.0", 8], // loopback
    ["169.254.0.0", 16], // link-local (inclui 169.254.169.254 metadata)
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4], // multicast
    ["240.0.0.0", 4], // reservado
    ["255.255.255.255", 32],
  ];
  return faixas.some(([p, b]) => ipv4EmFaixa(ip, p, b));
}

export type UrlSegura = { url: URL; ips: string[] };

/**
 * Valida uma URL bruta vinda de um lead. Lanca ErroSSRF se for insegura ou
 * malformada. Retorna a URL normalizada e os IPs para os quais ela resolve.
 */
export async function validarUrlPublica(
  bruta: string,
  opts: { resolver?: ResolvedorDns } = {},
): Promise<UrlSegura> {
  const resolver = opts.resolver ?? lookupTodos;

  if (typeof bruta !== "string" || bruta.trim() === "") {
    throw new ErroSSRF("URL vazia");
  }

  let url: URL;
  try {
    url = new URL(bruta.trim());
  } catch {
    throw new ErroSSRF(`URL invalida: ${bruta}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ErroSSRF(`esquema nao permitido: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new ErroSSRF("URL com credenciais embutidas");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (ehHostProibido(host)) {
    throw new ErroSSRF(`host interno bloqueado: ${host}`);
  }

  // host e um IP literal?
  if (isIP(host) !== 0) {
    if (ehIpInterno(host)) throw new ErroSSRF(`IP interno bloqueado: ${host}`);
    return { url, ips: [host] };
  }

  // host e um dominio -> resolve e checa todos os IPs
  let enderecos: Array<{ address: string; family: number }>;
  try {
    enderecos = await resolver(host);
  } catch (e) {
    throw new ErroSSRF(`nao foi possivel resolver o DNS de ${host}: ${e instanceof Error ? e.message : e}`);
  }
  const ips = enderecos.map((e) => e.address).filter(Boolean);
  if (ips.length === 0) throw new ErroSSRF(`${host} nao resolveu para nenhum IP`);

  const interno = ips.find((ip) => ehIpInterno(ip));
  if (interno) {
    throw new ErroSSRF(`${host} resolve para um IP interno (${interno})`);
  }

  return { url, ips };
}
