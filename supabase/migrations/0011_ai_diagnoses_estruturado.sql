-- ============================================================
--  Prospekta - migration 0011
--  Diagnostico comercial com IA (etapa 14).
--
--  A tabela ai_diagnoses ja existe desde a 0003 com as colunas basicas
--  (modelo, versao_prompt, resumo, problemas, angulo_de_entrada, tokens_*,
--  custo_usd, criado_em). Aqui adicionamos os campos da saida estruturada
--  que a etapa 14 pede, o dossie de entrada (auditoria) e um indice unico
--  por lead (1 diagnostico corrente por lead, atualizado via upsert).
--
--  Idempotente. Rode no SQL Editor do Supabase.
--  Depende de 0003.
-- ============================================================

alter table ai_diagnoses add column if not exists oportunidades     jsonb;
alter table ai_diagnoses add column if not exists servico_sugerido  text;
alter table ai_diagnoses add column if not exists angulo_comercial  text;
alter table ai_diagnoses add column if not exists confianca         text;
alter table ai_diagnoses add column if not exists fatos_utilizados  jsonb;
-- dossie exato que foi enviado ao modelo (para conferir de onde saiu cada afirmacao)
alter table ai_diagnoses add column if not exists entrada           jsonb;
-- preenchido quando o modelo respondeu algo que nao deu para aproveitar
alter table ai_diagnoses add column if not exists erro              text;
alter table ai_diagnoses add column if not exists atualizado_em     timestamptz not null default now();

-- confianca: so os tres valores previstos (ou nulo, quando houve erro)
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'ai_diagnoses_confianca_check') then
    alter table ai_diagnoses drop constraint ai_diagnoses_confianca_check;
  end if;
  alter table ai_diagnoses
    add constraint ai_diagnoses_confianca_check
    check (confianca is null or confianca in ('alta', 'media', 'baixa'));
end $$;

-- 1 diagnostico corrente por lead (o modulo usa upsert com onConflict = lead_id)
create unique index if not exists ai_diagnoses_lead_uq on ai_diagnoses (lead_id);

-- ------------------------------------------------------------
-- Grants (reforco idempotente; o 0002 ja cuida via default privileges)
-- ------------------------------------------------------------
grant all privileges on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
