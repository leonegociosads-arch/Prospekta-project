// Log simples e legivel, com tags entre colchetes:
//
//   2026-09-02T12:00:00.000Z [job 1a2b3c4d] [tipo descobrir] [search 9207ab12] [resultado feito] [duracao 4231ms]
//   2026-09-02T12:00:10.000Z [job 55ee77aa] [tipo descobrir] [resultado reagendado] [duracao 812ms] [erro http-429: muitas chamadas]
//
// Campos vazios/undefined sao omitidos.

export type CamposLog = Record<string, string | number | undefined>;

/** encurta um uuid para os 8 primeiros caracteres (ou "-" se vazio) */
export function curto(id: string | null | undefined): string {
  return id ? String(id).slice(0, 8) : "-";
}

/**
 * Cria uma funcao de log. `base` sao tags fixas repetidas em toda linha
 * (ex.: { worker: "1" } quando ha varios).
 */
export function criarLog(base: CamposLog = {}) {
  return function log(evento: string, campos: CamposLog = {}): void {
    const todos = { ...base, ...campos };
    const tags = Object.entries(todos)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `[${k} ${v}]`)
      .join(" ");
    const ts = new Date().toISOString();
    console.log(tags ? `${ts} ${tags} ${evento}` : `${ts} ${evento}`);
  };
}
