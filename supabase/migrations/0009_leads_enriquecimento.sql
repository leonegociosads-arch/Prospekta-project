-- ============================================================
--  Prospekta - migration 0009
--  Enriquecimento profundo (Place Details): campos promovidos para o lead.
--  O detalhe cru continua em places_cache.detalhes.
--
--  Rode no SQL Editor do Supabase.  Idempotente.
--  Depende de 0001 (tabela leads).
-- ============================================================

alter table leads add column if not exists telefone_internacional text;
alter table leads add column if not exists maps_uri              text;
alter table leads add column if not exists horarios              jsonb;   -- weekdayDescriptions
alter table leads add column if not exists enriquecido_em        timestamptz;

-- Grants (0002 ja cobre via default privileges; reforco idempotente).
grant all privileges on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
