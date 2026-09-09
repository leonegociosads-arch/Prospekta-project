-- ============================================================
--  Prospekta - migration 0012
--  Favoritos: uma marca simples por lead (uso pessoal, sem login).
--
--  Idempotente. Rode no SQL Editor do Supabase. Depende de 0001.
-- ============================================================

alter table leads add column if not exists favorito boolean not null default false;

-- indice parcial: so os favoritos (a grande maioria e false)
create index if not exists leads_favorito_idx on leads (favorito) where favorito;

-- ------------------------------------------------------------
-- Grants (reforco idempotente; o 0002 ja cuida via default privileges)
-- ------------------------------------------------------------
grant all privileges on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
