-- ============================================================
--  Prospekta - migration 0007
--  Campos extras da analise tecnica de site (Etapa 9) e garantia de
--  1 boletim por lead.
--
--  Rode no SQL Editor do Supabase.  Idempotente.
--  Depende de 0003 (tabela site_analyses).
-- ============================================================

alter table site_analyses add column if not exists tls_ok        boolean;
alter table site_analyses add column if not exists tls_erro      text;
alter table site_analyses add column if not exists tem_doubleclick boolean;
alter table site_analyses add column if not exists qtd_redirects integer;
alter table site_analyses add column if not exists titulo        text;
alter table site_analyses add column if not exists servidor      text;

-- 1 boletim por lead: o analisador faz upsert por lead_id.
-- (site_analyses esta vazia ate aqui, entao criar o indice unico e seguro.)
create unique index if not exists site_analyses_lead_uq on site_analyses (lead_id);

-- Grants (0002 ja cobre via default privileges; reforco idempotente).
grant all privileges on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
