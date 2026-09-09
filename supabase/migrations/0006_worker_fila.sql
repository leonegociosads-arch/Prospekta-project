-- ============================================================
--  Prospekta - migration 0006
--  Fila de tarefas do worker: reivindicar 1 job de forma ATOMICA
--  e segura contra dois workers rodando ao mesmo tempo.
--
--  Rode no SQL Editor do Supabase.  Idempotente (create or replace).
--  Depende de 0003 (tabela jobs).
-- ============================================================

-- reivindicar_proximo_job():
--   pega o job 'pendente' mais antigo que ja "venceu" (agendado_para <= agora),
--   marca 'rodando' e soma 1 em tentativas — tudo num unico UPDATE, atomico.
--
--   FOR UPDATE SKIP LOCKED: se outro worker ja travou aquela linha, ESTE
--   worker pula para a proxima em vez de esperar ou pegar a mesma. E o
--   padrao de fila no Postgres — impede processamento duplicado.
--
--   Retorna 0 linhas (fila vazia) ou 1 linha (o job reivindicado).
create or replace function reivindicar_proximo_job()
returns setof jobs
language sql
as $$
  update jobs
     set status        = 'rodando',
         tentativas     = tentativas + 1,
         atualizado_em  = now()
   where id = (
     select id
       from jobs
      where status = 'pendente'
        and agendado_para <= now()
      order by agendado_para, criado_em
      for update skip locked
      limit 1
   )
  returning *;
$$;

grant execute on function reivindicar_proximo_job() to service_role;
