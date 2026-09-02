-- ============================================================
--  Prospekta - migration 0003
--  Tabelas de analise por lead + fila de jobs do worker.
--
--  IMPORTANTE: no banco ATUAL estas 6 tabelas JA EXISTEM (foram criadas
--  numa sessao anterior; o arquivo de migration nao tinha sido versionado).
--  Este arquivo foi escrito de forma IDEMPOTENTE - roda sem erro tanto num
--  banco novo (cria tudo) quanto no banco atual (nao faz nada).
--
--  Depende de 0001 (searches, leads) e 0002 (grants).
--  Rode no SQL Editor do Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- searches: garante o CHECK do conjunto de status validos
-- ------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'searches_status_check') then
    alter table searches
      add constraint searches_status_check
      check (status in ('nova', 'descobrindo', 'pronta', 'erro'));
  end if;
end $$;

-- ------------------------------------------------------------
-- site_analyses: analise tecnica do site de um lead (codigo proprio)
-- ------------------------------------------------------------
create table if not exists site_analyses (
  id                 uuid primary key default gen_random_uuid(),
  lead_id            uuid not null references leads(id) on delete cascade,
  verificado_em      timestamptz not null default now(),
  site_existe        boolean,
  url_final          text,
  https              boolean,
  status_http        integer,
  tem_viewport       boolean,
  nota_mobile        integer,
  nota_desempenho    integer,
  peso_kb            integer,
  ttfb_ms            integer,
  tem_whatsapp       boolean,
  tem_telefone       boolean,
  tem_formulario     boolean,
  tem_cta            boolean,
  tem_pagina_contato boolean,
  tem_meta_pixel     boolean,
  tem_ga             boolean,
  tem_gtm            boolean,
  tem_google_ads     boolean,
  stack              jsonb,
  sinais             jsonb,
  erro               text
);
create index if not exists site_analyses_lead_id_idx on site_analyses (lead_id);

-- ------------------------------------------------------------
-- ad_signals: indicios de trafego pago, sempre com nivel de confianca
-- ------------------------------------------------------------
create table if not exists ad_signals (
  id                  uuid primary key default gen_random_uuid(),
  lead_id             uuid not null references leads(id) on delete cascade,
  verificado_em       timestamptz not null default now(),
  meta_ads_encontrado text,
  meta_ads_qtd        integer,
  google_ads_no_site  boolean,
  sinais              jsonb,
  veredito            text,
  confianca           text,
  evidencias          jsonb,
  erro                text,
  constraint ad_signals_meta_check
    check (meta_ads_encontrado is null or meta_ads_encontrado in ('sim', 'nao', 'desconhecido')),
  constraint ad_signals_veredito_check
    check (veredito is null or veredito in ('forte', 'alguns', 'nenhum')),
  constraint ad_signals_confianca_check
    check (confianca is null or confianca in ('alta', 'media', 'baixa'))
);
create index if not exists ad_signals_lead_id_idx on ad_signals (lead_id);

-- ------------------------------------------------------------
-- social_analyses: presenca objetiva numa rede (1 registro por lead+plataforma)
-- ------------------------------------------------------------
create table if not exists social_analyses (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references leads(id) on delete cascade,
  plataforma     text not null,
  verificado_em  timestamptz not null default now(),
  perfil_existe  boolean,
  perfil_url     text,
  seguidores     integer,
  ultimo_post_em timestamptz,
  posts_recentes integer,
  tem_bio        boolean,
  tem_link       boolean,
  objetivo       jsonb,
  avaliacao_ia   jsonb,
  erro           text,
  constraint social_analyses_plataforma_check
    check (plataforma in ('instagram', 'facebook'))
);
create unique index if not exists social_analyses_lead_plataforma_uq
  on social_analyses (lead_id, plataforma);

-- ------------------------------------------------------------
-- scores: Score de Oportunidade (0-100), deterministico e explicavel
-- ------------------------------------------------------------
create table if not exists scores (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references leads(id) on delete cascade,
  calculado_em   timestamptz not null default now(),
  total          integer not null,
  detalhamento   jsonb not null,
  versao_formula text not null default 'v1',
  constraint scores_total_check check (total between 0 and 100)
);
create index if not exists scores_lead_id_idx on scores (lead_id);
create index if not exists scores_total_idx on scores (total);

-- ------------------------------------------------------------
-- ai_diagnoses: resumo comercial gerado por IA + custo da chamada
-- ------------------------------------------------------------
create table if not exists ai_diagnoses (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid not null references leads(id) on delete cascade,
  criado_em         timestamptz not null default now(),
  modelo            text not null,
  versao_prompt     text not null default 'v1',
  resumo            text,
  problemas         jsonb,
  angulo_de_entrada text,
  tokens_entrada    integer,
  tokens_saida      integer,
  custo_usd         numeric not null default 0
);
create index if not exists ai_diagnoses_lead_id_idx on ai_diagnoses (lead_id);

-- ------------------------------------------------------------
-- jobs: fila de tarefas do worker
-- ------------------------------------------------------------
create table if not exists jobs (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null,
  search_id      uuid references searches(id) on delete cascade,
  lead_id        uuid references leads(id) on delete cascade,
  payload        jsonb not null default '{}'::jsonb,
  status         text not null default 'pendente',
  tentativas     integer not null default 0,
  max_tentativas integer not null default 3,
  ultimo_erro    text,
  agendado_para  timestamptz not null default now(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint jobs_status_check
    check (status in ('pendente', 'rodando', 'feito', 'erro'))
);
create index if not exists jobs_fila_idx on jobs (status, agendado_para);
create index if not exists jobs_search_id_idx on jobs (search_id);
create index if not exists jobs_lead_id_idx on jobs (lead_id);

-- ------------------------------------------------------------
-- Seguranca: RLS ligado (idempotente - enable e no-op se ja estiver ligado)
-- ------------------------------------------------------------
alter table site_analyses   enable row level security;
alter table ad_signals      enable row level security;
alter table social_analyses enable row level security;
alter table scores          enable row level security;
alter table ai_diagnoses    enable row level security;
alter table jobs            enable row level security;

-- ------------------------------------------------------------
-- Grants (o 0002 ja cuida via default privileges; reforco idempotente)
-- ------------------------------------------------------------
grant all privileges on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
