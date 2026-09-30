-- Review fix: charge_back_work_order preferred work_orders.portfolio_id over
-- the association's company, and nothing kept the two consistent, so a
-- mismatched work order could be authorized against one company but charged
-- on another company's unit.
--   * every work order's portfolio_id now follows its association (filled in
--     when missing, rejected when it disagrees) — no existing rows disagree;
--   * the chargeback derives the company from the association only.
create or replace function public.work_order_unit_in_association()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_portfolio uuid;
begin
  if new.association_id is not null then
    select portfolio_id into v_portfolio from public.associations where id = new.association_id;
    if new.portfolio_id is null then
      new.portfolio_id := v_portfolio;
    elsif v_portfolio is not null and new.portfolio_id <> v_portfolio then
      raise exception 'That association belongs to a different company' using errcode = '23514';
    end if;
  end if;
  if new.unit_id is not null
     and (tg_op = 'INSERT' or new.unit_id is distinct from old.unit_id or new.association_id is distinct from old.association_id)
     and not exists (select 1 from public.units u join public.buildings b on b.id = u.building_id
                      where u.id = new.unit_id and b.association_id = new.association_id) then
    raise exception 'That unit is not in the selected association' using errcode = '23514';
  end if;
  return new;
end $$;

-- Named to sort (and therefore fire) before trg_work_order_assign_number, so
-- numbering always uses the association's company.
drop trigger if exists trg_work_order_unit_in_association on public.work_orders;
drop trigger if exists trg_work_order_00_consistency on public.work_orders;
create trigger trg_work_order_00_consistency before insert or update of unit_id, association_id, portfolio_id on public.work_orders
  for each row execute function public.work_order_unit_in_association();

do $$
declare v_def text; v_old text;
begin
  select pg_get_functiondef('public.charge_back_work_order(uuid, uuid, numeric, text, date)'::regprocedure) into v_def;
  v_old := '  select coalesce(w.portfolio_id, a.portfolio_id) into v_portfolio from public.associations a where a.id = w.association_id;' || chr(10)
        || '  v_portfolio := coalesce(v_portfolio, w.portfolio_id);';
  if position(v_old in v_def) = 0 then raise exception 'chargeback portfolio anchor not found'; end if;
  execute replace(v_def, v_old,
    '  -- The company comes from the association, never from the work order row.' || chr(10)
    || '  select a.portfolio_id into v_portfolio from public.associations a where a.id = w.association_id;' || chr(10)
    || '  if w.portfolio_id is not null and w.portfolio_id is distinct from v_portfolio then' || chr(10)
    || '    raise exception ''This work order''''s company does not match its association'' using errcode = ''22023'';' || chr(10)
    || '  end if;');
end $$;
