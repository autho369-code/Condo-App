-- Collections worked from the wrong dates and amounts:
--  * delinquent_units flagged any unit with a positive balance (even when the
--    only open charge was not yet due) and took oldest_due from every past
--    charge, paid ones included, so a one-month-late owner looked hundreds of
--    days past due and could be walked straight to the attorney step. It now
--    uses only open charges already past due (association-local date), and
--    the balance is that past-due amount net of any unapplied credit.
--  * v_homeowner_ledgers counted open past-due charges from payments.charge_id,
--    which app-recorded receipts never set; it now uses payment_applications.
--  * sync_owner_delinquency_cases reopened a resolved case at its old step and
--    kept a seller's legal stage after a sale. A reopened case, or one whose
--    owner changed, now starts again at step 0 with no legal review.

create or replace view public.delinquent_units with (security_invoker = true) as
select ub.unit_id,
       ub.unit_number,
       ub.building_id,
       ub.association_id,
       least(ub.balance, pd.past_due) as balance,
       pd.oldest_due
  from public.unit_balances ub
  join lateral (
    select sum(vcb.balance_due) as past_due, min(vcb.due_date) as oldest_due
      from public.v_charge_balances vcb
     where vcb.unit_id = ub.unit_id
       and vcb.balance_due > 0
       and vcb.due_date < public.association_local_date(ub.association_id)
  ) pd on true
 where ub.balance > 0
   and pd.oldest_due is not null
   and least(ub.balance, pd.past_due) > 0;

create or replace view public.v_homeowner_ledgers with (security_invoker = true) as
select o.id as owner_id,
       o.full_name as owner_name,
       o.email,
       a.portfolio_id,
       a.id as association_id,
       a.name as association_name,
       u.id as unit_id,
       u.unit_number,
       (select coalesce(sum(c.amount), 0::numeric) from public.charges c where c.unit_id = u.id) as lifetime_charges,
       (select coalesce(sum(p.amount), 0::numeric) from public.payments p where p.unit_id = u.id) as lifetime_payments,
       coalesce(ub.balance, 0::numeric) as current_balance,
       (select count(*) from public.v_charge_balances vcb
         where vcb.unit_id = u.id
           and vcb.balance_due > 0
           and vcb.due_date < public.association_local_date(a.id)) as open_past_due_count
  from public.owners o
  join public.occupancies occ on occ.owner_id = o.id and occ.status = 'current'::occupancy_status
  join public.units u on u.id = occ.unit_id
  join public.buildings b on b.id = u.building_id
  join public.associations a on a.id = b.association_id
  left join public.unit_balances ub on ub.unit_id = u.id
 where o.archived_at is null and u.archived_at is null;

create or replace function public.sync_owner_delinquency_cases(p_portfolio_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  synced_count integer := 0;
  cured_count integer := 0;
begin
  if not (public.can_access_portfolio(p_portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())) then
    raise exception 'Not authorized to synchronize delinquency cases';
  end if;

  insert into public.delinquency_cases (
    portfolio_id, association_id, policy_id, unit_id, owner_id,
    status, balance_snapshot, oldest_due_date, last_synced_at
  )
  select
    p_portfolio_id,
    due.association_id,
    policy.id,
    due.unit_id,
    ownership.owner_id,
    'open',
    due.balance,
    due.oldest_due,
    now()
  from public.delinquent_units due
  join public.associations association on association.id = due.association_id
  left join public.delinquency_policies policy
    on policy.association_id = due.association_id and policy.active
  left join lateral (
    select unit_owner.owner_id
    from public.unit_owners unit_owner
    where unit_owner.unit_id = due.unit_id and unit_owner.end_date is null
    order by unit_owner.is_primary desc, unit_owner.start_date desc
    limit 1
  ) ownership on true
  where association.portfolio_id = p_portfolio_id
    and due.unit_id is not null
    and due.balance >= coalesce(policy.minimum_balance, 0)
  on conflict (unit_id) do update
    set association_id = excluded.association_id,
        policy_id = excluded.policy_id,
        owner_id = excluded.owner_id,
        balance_snapshot = excluded.balance_snapshot,
        oldest_due_date = excluded.oldest_due_date,
        last_synced_at = now(),
        resolved_at = null,
        -- A case that was resolved, or whose owner changed (a sale), starts over.
        status = case
          when delinquency_cases.status = 'resolved'
            or (delinquency_cases.owner_id is not null and excluded.owner_id is distinct from delinquency_cases.owner_id)
          then 'open' else delinquency_cases.status end,
        current_step_number = case
          when delinquency_cases.status = 'resolved'
            or (delinquency_cases.owner_id is not null and excluded.owner_id is distinct from delinquency_cases.owner_id)
          then 0 else delinquency_cases.current_step_number end,
        next_action_at = case
          when delinquency_cases.status = 'resolved'
            or (delinquency_cases.owner_id is not null and excluded.owner_id is distinct from delinquency_cases.owner_id)
          then null else delinquency_cases.next_action_at end,
        hold_reason = case
          when delinquency_cases.status = 'resolved'
            or (delinquency_cases.owner_id is not null and excluded.owner_id is distinct from delinquency_cases.owner_id)
          then null else delinquency_cases.hold_reason end,
        legal_reviewed_at = case
          when delinquency_cases.status = 'resolved'
            or (delinquency_cases.owner_id is not null and excluded.owner_id is distinct from delinquency_cases.owner_id)
          then null else delinquency_cases.legal_reviewed_at end,
        legal_reviewed_by = case
          when delinquency_cases.status = 'resolved'
            or (delinquency_cases.owner_id is not null and excluded.owner_id is distinct from delinquency_cases.owner_id)
          then null else delinquency_cases.legal_reviewed_by end,
        legal_review_note = case
          when delinquency_cases.status = 'resolved'
            or (delinquency_cases.owner_id is not null and excluded.owner_id is distinct from delinquency_cases.owner_id)
          then null else delinquency_cases.legal_review_note end;
  get diagnostics synced_count = row_count;

  with cured as (
    update public.delinquency_cases case_record
    set status = 'resolved', resolved_at = now(), balance_snapshot = 0, last_synced_at = now()
    where case_record.portfolio_id = p_portfolio_id
      and case_record.status not in ('resolved', 'closed')
      and not exists (
        select 1
        from public.delinquent_units due
        left join public.delinquency_policies policy
          on policy.association_id = due.association_id and policy.active
        where due.unit_id = case_record.unit_id
          and due.balance >= coalesce(policy.minimum_balance, 0)
      )
    returning case_record.id
  ), logged as (
    insert into public.delinquency_case_events (case_id, event_type, balance_snapshot, note)
    select id, 'balance_cured', 0, 'Resolved after ledger sync confirmed no qualifying overdue balance.'
    from cured returning 1
  )
  select count(*) into cured_count from logged;

  return jsonb_build_object('synced', synced_count, 'cured', cured_count);
end;
$function$;

-- Refresh open cases with the corrected dates and amounts.
update public.delinquency_cases dc
   set oldest_due_date = du.oldest_due, balance_snapshot = du.balance
  from public.delinquent_units du
 where du.unit_id = dc.unit_id
   and dc.status not in ('resolved', 'closed')
   and (dc.oldest_due_date is distinct from du.oldest_due or dc.balance_snapshot is distinct from du.balance);
