// Score de Oportunidade v1 - formula DETERMINISTICA, transparente e testavel.
// Sem IA. Mesma entrada => mesma saida.
//
// Pergunta que o score responde: "quanto vale a pena prospectar esta empresa?"
// NAO e "quem tem o melhor marketing".

import type {
  Confianca,
  EntradaAnalise,
  EntradaScore,
  FatorScore,
  ModeradorScore,
  ResultadoScore,
} from "./tipos";

export const VERSAO_FORMULA = "v1";

export const PESOS = {
  negocio_ativo: 25,
  reputacao: 20,
  problemas: 35,
  contato: 10,
  investimento: 10,
} as const;

// ------------------------------------------------------------ helpers
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const clamp = (min: number, max: number, n: number) => Math.max(min, Math.min(max, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

const PESO_CONF: Record<Confianca, number> = { alta: 1, media: 0.6, baixa: 0.15 };

type ParcialFator = { fracao: number; confianca: Confianca; motivo: string };

// ------------------------------------------------------------ fatores

function fatorNegocioAtivo(e: EntradaScore): ParcialFator {
  if (e.statusNegocio === "CLOSED_PERMANENTLY") {
    return { fracao: 0, confianca: "alta", motivo: "Negocio marcado como permanentemente fechado." };
  }

  const motivos: string[] = [];
  let base: number;
  let conf: Confianca = "alta";
  if (e.statusNegocio === "CLOSED_TEMPORARILY") {
    base = 0.35;
    motivos.push("fechado temporariamente");
  } else if (e.statusNegocio === "OPERATIONAL") {
    base = 1;
    motivos.push("em operacao");
  } else {
    base = 0.7;
    conf = "media";
    motivos.push("situacao de funcionamento desconhecida");
  }

  const q = e.qtdAvaliacoes ?? 0;
  let sinais = 0;
  if (q >= 20) sinais += 2;
  else if (q >= 3) sinais += 1;
  if ((e.siteUrl ?? "").trim() !== "") sinais += 1;
  if (e.instagramUrl || e.facebookUrl) sinais += 1;

  // 0 avaliacoes E situacao nao confirmada = pouca prova de que o negocio esta de pe
  const semProvaDeVida = q === 0 && e.statusNegocio !== "OPERATIONAL";

  let fracao = base;
  if ((sinais === 0 && base >= 0.7) || (semProvaDeVida && sinais <= 1)) {
    fracao = base * 0.5;
    conf = "media";
    motivos.push("quase nenhum sinal de atividade real (sem avaliacoes e situacao nao confirmada)");
  } else if (sinais === 1) {
    fracao = base * 0.8;
    motivos.push("poucos sinais de atividade");
  } else {
    motivos.push(`${sinais} sinais de presenca ativa`);
  }

  return { fracao: clamp01(fracao), confianca: conf, motivo: capitalizar(motivos.join("; ") + ".") };
}

function fatorReputacao(e: EntradaScore): ParcialFator {
  const q = e.qtdAvaliacoes ?? 0;
  if (q <= 0) {
    return {
      fracao: 0.3,
      confianca: "baixa",
      motivo: "Sem avaliacoes publicas - reputacao nao observavel (diferente de reputacao ruim).",
    };
  }

  const vol = q >= 150 ? 1 : q >= 50 ? 0.9 : q >= 20 ? 0.75 : q >= 6 ? 0.55 : 0.35;

  const r = e.avaliacao;
  let notaR: number;
  let txt: string;
  if (r == null) {
    notaR = 0.55;
    txt = "sem nota media";
  } else if (r >= 4.5) {
    notaR = 1;
    txt = `nota ${r}`;
  } else if (r >= 4.0) {
    notaR = 0.85;
    txt = `nota ${r}`;
  } else if (r >= 3.5) {
    notaR = 0.6;
    txt = `nota ${r}`;
  } else if (r >= 3.0) {
    notaR = 0.4;
    txt = `nota ${r}`;
  } else {
    notaR = 0.25;
    txt = `nota baixa (${r})`;
  }

  return {
    fracao: clamp01(0.6 * vol + 0.4 * notaR),
    confianca: q >= 6 ? "alta" : "media",
    motivo: `${q} avaliacao(oes), ${txt}.`,
  };
}

function fatorProblemas(e: EntradaScore): ParcialFator {
  const temSite = (e.siteUrl ?? "").trim() !== "";
  const a = e.analiseSite;

  if (!temSite) {
    const temSocial = !!(e.instagramUrl || e.facebookUrl);
    return temSocial
      ? {
          fracao: 0.28,
          confianca: "media",
          motivo: "Sem site proprio (so redes sociais) - ha oportunidade, mas nao e urgencia automatica.",
        }
      : {
          fracao: 0.4,
          confianca: "media",
          motivo: "Sem site nem redes - presenca digital a construir (avaliar se o negocio comporta).",
        };
  }

  if (!a) {
    return {
      fracao: 0.3,
      confianca: "baixa",
      motivo: "Site cadastrado mas ainda nao analisado tecnicamente - rode a analise de site.",
    };
  }

  if (a.siteExiste === false) {
    if (a.erro && /ssrf|seguran/i.test(a.erro)) {
      return {
        fracao: 0.3,
        confianca: "baixa",
        motivo: "Nao foi possivel analisar o site (bloqueio de seguranca).",
      };
    }
    return {
      fracao: 0.5,
      confianca: "media",
      motivo: `Site cadastrado nao esta acessivel (${a.erro ?? "sem resposta"}) - precisa de site funcional.`,
    };
  }

  const probs = coletarProblemas(a, e.telefone);
  if (probs.length === 0) {
    return {
      fracao: 0.05,
      confianca: "alta",
      motivo: "Site tecnicamente bem resolvido - pouca coisa a melhorar.",
    };
  }

  let soma = probs.reduce((s, p) => s + p.peso, 0);
  if (probs.length === 1) soma = Math.min(soma, 0.45); // nenhum problema isolado domina
  return {
    fracao: clamp01(soma),
    confianca: "alta",
    motivo: probs.map((p) => p.texto).join("; ") + ".",
  };
}

function coletarProblemas(a: EntradaAnalise, telefoneLead: string | null) {
  const probs: Array<{ peso: number; texto: string }> = [];
  const add = (cond: boolean, peso: number, texto: string) => {
    if (cond) probs.push({ peso, texto });
  };

  add(a.https === false || a.tlsOk === false, 0.16, "sem HTTPS valido");
  add(
    a.temViewport === false || (a.notaMobile != null && a.notaMobile < 50),
    0.2,
    "nao e adaptado para celular",
  );
  add(
    (a.notaDesempenho != null && a.notaDesempenho < 50) ||
      (a.ttfbMs != null && a.ttfbMs > 2500) ||
      (a.pesoKb != null && a.pesoKb > 3000),
    0.12,
    "site lento",
  );
  add(a.temGa === false && a.temGtm === false, 0.12, "sem ferramenta de analise (Analytics/GTM)");
  add(a.temMetaPixel === false, 0.08, "sem Meta Pixel (sem remarketing)");
  add(a.temGoogleAds === false && a.temDoubleclick === false, 0.06, "sem tag de conversao do Google");

  const semNenhumCanal =
    a.temWhatsapp === false &&
    a.temFormulario === false &&
    a.temPaginaContato === false &&
    !telefoneLead;
  if (semNenhumCanal) {
    probs.push({ peso: 0.16, texto: "nenhum canal de contato visivel" });
  } else {
    add(
      a.temWhatsapp === false && a.temFormulario === false,
      0.08,
      "sem WhatsApp nem formulario no site",
    );
  }
  add(a.temCta === false, 0.05, "sem chamada para acao clara");

  return probs;
}

function fatorContato(e: EntradaScore): ParcialFator {
  const a = e.analiseSite;
  const partes: string[] = [];
  let f = 0;
  if (e.telefone) {
    f += 0.4;
    partes.push("telefone");
  }
  if (a?.temWhatsapp === true) {
    f += 0.35;
    partes.push("WhatsApp");
  }
  if (a?.temFormulario === true || a?.temPaginaContato === true) {
    f += 0.15;
    partes.push("formulario/pagina de contato");
  }
  if (e.instagramUrl || e.facebookUrl) {
    f += 0.12;
    partes.push("redes sociais");
  }

  const conf: Confianca = a || (e.siteUrl ?? "").trim() === "" ? "alta" : "media";
  if (f === 0) {
    return { fracao: 0.1, confianca: conf, motivo: "Nenhum canal de contato conhecido." };
  }
  return { fracao: clamp01(f), confianca: conf, motivo: "Contato por: " + partes.join(", ") + "." };
}

function fatorInvestimento(e: EntradaScore): ParcialFator {
  const a = e.analiseSite;
  if (!a) {
    return {
      fracao: 0.3,
      confianca: "baixa",
      motivo: "Sinais de investimento nao avaliados (site nao analisado).",
    };
  }
  if (a.siteExiste !== true) {
    return {
      fracao: 0.25,
      confianca: "baixa",
      motivo: "Sem site acessivel para avaliar investimento em trafego.",
    };
  }

  const partes: string[] = [];
  let f = 0;
  if (a.temGoogleAds === true || a.temDoubleclick === true) {
    f += 0.4;
    partes.push("tag de anuncios do Google");
  }
  if (a.temMetaPixel === true) {
    f += 0.25;
    partes.push("Meta Pixel");
  }
  if (a.temGtm === true) {
    f += 0.15;
    partes.push("Tag Manager");
  }
  if (a.temGa === true) {
    f += 0.15;
    partes.push("Analytics");
  }
  if ((e.qtdAvaliacoes ?? 0) >= 30) {
    f += 0.1;
    partes.push("reputacao ativamente gerenciada");
  }

  if (f === 0) {
    return {
      fracao: 0.2,
      confianca: "media",
      motivo:
        "Nenhuma tag de anuncio/medicao no site. Isso NAO confirma que a empresa nao anuncia - " +
        "apenas nao ha sinal de investimento digital visivel.",
    };
  }
  return { fracao: clamp01(f), confianca: "media", motivo: "Sinais: " + partes.join(", ") + "." };
}

// ------------------------------------------------------------ montagem

export function calcularScore(e: EntradaScore, opts: { agora?: Date } = {}): ResultadoScore {
  const agora = opts.agora ?? new Date();

  const parciais = {
    negocio_ativo: fatorNegocioAtivo(e),
    reputacao: fatorReputacao(e),
    problemas: fatorProblemas(e),
    contato: fatorContato(e),
    investimento: fatorInvestimento(e),
  };

  const mult = {
    negocio_ativo: 1,
    reputacao: 1,
    problemas: 1,
    contato: 1,
    investimento: 1,
  };
  const moderadores: ModeradorScore[] = [];

  // M1 - negocio fechado
  let m1 = 1;
  if (e.statusNegocio === "CLOSED_PERMANENTLY") m1 = 0;
  else if (e.statusNegocio === "CLOSED_TEMPORARILY") m1 = 0.4;
  moderadores.push({
    chave: "negocio_fechado",
    rotulo: "Negocio fechado",
    aplicado: m1 < 1,
    fator: m1,
    motivo:
      m1 === 0
        ? "Fechado em definitivo: prospeccao sem valor."
        : m1 < 1
          ? "Fechado temporariamente: valor de prospeccao reduzido."
          : "Negocio aberto.",
  });
  for (const k of chaves(mult)) mult[k] *= m1;

  // M2 - atividade baixa reduz o peso de 'problemas' e 'investimento'
  const ativo = parciais.negocio_ativo.fracao;
  let m2 = 1;
  if (ativo < 0.55) m2 = round2(0.35 + 0.65 * (ativo / 0.55));
  moderadores.push({
    chave: "atividade_baixa",
    rotulo: "Atividade baixa",
    aplicado: m2 < 1,
    fator: m2,
    motivo:
      m2 < 1
        ? "Empresa pouco ativa: problemas e sinais de investimento pesam menos (evita premiar quem so tem marketing ruim)."
        : "Empresa com atividade suficiente.",
  });
  mult.problemas *= m2;
  mult.investimento *= m2;

  // M3 - pouca oportunidade real reduz o peso dos fatores de 'boa empresa'
  const probEfetivo = parciais.problemas.fracao * m2;
  let m3 = 1;
  if (probEfetivo < 0.22) m3 = round2(0.55 + 0.45 * (probEfetivo / 0.22));
  moderadores.push({
    chave: "sem_oportunidade",
    rotulo: "Pouca oportunidade",
    aplicado: m3 < 1,
    fator: m3,
    motivo:
      m3 < 1
        ? "Pouco a resolver neste lead: os demais fatores contam menos (o objetivo e priorizar prospeccao, nao eleger a melhor empresa)."
        : "Ha problemas concretos a resolver.",
  });
  mult.negocio_ativo *= m3;
  mult.reputacao *= m3;
  mult.contato *= m3;
  mult.investimento *= m3;

  const fatores: FatorScore[] = chaves(PESOS).map((chave) =>
    montarFator(chave, PESOS[chave], parciais[chave], mult[chave]),
  );

  const total = clamp(0, 100, fatores.reduce((s, f) => s + f.pontos, 0));

  return {
    versao: VERSAO_FORMULA,
    calculadoEm: agora.toISOString(),
    total,
    confianca: confiancaGeral(fatores),
    fatores,
    moderadores,
  };
}

export const ROTULOS: Record<keyof typeof PESOS, string> = {
  negocio_ativo: "Negocio ativo / capacidade",
  reputacao: "Atividade / reputacao",
  problemas: "Problemas que podemos resolver",
  contato: "Facilidade de contato",
  investimento: "Sinais de investimento",
};

function montarFator(
  chave: keyof typeof PESOS,
  peso: number,
  p: ParcialFator,
  multiplicador: number,
): FatorScore {
  const fracaoEfetiva = clamp01(p.fracao * multiplicador);
  return {
    chave,
    rotulo: ROTULOS[chave],
    peso,
    fracao: round2(p.fracao),
    pontos: Math.round(fracaoEfetiva * peso),
    pontosBrutos: Math.round(clamp01(p.fracao) * peso),
    confianca: p.confianca,
    motivo: p.motivo,
  };
}

function confiancaGeral(fatores: FatorScore[]): Confianca {
  const somaPeso = fatores.reduce((s, f) => s + f.peso, 0);
  const media = fatores.reduce((s, f) => s + PESO_CONF[f.confianca] * f.peso, 0) / somaPeso;
  return media >= 0.8 ? "alta" : media >= 0.45 ? "media" : "baixa";
}

function chaves<T extends object>(o: T): Array<keyof T> {
  return Object.keys(o) as Array<keyof T>;
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
