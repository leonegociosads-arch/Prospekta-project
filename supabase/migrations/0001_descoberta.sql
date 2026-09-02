-- ============================================================
--  Prospekta - migration 0001
--  Nucleo: pesquisa, descoberta via Google Places, cache e custo.
--  Rode este arquivo inteiro no SQL Editor do Supabase.
--  DEPOIS rode 0002_grants.sql (permissoes) - sem ele da "permission denied".
-- ============================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ------------------------------------------------------------
-- Pesquisas que voce cria no painel
-- ------------------------------------------------------------
create table searches (
  id                 uuid primary key default gen_random_uuid(),
  criada_em          timestamptz not null default now(),
  regiao_texto       text not null,
  centro_lat         double precision,
  centro_lng         double precision,
  raio_km            numeric not null default 10,
  nicho              text not null,
  filtros            jsonb not null default '{}'::jsonb,
  limite_leads       integer not null default 20,
  orcamento_chamadas integer not null default 5,
  chamadas_feitas    integer not null default 0,
  custo_estimado_usd numeric not null default 0,
  status             text not null default 'nova'   -- nova | descobrindo | pronta | erro
);

-- ------------------------------------------------------------
-- Cache de geocoding: "Iguape SP" -> coordenadas. Nunca resolver 2x.
-- ------------------------------------------------------------
create table region_cache (
  regiao_texto  text primary key,
  centro_lat    double precision not null,
  centro_lng    double precision not null,
  resolvido_em  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Cache de lugares da Google, por Place ID.
-- Fonte da verdade para "ja temos esse estabelecimento?".
-- ------------------------------------------------------------
create table places_cache (
  google_place_id  text primary key,
  resultado_busca  jsonb not null,
  detalhes         jsonb,
  busca_em         timestamptz not null default now(),
  detalhes_em      timestamptz
);

-- ------------------------------------------------------------
-- Uma empresa encontrada
-- ------------------------------------------------------------
create table leads (
  id               uuid primary key default gen_random_uuid(),
  google_place_id  text unique references places_cache(google_place_id),
  fonte            text not null default 'google_places',
  fonte_ref        text,
  nome             text not null,
  categoria        text,
  endereco         text,
  lat              double precision,
  lng              double precision,
  telefone         text,
  site_url         text,
  instagram_url    text,
  facebook_url     text,
  avaliacao        numeric,
  qtd_avaliacoes   integer,
  status_negocio   text,   -- OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY
  bruto            jsonb,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Vinculo pesquisa <-> lead. Um lead pode aparecer em varias pesquisas.
-- ------------------------------------------------------------
create table search_leads (
  search_id  uuid not null references searches(id) on delete cascade,
  lead_id    uuid not null references leads(id) on delete cascade,
  visto_em   timestamptz not null default now(),
  primary key (search_id, lead_id)
);

-- ------------------------------------------------------------
-- Registro de cada chamada externa, para somar consumo por mes
-- ------------------------------------------------------------
create table api_usage (
  id                 uuid primary key default gen_random_uuid(),
  em                 timestamptz not null default now(),
  provedor           text not null,          -- google | ia
  endpoint           text not null,          -- text_search | place_details | geocoding | pagespeed | ia_diagnosis
  faixa_campos       text,                   -- essentials | pro | enterprise
  search_id          uuid references searches(id) on delete set null,
  unidades           integer not null default 1,
  custo_estimado_usd numeric not null default 0,
  obs                text
);

create index on api_usage (em);
create index on leads (google_place_id);
create index on search_leads (lead_id);

-- ------------------------------------------------------------
-- Seguranca: RLS ligado em tudo.
-- A chave publica (anon) do navegador NAO acessa nada.
-- O codigo do servidor usa a service role key, que ignora RLS.
-- Politicas de acesso entram quando adicionarmos login.
-- ------------------------------------------------------------
alter table searches      enable row level security;
alter table region_cache  enable row level security;
alter table places_cache  enable row level security;
alter table leads         enable row level security;
alter table search_leads  enable row level security;
alter table api_usage     enable row level security;
