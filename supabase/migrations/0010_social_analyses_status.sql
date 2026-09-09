-- ============================================================
--  Prospekta - migration 0010
--  Presenca social objetiva (Etapa 13): estado explicito por plataforma.
--
--  "nao encontrado" != "nao existe" != "bloqueado". O campo `status` deixa
--  essa diferenca clara; `perfil_existe` continua como resumo booleano.
--
--  Rode no SQL Editor do Supabase.  Idempotente.
--  Depende de 0003 (tabela social_analyses).
-- ============================================================

alter table social_analyses add column if not exists status text;

alter table social_analyses drop constraint if exists social_analyses_status_check;
alter table social_analyses
  add constraint social_analyses_status_check
  check (status is null or status in ('encontrado', 'nao_encontrado', 'desconhecido', 'sem_link'));

-- Grants (0002 ja cobre via default privileges; reforco idempotente).
grant all privileges on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
