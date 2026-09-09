// Tipos da presenca social objetiva.

export type Plataforma = "instagram" | "facebook";

export type StatusSocial =
  | "encontrado" // perfil publico verificado
  | "nao_encontrado" // tinha URL, mas e um 404 real (o perfil nao esta la)
  | "desconhecido" // tinha URL, mas bloqueio / login / resposta ambigua
  | "sem_link"; // nao achamos nenhum link para esta plataforma

export type OrigemLink = "site" | "google_places";

export type SinaisPerfil = {
  bio: string | null;
  linkExterno: string | null;
  seguidores: number | null;
  posts: number | null;
  /** quase sempre null: exige login/API, que nao fazemos */
  ultimoPostEm: string | null;
};

export const SINAIS_VAZIOS: SinaisPerfil = {
  bio: null,
  linkExterno: null,
  seguidores: null,
  posts: null,
  ultimoPostEm: null,
};

export type RedesEncontradas = {
  instagram: string | null;
  facebook: string | null;
  /** linkedin, youtube, tiktok... so registrado, nao analisado nesta etapa */
  outras: string[];
};

export type ResultadoPlataforma = {
  plataforma: Plataforma;
  status: StatusSocial;
  url: string | null;
  origem: OrigemLink | null;
  sinais: SinaisPerfil;
  motivo: string;
};

export type ResultadoAnaliseSocial = {
  leadId: string;
  status: "ok" | "pulado-cache" | "lead-nao-encontrado";
  plataformas: ResultadoPlataforma[];
};
