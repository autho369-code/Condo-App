-- Same rule as work_order_staff: association scoping applies to managers only.
-- A company admin (possibly promoted from a scoped manager, with leftover
-- association_managers rows) sees every association and can always be assigned.
create or replace function public.can_be_assigned_message_thread(p_user uuid, p_portfolio uuid, p_association uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.profiles p
     where p.id = p_user and p.portfolio_id = p_portfolio and p.disabled_at is null
       and p.hoa_role in ('manager', 'company_admin')
       and (p.hoa_role = 'company_admin'
            or not exists (select 1 from public.association_managers am where am.user_id = p.id)
            or exists (select 1 from public.association_managers am where am.user_id = p.id and am.association_id = p_association)));
$$;
revoke all on function public.can_be_assigned_message_thread(uuid, uuid, uuid) from public, anon, authenticated;
