-- Homeowner chargebacks from a work order.
--
-- When a repair was caused by an owner (a leak from their unit, damage by
-- their movers, a lockout), the association bills the cost back to that
-- owner. The charge lands on the unit ledger like any other charge (and posts
-- to the GL through the existing charge trigger), carries the work order it
-- came from, and is noted in the work order's activity log.
alter table public.charges
  add column if not exists work_order_id uuid references public.work_orders(id) on delete set null;
create index if not exists charges_work_order_idx on public.charges (work_order_id) where work_order_id is not null;

create or replace function public.charge_back_work_order(
  p_work_order uuid, p_category uuid, p_amount numeric, p_description text, p_due_date date default null)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  w public.work_orders;
  v_portfolio uuid;
  cat public.charge_categories;
  v_amount numeric(14,2);
  v_desc text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into w from public.work_orders where id = p_work_order and archived_at is null for update;
  if not found then raise exception 'Work order not found' using errcode = 'P0002'; end if;
  select coalesce(w.portfolio_id, a.portfolio_id) into v_portfolio from public.associations a where a.id = w.association_id;
  v_portfolio := coalesce(v_portfolio, w.portfolio_id);
  if v_portfolio is null
     or not (public.is_platform_operator()
             or (public.can_manage_finance(v_portfolio) and public.can_manage_association(w.association_id))) then
    raise exception 'Work order not found' using errcode = 'P0002';
  end if;
  if w.unit_id is null then
    raise exception 'This work order is for a common area — there is no homeowner to charge' using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount above zero' using errcode = '22023'; end if;
  if p_amount <> round(p_amount, 2) then raise exception 'Amount can have at most two decimals' using errcode = '22023'; end if;
  if p_amount > 100000 then raise exception 'Amount looks too large — enter it as a regular charge if intended' using errcode = '22023'; end if;
  v_amount := p_amount;

  select * into cat from public.charge_categories c
   where c.id = p_category and c.portfolio_id = v_portfolio and c.archived_at is null and coalesce(c.active, true)
     and (c.association_id is null or c.association_id = w.association_id);
  if not found then raise exception 'Pick a charge category' using errcode = '22023'; end if;

  v_desc := nullif(btrim(coalesce(p_description, '')), '');
  if v_desc is null then
    v_desc := 'Chargeback: ' || coalesce(w.title, 'repair') || coalesce(' (work order #' || w.number || ')', '');
  end if;
  if length(v_desc) > 500 then raise exception 'Keep the description under 500 characters' using errcode = '22023'; end if;

  insert into public.charges (unit_id, charge_category_id, charge_type, description, amount, due_date, gl_account_id, created_by, work_order_id)
  values (w.unit_id, cat.id, cat.charge_type, v_desc, v_amount, coalesce(p_due_date, current_date), cat.gl_account_id, auth.uid(), w.id)
  returning id into v_id;

  insert into public.work_order_updates (work_order_id, note, created_by)
  values (w.id, 'Charged back ' || to_char(v_amount, 'FM$999,999,990.00') || ' to the homeowner (' || cat.name || ')', auth.uid());
  return v_id;
end $$;

revoke all on function public.charge_back_work_order(uuid, uuid, numeric, text, date) from public, anon;
grant execute on function public.charge_back_work_order(uuid, uuid, numeric, text, date) to authenticated;
