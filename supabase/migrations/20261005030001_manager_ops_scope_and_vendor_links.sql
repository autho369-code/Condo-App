-- Manager-workspace operations audit (work orders, ARC, violations, maintenance).
--
-- 1. Association-scoped managers. Most association tables carry the
--    RESTRICTIVE mgr_assoc_scope policy (can_view_association_row), so a
--    manager limited to some associations only reaches those. Three tables
--    the operations pages write were missing it: their staff policies use
--    can_access_association (company-wide), so a scoped manager could read
--    and change ARC requests (and, through them, their discussion threads),
--    house rules and preventive-maintenance tasks of every association in the
--    company. can_view_association_row() is true for everyone who is not a
--    scoped manager, so owners, board members, vendors and full-access staff
--    are unaffected.
--
-- 2. Vendor company on work orders. A work order (or a recurring template,
--    which generate_recurring_work_orders copies into work orders) whose
--    vendor belongs to another company hands that vendor the job, the unit
--    and the association through the vendor policies. RLS does not check the
--    company of a referenced row, so enforce it in a trigger. Existing rows
--    were checked: none mismatch. Only inserts and vendor changes are checked.
--
-- Additive and idempotent: no policy or data is dropped.

do $$
declare t text;
begin
  foreach t in array array['architectural_requests', 'house_rules', 'maintenance_tasks'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'mgr_assoc_scope') then
      execute format(
        'create policy mgr_assoc_scope on public.%I as restrictive for all to authenticated using (public.can_view_association_row(association_id))',
        t);
    end if;
  end loop;
end $$;

create or replace function public.work_order_vendor_in_company()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_vendor_portfolio uuid; v_portfolio uuid;
begin
  if new.vendor_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.vendor_id is not distinct from old.vendor_id
     and new.portfolio_id is not distinct from old.portfolio_id then
    return new;
  end if;
  v_portfolio := new.portfolio_id;
  if v_portfolio is null and new.association_id is not null then
    select a.portfolio_id into v_portfolio from public.associations a where a.id = new.association_id;
  end if;
  select v.portfolio_id into v_vendor_portfolio from public.vendors v where v.id = new.vendor_id;
  if v_vendor_portfolio is null or v_vendor_portfolio is distinct from v_portfolio then
    raise exception 'That vendor belongs to a different company' using errcode = '23514';
  end if;
  return new;
end $$;

revoke all on function public.work_order_vendor_in_company() from public, anon, authenticated;

do $$
begin
  -- Named to run after trg_work_order_00_consistency (which fills portfolio_id).
  if not exists (select 1 from pg_trigger where tgname = 'trg_work_order_01_vendor_company' and tgrelid = 'public.work_orders'::regclass) then
    create trigger trg_work_order_01_vendor_company
      before insert or update of vendor_id, portfolio_id on public.work_orders
      for each row execute function public.work_order_vendor_in_company();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_recurring_work_orders_vendor_company' and tgrelid = 'public.recurring_work_orders'::regclass) then
    create trigger trg_recurring_work_orders_vendor_company
      before insert or update of vendor_id, portfolio_id on public.recurring_work_orders
      for each row execute function public.work_order_vendor_in_company();
  end if;
end $$;
