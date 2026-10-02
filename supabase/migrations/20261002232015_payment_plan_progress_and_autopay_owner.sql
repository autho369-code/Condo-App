-- Payment plans counted every payment made after the plan started, so an
-- owner paying only their ongoing monthly dues "completed" an arrears plan
-- and had their collections hold released with the arrears unpaid. Progress
-- is now payments since the plan started less the new charges that fell due
-- since then (never below zero): only money beyond current dues pays the plan.
--
-- Also: when an owner's occupancy of a unit ends (sold or moved out), their
-- AutoPay mandates for that unit are canceled so the seller's account is not
-- charged for the buyer's balance.

create or replace function public.payment_plan_paid_amount(p_plan_id uuid)
returns numeric
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $$
  select greatest(0,
           coalesce((select sum(pm.amount) from public.payments pm
                      where pm.unit_id = p.unit_id
                        and pm.created_at >= p.created_at
                        and (p.cancelled_at is null or pm.created_at <= p.cancelled_at)
                        and coalesce(pm.method, '') <> 'credit'), 0)
         - coalesce((select sum(c.amount) from public.charges c
                      where c.unit_id = p.unit_id
                        and c.due_date >= p.created_at::date
                        and c.due_date <= least(current_date, coalesce(p.cancelled_at::date, current_date))), 0))
    from public.payment_plans p
   where p.id = p_plan_id;
$$;
revoke all on function public.payment_plan_paid_amount(uuid) from public, anon, authenticated;

create or replace function public.app_complete_paid_payment_plan(p_unit_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  pl public.payment_plans;
begin
  select * into pl from public.payment_plans where unit_id = p_unit_id and status = 'active' for update;
  if pl.id is null then
    return;
  end if;
  if public.payment_plan_paid_amount(pl.id) >= pl.total_amount then
    update public.payment_plans set status = 'completed', completed_at = now(), updated_at = now() where id = pl.id;
    perform public.app_release_payment_plan_holds(pl.unit_id, 'Payment plan paid off');
  end if;
end $function$;

create or replace function public.payment_plan_schedule(p_plan_id uuid)
returns table(installment_number integer, due_date date, amount numeric, covered numeric, status text)
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  with plan as (
    select p.* from public.payment_plans p
     where p.id = p_plan_id
       and (public.can_manage_association(p.association_id) or p.unit_id in (select public.current_resident_unit_ids())
            or coalesce(auth.role(), '') = 'service_role')
  ),
  paid as (
    select public.payment_plan_paid_amount(plan.id) as total from plan
  ),
  sched as (
    select i.installment_number, i.due_date, i.amount,
           sum(i.amount) over (order by i.installment_number) as cumulative
      from public.payment_plan_installments i join plan on plan.id = i.plan_id
  )
  select s.installment_number, s.due_date, s.amount,
         round(greatest(0, least(s.amount, paid.total - (s.cumulative - s.amount))), 2) as covered,
         case when paid.total >= s.cumulative then 'paid'
              when s.due_date < current_date then 'behind'
              when s.due_date <= current_date + 7 then 'due'
              else 'upcoming' end as status
    from sched s cross join paid
   order by s.installment_number;
$function$;

create or replace function public.cancel_autopay_when_occupancy_ends()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if old.status = 'current' and new.status is distinct from 'current' and new.owner_id is not null then
    update public.autopay_mandates
       set status = 'canceled', canceled_at = now(), updated_at = now()
     where owner_id = new.owner_id
       and unit_id = new.unit_id
       and status <> 'canceled';
  end if;
  return new;
end $$;
revoke all on function public.cancel_autopay_when_occupancy_ends() from public, anon, authenticated;

create trigger occupancies_cancel_autopay_on_end
  after update of status on public.occupancies
  for each row execute function public.cancel_autopay_when_occupancy_ends();
