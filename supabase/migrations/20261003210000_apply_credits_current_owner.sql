-- Applying credits respects ownership (Financial Diagnostics / Receivables
-- tasks). apply_credits applied every unapplied payment on a unit to the
-- unit's oldest open charges, so a previous owner's leftover credit paid the
-- new owner's charges, and the new owner's money paid off the previous
-- owner's old charges. It now only applies payments made since the current
-- owner took the unit, and only to charges due since then. Older credit is
-- listed under "Unused Prepayments for Past Owners" to be refunded or moved
-- deliberately.

-- When the current owner took the unit: the earliest move-in of its current
-- owner occupancies (null when no current owner is on file).
create or replace function public.app_unit_owner_since(p_unit_id uuid)
returns date language sql stable security definer set search_path = pg_catalog, public as $$
  select min(o.move_in_date) from public.occupancies o
   where o.unit_id = p_unit_id and o.status = 'current' and o.occupancy_type = 'owner';
$$;
revoke all on function public.app_unit_owner_since(uuid) from public, anon, authenticated;

create or replace function public.apply_credits(p_association_id uuid, p_unit_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare
  v_pid uuid;
  c record;
  res jsonb;
  v_applied numeric := 0;
  v_payments integer := 0;
  v_charge_ids uuid[];
begin
  select portfolio_id into v_pid from public.associations where id = p_association_id and archived_at is null;
  if v_pid is null or not public.can_manage_finance(v_pid) or not public.can_manage_association(p_association_id) then
    raise exception 'You do not have accounting access to this association' using errcode = '42501';
  end if;
  if p_unit_id is not null and not exists (
       select 1 from public.units u join public.buildings b on b.id = u.building_id
        where u.id = p_unit_id and b.association_id = p_association_id) then
    raise exception 'That unit is not in this association' using errcode = '22023';
  end if;

  for c in
    select v.payment_id, v.unit_id, public.app_unit_owner_since(v.unit_id) as since
      from public.v_unapplied_credits v
      join public.units u on u.id = v.unit_id
      join public.buildings b on b.id = u.building_id
     where b.association_id = p_association_id
       and (p_unit_id is null or v.unit_id = p_unit_id)
       and v.unapplied_amount > 0.005
       and v.payment_date >= coalesce(public.app_unit_owner_since(v.unit_id), '-infinity'::date)
     order by v.unit_id, v.payment_date, v.payment_id
  loop
    select array_agg(cb.charge_id order by cb.due_date, ch.created_at, cb.charge_id) into v_charge_ids
      from public.v_charge_balances cb join public.charges ch on ch.id = cb.charge_id
     where cb.unit_id = c.unit_id and cb.balance_due > 0.005
       and coalesce(cb.due_date, ch.created_at::date) >= coalesce(c.since, '-infinity'::date);
    continue when v_charge_ids is null;
    res := public.apply_payment(c.payment_id, 'auto_specific', v_charge_ids);
    if coalesce((res ->> 'applied_total')::numeric, 0) > 0 then
      v_applied := v_applied + (res ->> 'applied_total')::numeric;
      v_payments := v_payments + 1;
    end if;
  end loop;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'association', p_association_id, 'credits_applied', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('unit_id', p_unit_id, 'payments', v_payments, 'applied_total', v_applied));
  return jsonb_build_object('payments', v_payments, 'applied_total', round(v_applied, 2));
end $$;
