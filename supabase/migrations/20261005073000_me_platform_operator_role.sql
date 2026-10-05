-- Expose the caller's platform operator role ('admin' | 'support' |
-- 'readonly', null for everyone else) in me(), so middleware can refuse write
-- requests from non-admin operators before server actions run. Those actions
-- often switch to the service-role client, where the database cannot tell who
-- started the write. Rewrites the live definition in place (grants kept);
-- re-running is a no-op once the key exists.
do $$
declare
  def text := pg_get_functiondef('public.me()'::regprocedure);
begin
  if position('platform_operator_role' in def) = 0 then
    execute replace(def,
      '''is_platform_operator'', public.is_platform_operator(),',
      '''is_platform_operator'', public.is_platform_operator(), ''platform_operator_role'', (select po.role from public.platform_operators po where po.auth_user_id = auth.uid() and po.active limit 1),');
  end if;
end $$;
