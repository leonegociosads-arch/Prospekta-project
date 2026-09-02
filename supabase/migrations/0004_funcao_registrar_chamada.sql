-- ============================================================
--  Prospekta - migration 0004
--  Funcao para incrementar os contadores de consumo de uma pesquisa
--  de forma ATOMICA (um unico UPDATE = sem "lost update" sob concorrencia).
--
--  Usada por lib/guardas/store-supabase.ts (registrarConsumoPesquisa).
--  Rode no SQL Editor do Supabase.
--
--  Idempotente (create or replace). No banco atual a funcao ja existe
--  (criada numa sessao anterior); rodar de novo nao causa problema.
-- ============================================================

create or replace function registrar_chamada_pesquisa(
  p_search_id uuid,
  p_chamadas  integer,
  p_custo     numeric
) returns void
language sql
as $$
  update searches
     set chamadas_feitas     = chamadas_feitas + p_chamadas,
         custo_estimado_usd   = custo_estimado_usd + p_custo
   where id = p_search_id;
$$;

grant execute on function registrar_chamada_pesquisa(uuid, integer, numeric)
  to service_role;
