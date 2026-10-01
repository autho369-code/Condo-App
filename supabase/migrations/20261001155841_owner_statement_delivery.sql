-- Owner statements: correct the balance math and let the app record delivery.
--
-- 1. generate_owner_statements computed "past due" as every charge dated before
--    the period (ignoring payments), so a fully paid owner showed a past-due
--    amount, and "total due" was total charges ever billed. Now:
--      balance   = charges due <= period_end - payments <= period_end
--      past due  = charges due <  period_start - payments <= period_end (>= 0)
--      total due = max(balance, 0); amount due = total due - past due;
--      prepaid   = max(-balance, 0)
-- 2. mark_owner_statement_delivery records which statements were emailed
--    (staff have no UPDATE policy on owner_statements / statement_batches).
create or replace function public.generate_owner_statements(p_association_id uuid, p_period_start date, p_period_end date, p_delivery_channel text default 'email'::text, p_batch_name text default null::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_batch_id uuid;
  v_portfolio uuid;
  v_owner record;
  v_charged numeric;
  v_charged_before numeric;
  v_paid numeric;
  v_balance numeric;
  v_past_due numeric;
begin
  select a.portfolio_id into v_portfolio from public.associations a
   where a.id = p_association_id and a.archived_at is null;
  if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Enter a valid statement period' using errcode = '22023';
  end if;

  insert into public.statement_batches (
    association_id, batch_name, period_start, period_end, delivery_channel, status, created_by
  ) values (
    p_association_id,
    left(coalesce(nullif(btrim(p_batch_name), ''), 'Statement batch ' || to_char(p_period_end, 'Mon YYYY')), 200),
    p_period_start, p_period_end, p_delivery_channel, 'generating', auth.uid()
  ) returning id into v_batch_id;

  for v_owner in
    select o.id as owner_id, occ.unit_id, occ.id as occupancy_id
      from public.occupancies occ
      join public.owners o on o.id = occ.owner_id
     where occ.association_id = p_association_id
       and occ.status = 'current'
       and occ.occupancy_type = 'owner'
       and o.archived_at is null
  loop
    select coalesce(sum(case when c.due_date <= p_period_end then c.amount else 0 end), 0),
           coalesce(sum(case when c.due_date < p_period_start then c.amount else 0 end), 0)
      into v_charged, v_charged_before
      from public.charges c
     where c.unit_id = v_owner.unit_id;

    select coalesce(sum(p.amount), 0) into v_paid
      from public.payments p
     where p.unit_id = v_owner.unit_id
       and p.payment_date <= p_period_end;

    v_balance := v_charged - v_paid;
    v_past_due := greatest(v_charged_before - v_paid, 0);

    insert into public.owner_statements (
      batch_id, association_id, owner_id, unit_id, occupancy_id, period_start, period_end,
      delivery_channel, delivery_status, amount_due, amount_past_due, amount_prepaid, total_due, created_by
    ) values (
      v_batch_id, p_association_id, v_owner.owner_id, v_owner.unit_id, v_owner.occupancy_id,
      p_period_start, p_period_end, p_delivery_channel, 'pending',
      greatest(greatest(v_balance, 0) - v_past_due, 0), v_past_due, greatest(-v_balance, 0),
      greatest(v_balance, 0), auth.uid()
    );
  end loop;

  update public.statement_batches
     set total_owners = (select count(*) from public.owner_statements where batch_id = v_batch_id),
         generated_count = (select count(*) from public.owner_statements where batch_id = v_batch_id),
         status = 'generated',
         updated_at = now()
   where id = v_batch_id;

  return v_batch_id;
end;
$function$;

create or replace function public.mark_owner_statement_delivery(
  p_batch_id uuid,
  p_sent_statement_ids uuid[],
  p_failed_statement_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_portfolio uuid;
  v_sent integer;
  v_failed integer;
begin
  select a.portfolio_id into v_portfolio
    from public.statement_batches b join public.associations a on a.id = b.association_id
   where b.id = p_batch_id;
  if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  update public.owner_statements
     set delivery_status = 'queued', sent_at = now(), updated_at = now()
   where batch_id = p_batch_id and id = any(coalesce(p_sent_statement_ids, '{}'));
  get diagnostics v_sent = row_count;

  update public.owner_statements
     set delivery_status = 'failed', updated_at = now()
   where batch_id = p_batch_id and id = any(coalesce(p_failed_statement_ids, '{}'));
  get diagnostics v_failed = row_count;

  update public.statement_batches
     set sent_count = v_sent,
         failed_count = v_failed,
         status = case when v_sent = 0 and v_failed > 0 then 'failed'
                       when v_failed > 0 then 'partial'
                       else 'sent' end,
         updated_at = now()
   where id = p_batch_id;
end;
$$;

revoke all on function public.mark_owner_statement_delivery(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.mark_owner_statement_delivery(uuid, uuid[], uuid[]) to authenticated;
