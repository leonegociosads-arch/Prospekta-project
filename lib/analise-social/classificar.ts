// Decide o estado de um perfil a partir da resposta HTTP.
// CONSERVADOR: so diz "nao_encontrado" num 404 de verdade. Qualquer duvida,
// bloqueio ou tela de login => "desconhecido".

import type { RespostaSite } from "@/lib/analise-site/tipos";
import type { Plataforma, StatusSocial } from "./tipos";

const MARCAS_LOGIN =
  /\/accounts\/login|\/login\.php|\/login\/\?|login_redirect|"loginPage"|checkpoint\/|please log in|faca login para|entre para ver/i;

const MARCAS_404 =
  /sorry, this page isn't available|page not found|p[áa]gina n[ãa]o dispon[íi]vel|conte[úu]do n[ãa]o encontrado|esta p[áa]gina n[ãa]o est[áa] dispon[íi]vel/i;

export type Classificacao = { status: StatusSocial; motivo: string };

export function classificarResposta(resp: RespostaSite, plataforma: Plataforma): Classificacao {
  if (!resp.respondeu) {
    return { status: "desconhecido", motivo: `nao foi possivel acessar: ${resp.erro ?? "sem resposta"}` };
  }

  const s = resp.status ?? 0;

  if (s === 404) return { status: "nao_encontrado", motivo: "HTTP 404 - a pagina nao esta la" };
  if (s === 401 || s === 403 || s === 429) {
    return { status: "desconhecido", motivo: `bloqueado (HTTP ${s})` };
  }

  const caiuNoLogin =
    MARCAS_LOGIN.test(resp.urlFinal) || MARCAS_LOGIN.test(resp.html.slice(0, 20_000));
  if (caiuNoLogin) {
    return { status: "desconhecido", motivo: "redirecionado para tela de login / conteudo exige login" };
  }

  if (MARCAS_404.test(resp.html.slice(0, 20_000))) {
    return { status: "nao_encontrado", motivo: "pagina marcada como indisponivel" };
  }

  if (s >= 200 && s < 300) {
    const host = plataforma === "instagram" ? /instagram/i : /facebook/i;
    const temOg =
      /<meta[^>]+property=["']og:(?:title|description)["']/i.test(resp.html) &&
      host.test(resp.html.slice(0, 30_000));
    if (temOg) return { status: "encontrado", motivo: `perfil publico acessivel (HTTP ${s})` };
    return { status: "desconhecido", motivo: `HTTP ${s} sem dados de perfil legiveis (provavel bloqueio)` };
  }

  return { status: "desconhecido", motivo: `resposta inesperada (HTTP ${s})` };
}
