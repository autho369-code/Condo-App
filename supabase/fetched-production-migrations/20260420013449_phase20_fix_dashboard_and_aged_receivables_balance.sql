-- Fix aged_receivables: use payment_applications, not payments.charge_id
create or replace view public.aged_receivables
  with (security_invoker = true) as
select c.unit_id, u.unit_number, b.name as building_name,
       a.name as association_name, a.id as association_id,
       c.id as charge_id, c.description, c.amount, c.due_date,
       coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0) as total_paid,
       (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) as balance_due,
       case
         when c.due_date >= current_date then 'current'
         when c.due_date >= current_date - interval '30 days' then '1_30'
         when c.due_date >= current_date - interval '60 days' then '31_60'
         when c.due_date >= current_date - interval '90 days' then '61_90'
         else '90_plus'
       end as aging_bucket
  from public.charges c
  join public.units u on u.id = c.unit_id
  join public.buildings b on b.id = u.building_id
  join public.associations a on a.id = b.association_id
 where (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) > 0;

-- Rebuild v_dashboard_summary delinquency buckets to use payment_applications
create or replace view public.v_dashboard_summary
  with (security_invoker = true) as
select
  p.id as portfolio_id, p.company_name, p.tier, p.suspended_at,
  coalesce((
    select count(*)::numeric / nullif(count(*), 0)
      from public.payments pm
     where pm.payment_date > current_date - interval '30 days'
       and exists (select 1 from public.units u
                   join public.buildings b on b.id = u.building_id
                   join public.associations a on a.id = b.association_id
                   where u.id = pm.unit_id and a.portfolio_id = p.id)
  ), 0) as recent_payment_count,
  (select count(*) from public.owners o where o.portfolio_id = p.id and o.portal_activated) as portal_activated_count,
  (select count(*) from public.owners o where o.portfolio_id = p.id and not o.portal_activated and o.email is not null) as portal_not_activated_count,
  (select count(*) from public.owners o where o.portfolio_id = p.id and (o.email is null or o.email = '')) as portal_no_email_count,
  (select count(*) from public.charges c
     join public.units u on u.id = c.unit_id
     join public.buildings b on b.id = u.building_id
     join public.associations a on a.id = b.association_id
    where a.portfolio_id = p.id
      and c.due_date between current_date - interval '30 days' and current_date - interval '1 day'
      and (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id),0)) > 0
  ) as delinquency_0_30,
  (select count(*) from public.charges c
     join public.units u on u.id = c.unit_id
     join public.buildings b on b.id = u.building_id
     join public.associations a on a.id = b.association_id
    where a.portfolio_id = p.id
      and c.due_date between current_date - interval '60 days' and current_date - interval '31 days'
      and (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id),0)) > 0
  ) as delinquency_31_60,
  (select count(*) from public.charges c
     join public.units u on u.id = c.unit_id
     join public.buildings b on b.id = u.building_id
     join public.associations a on a.id = b.association_id
    where a.portfolio_id = p.id
      and c.due_date < current_date - interval '60 days'
      and (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id),0)) > 0
  ) as delinquency_61_plus,
  (select count(*) from public.work_orders w where w.portfolio_id = p.id and w.archived_at is null and w.status = 'new') as wo_new,
  (select count(*) from public.work_orders w where w.portfolio_id = p.id and w.archived_at is null and w.status = 'assigned') as wo_assigned,
  (select count(*) from public.work_orders w where w.portfolio_id = p.id and w.archived_at is null and w.status = 'scheduled') as wo_scheduled,
  (select count(*) from public.work_orders w where w.portfolio_id = p.id and w.archived_at is null and w.status = 'in_progress') as wo_in_progress,
  (select count(*) from public.work_orders w where w.portfolio_id = p.id and w.archived_at is null and w.status = 'completed') as wo_completed,
  (select count(*) from public.work_orders w where w.portfolio_id = p.id and w.archived_at is null) as wo_total,
  (select count(*) from public.approval_requests ar where ar.portfolio_id = p.id and ar.status = 'pending') as pending_approvals,
  (select count(*) from public.income_recertifications r
    where r.portfolio_id = p.id and r.status not in ('approved','rejected') and r.due_date <= current_date + interval '30 days') as upcoming_recerts,
  (select count(*) from public.v_insurance_expirations ie where ie.portfolio_id = p.id) as insurance_expirations_60d,
  (select count(*) from public.data_diagnostics d where d.portfolio_id = p.id and d.resolved_at is null) as open_diagnostics,
  (select count(*) from public.payable_bills pb where pb.portfolio_id = p.id and pb.archived_at is null
    and pb.status in ('pending_approval','approved') and pb.paid_at is null) as outstanding_bills,
  case
    when (select count(*) from public.units u
          join public.buildings b on b.id = u.building_id
          join public.associations a on a.id = b.association_id
          where a.portfolio_id = p.id and u.archived_at is null) = 0
    then 0::numeric
    else (100.0 * (select count(*) from public.occupancies occ
                   join public.units u on u.id = occ.unit_id
                   join public.buildings b on b.id = u.building_id
                   join public.associations a on a.id = b.association_id
                   where a.portfolio_id = p.id and occ.status = 'current')
          / nullif((select count(*) from public.units u
                    join public.buildings b on b.id = u.building_id
                    join public.associations a on a.id = b.association_id
                    where a.portfolio_id = p.id and u.archived_at is null), 0))::numeric(5,2)
  end as occupancy_pct
from public.portfolios p;;
