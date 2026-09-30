-- Review fix: association scoping applies to MANAGERS only. Company admins see
-- every association even if they still have association_managers rows from
-- before a promotion, so they're always eligible as work order assignees.
create or replace function public.work_order_staff(p_work_order uuid)
returns table (id uuid, name text) language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare w record;
begin
  select wo.id, coalesce(wo.portfolio_id, a.portfolio_id) as portfolio_id, wo.association_id into w
    from public.work_orders wo left join public.associations a on a.id = wo.association_id
   where wo.id = p_work_order;
  if w.id is null or not (public.is_platform_operator() or public.is_any_staff() or public.is_company_admin())
     or not public.can_access_portfolio(w.portfolio_id) or not public.can_manage_association(w.association_id) then
    return;
  end if;
  return query
    select p.id, coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.display_name), ''), p.email)
      from public.profiles p
     where p.portfolio_id = w.portfolio_id and p.disabled_at is null and p.hoa_role in ('manager', 'company_admin')
       and (p.hoa_role = 'company_admin'
            or not exists (select 1 from public.association_managers am where am.user_id = p.id)
            or exists (select 1 from public.association_managers am where am.user_id = p.id and am.association_id = w.association_id))
     order by 2;
end $$;
