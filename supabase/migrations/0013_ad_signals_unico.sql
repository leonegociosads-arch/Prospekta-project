-- ============================================================
--  Prospekta - migration 0013
--  Indicios de trafego pago (etapa 12).
--
--  A tabela ad_signals ja existe desde a 0003. Aqui so garantimos 1 linha
--  corrente por lead (o modulo lib/ads usa upsert com onConflict = lead_id).
--
--  Idempotente. Rode no SQL Editor do Supabase. Depende de 0003.
-- ============================================================

-- se houver duplicatas antigas, mantem a mais recente antes de criar o indice
delete from ad_signals a
using ad_signals b
where a.lead_id = b.lead_id
  and a.verificado_em < b.verificado_em;

create unique index if not exists ad_signals_lead_uq on ad_signals (lead_id);

-- ------------------------------------------------------------
-- Grants (reforco idempotente; o 0002 ja cuida via default privileges)
-- ------------------------------------------------------------
grant all privileges on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
