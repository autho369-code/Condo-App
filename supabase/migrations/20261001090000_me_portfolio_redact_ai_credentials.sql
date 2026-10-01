-- me() returned the full portfolios row as `portfolio`, including the AI
-- provider credential columns. Any authenticated portfolio member (owners,
-- board, tenants, vendors) can call rpc('me'), so the first key saved in
-- /settings/ai would have been handed to all of them. Strip the credential
-- columns; server-side AI code reads them from portfolios directly
-- (lib/ai/service.ts getAIConfig, app/(app)/settings/ai/page.tsx).
-- Everything else is identical to the previous definition.

create or replace function public.me()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  select jsonb_build_object(
    'auth_user_id', auth.uid(),
    'email', (select email from auth.users where id = auth.uid()),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'portfolio', (
      select to_jsonb(po) - 'ai_api_key' - 'ai_api_key_ciphertext' - 'ai_endpoint'
      from public.portfolios po
      where po.id = public.current_portfolio_id()
    ),
    'role_name', public.current_role_name(),
    'is_platform_operator', public.is_platform_operator(),
    'is_company_admin', public.is_company_admin(),
    'is_full_access_staff', public.is_full_access_staff(),
    'is_finance_staff', public.is_finance_staff(),
    'is_staff', public.is_staff(),
    'is_board', public.is_board_user(),
    'is_resident', public.is_portal_resident(),
    'is_tenant', public.is_tenant_user(),
    'owner_id', public.current_owner_id(),
    'tenant_id', public.current_tenant_id(),
    'vendor_id', public.current_vendor_id(),
    'board_association_ids', array(select public.current_board_association_ids()),
    'resident_association_ids', array(select public.current_resident_association_ids()),
    'resident_unit_ids', array(select public.current_resident_unit_ids()),
    'tenant_association_ids', array(select public.current_tenant_association_ids()),
    'tenant_unit_ids', array(select public.current_tenant_unit_ids())
  );
$function$;

-- create or replace keeps the existing ACL; restate it so this file is
-- self-describing (postgres, service_role, authenticated only).
revoke all on function public.me() from public, anon;
grant execute on function public.me() to authenticated, service_role;
