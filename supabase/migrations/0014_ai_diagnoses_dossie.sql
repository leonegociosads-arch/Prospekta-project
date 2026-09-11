-- ============================================================
--  Prospekta - migration 0014
--  Dossie comercial completo com IA (etapa 22).
--
--  A saida da IA deixou de ser um resumo curto (etapa 14) e virou um dossie:
--  pontos fortes/fracos, proposta comercial, estrategia de abordagem (com
--  gatilhos amarrados a um dado real), rascunho de 1a mensagem e objecoes.
--
--  As colunas antigas (problemas, oportunidades, servico_sugerido,
--  angulo_comercial, angulo_de_entrada) NAO sao removidas - ficam paradas,
--  so para historico de diagnosticos gerados antes desta etapa.
--
--  Idempotente. Rode no SQL Editor do Supabase. Depende de 0011.
-- ============================================================

alter table ai_diagnoses add column if not exists pontos_fortes   jsonb;
alter table ai_diagnoses add column if not exists pontos_fracos   jsonb;
alter table ai_diagnoses add column if not exists proposta        jsonb;
alter table ai_diagnoses add column if not exists estrategia      jsonb;
alter table ai_diagnoses add column if not exists mensagem_inicial text;
alter table ai_diagnoses add column if not exists objecoes        jsonb;

-- ------------------------------------------------------------
-- Grants (reforco idempotente; o 0002 ja cuida via default privileges)
-- ------------------------------------------------------------
grant all privileges on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
