-- ============================================================
--  Prospekta - migration 0002
--  Concede acesso das tabelas aos papeis do Supabase.
--  Sem isto, ate a service role key recebe "permission denied".
--  Rode este arquivo inteiro no SQL Editor do Supabase.
-- ============================================================

-- Uso do schema
grant usage on schema public to anon, authenticated, service_role;

-- A service role (usada pelo servidor/worker) enxerga tudo.
-- Ela ignora RLS, entao continua sendo o unico acesso real aos dados.
grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- anon / authenticated: recebem o grant de tabela, mas o RLS (ligado, sem
-- politicas) continua bloqueando tudo. As politicas entram com o login.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Tabelas criadas no futuro herdam os mesmos grants automaticamente.
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;
