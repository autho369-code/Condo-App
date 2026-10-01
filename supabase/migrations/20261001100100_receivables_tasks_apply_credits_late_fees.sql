-- AppFolio Receivables tasks: "Apply Credits" and "Charge Late Fees".
--  * apply_credits: apply unapplied payments/credits to open charges, oldest
--    first (apply_payment), for one unit or a whole association.
--  * charge_late_fees_now: run the same late-fee rules as the nightly job
--    (assess_late_fee: grace days, owner overrides/exemptions, one fee per
--    charge) for one association on demand.
-- Finance staff of the association only.

create or replace function public.apply_credits(p_association_id uuid, p_unit_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid;
  c record;
  res jsonb;
  v_applied numeric := 0;
  v_payments integer := 0;
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
    select v.payment_id
      from public.v_unapplied_credits v
      join public.units u on u.id = v.unit_id
      join public.buildings b on b.id = u.building_id
     where b.association_id = p_association_id
       and (p_unit_id is null or v.unit_id = p_unit_id)
       and v.unapplied_amount > 0.005
       and exists (select 1 from public.charges ch where ch.unit_id = v.unit_id
                    and ch.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = ch.id), 0) > 0.005)
     order by v.unit_id, v.payment_date
  loop
    res := public.apply_payment(c.payment_id, 'auto_oldest_first', null);
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

create or replace function public.charge_late_fees_now(p_association_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid;
  c record;
  v_fee uuid;
  v_count integer := 0;
  v_total numeric := 0;
begin
  select portfolio_id into v_pid from public.associations where id = p_association_id and archived_at is null;
  if v_pid is null or not public.can_manage_finance(v_pid) or not public.can_manage_association(p_association_id) then
    raise exception 'You do not have accounting access to this association' using errcode = '42501';
  end if;
  if not exists (select 1 from public.associations where id = p_association_id and late_fee_enabled and coalesce(late_fee_amount, 0) > 0) then
    raise exception 'Late fees are turned off for this association — set the late fee policy first' using errcode = '22023';
  end if;

  for c in
    select ch.id
      from public.charges ch
      join public.units u on u.id = ch.unit_id
      join public.buildings b on b.id = u.building_id
     where b.association_id = p_association_id and ch.charge_type = 'assessment'
       and not exists (select 1 from public.late_fee_assessments l where l.charge_id = ch.id)
       and ch.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = ch.id), 0) > 0.005
     order by ch.due_date
  loop
    v_fee := public.assess_late_fee(c.id);
    if v_fee is not null then
      v_count := v_count + 1;
      v_total := v_total + coalesce((select amount from public.charges where id = v_fee), 0);
    end if;
  end loop;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'association', p_association_id, 'late_fees_charged', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('fees', v_count, 'total', v_total));
  return jsonb_build_object('fees', v_count, 'total', round(v_total, 2));
end $$;

revoke all on function public.apply_credits(uuid, uuid) from public, anon;
grant execute on function public.apply_credits(uuid, uuid) to authenticated, service_role;
revoke all on function public.charge_late_fees_now(uuid) from public, anon;
grant execute on function public.charge_late_fees_now(uuid) to authenticated, service_role;
