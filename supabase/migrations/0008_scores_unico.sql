-- ============================================================
--  Prospekta - migration 0008
--  Score de Oportunidade: 1 score por lead (o calculo faz upsert).
--
--  Rode no SQL Editor do Supabase.  Idempotente.
--  Depende de 0003 (tabela scores).
-- ============================================================

-- scores esta vazia ate aqui, entao criar o indice unico e seguro.
create unique index if not exists scores_lead_uq on scores (lead_id);

-- Grants (0002 ja cobre via default privileges; reforco idempotente).
grant all privileges on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
