-- ============================================================
--  Prospekta - migration 0005
--  Funcao que cria uma pesquisa E enfileira o job de descoberta,
--  numa transacao unica (o corpo de uma funcao plpgsql e atomico:
--  se o insert em jobs falhar, o insert em searches e desfeito).
--
--  Usada pela Server Action de /pesquisa/nova.
--  Rode no SQL Editor do Supabase.  Idempotente (create or replace).
-- ============================================================

create or replace function criar_pesquisa(
  p_regiao             text,
  p_nicho              text,
  p_raio_km            numeric,
  p_limite_leads       integer,
  p_orcamento_chamadas integer
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into searches (regiao_texto, nicho, raio_km, limite_leads, orcamento_chamadas, status)
  values (trim(p_regiao), trim(p_nicho), p_raio_km, p_limite_leads, p_orcamento_chamadas, 'nova')
  returning id into v_id;

  insert into jobs (tipo, search_id, status, payload)
  values ('descobrir', v_id, 'pendente', '{}'::jsonb);

  return v_id;
end;
$$;

grant execute on function criar_pesquisa(text, text, numeric, integer, integer) to service_role;
