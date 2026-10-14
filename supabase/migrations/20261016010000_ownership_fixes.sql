-- Ownership fixes (sale and move-out).
--
-- 1. A sale can't be recorded before it closes: change_unit_homeowner and
--    transfer_unit_ownership refuse a transfer date later than the
--    association's local today (a future date ended the seller at once,
--    made the buyer current and cancelled the seller's AutoPay early).
-- 2. Statements go to the owner(s) of record during the period, not to
--    whoever is current when the job runs: generate_owner_statements picks
--    every owner occupancy that overlaps the period, generate_monthly_statements
--    one owner per unit (the primary one when several overlap). An owner who
--    left during the period is stated as of their last day.
-- 3. When an owner's occupancy ends (sale, move-out, the nightly move-out
--    job, an import), their parking assignments on that unit end, the
--    assignment's parking charge stops, and their pets on that unit are
--    archived. Only the charge linked to the assignment is touched; dues
--    and other recurring charges are not.
-- 4. A buyer can't read the seller's paid charges or statements through the
--    API: charges_resident_read admits a charge dated in the owner's own
--    ownership period, or one still open (the debt stays with the unit);
--    statements_resident_read admits the owner's own statements and their
--    current unit's from their move-in month on (co-owners), not the seller's.
-- 5. "Today" for ending occupancies and syncing unit_owners is the
--    association's local date, not UTC.
--
-- Every replaced function body is the live definition (pg_get_functiondef,
-- 2026-10-14) with only the changes above. Additive: no DROP, no DELETE.

-- 1 + 3. transfer_unit_ownership ----------------------------------------------
create or replace function public.transfer_unit_ownership(p_unit_id uuid, p_new_owner_id uuid, p_transfer_date date)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_association_id uuid;
  v_portfolio_id uuid;
  v_owner_portfolio_id uuid;
  v_share numeric;
  v_ended integer := 0;
begin
  if p_unit_id is null or p_new_owner_id is null or p_transfer_date is null then
    raise exception 'Unit, new owner and transfer date are required.' using errcode = '22023';
  end if;

  select b.association_id, a.portfolio_id
    into v_association_id, v_portfolio_id
  from public.units u
  join public.buildings b on b.id = u.building_id
  join public.associations a on a.id = b.association_id
  where u.id = p_unit_id and u.archived_at is null;

  if v_association_id is null then
    raise exception 'Unit not found.' using errcode = 'P0002';
  end if;

  if not public.can_manage_association(v_association_id)
     or not public.can_access_portfolio(v_portfolio_id) then
    raise exception 'You are not authorized to manage this unit.' using errcode = '42501';
  end if;

  -- ownership_fixes: a sale takes effect on its closing date, so it can't be
  -- recorded before then (the association's local today).
  if p_transfer_date > public.association_local_date(v_association_id) then
    raise exception 'The transfer date can''t be in the future. Record the sale on or after its closing date.' using errcode = '22023';
  end if;

  select ow.portfolio_id into v_owner_portfolio_id
  from public.owners ow
  where ow.id = p_new_owner_id and ow.archived_at is null;

  if v_owner_portfolio_id is null or v_owner_portfolio_id <> v_portfolio_id then
    raise exception 'The new owner does not belong to this unit''s portfolio.' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.occupancies o
    where o.unit_id = p_unit_id
      and o.occupancy_type = 'owner'
      and o.status = 'current'
      and o.owner_id is distinct from p_new_owner_id
      and o.move_in_date > p_transfer_date
  ) then
    raise exception 'The transfer date is before the previous owner''s move-in date.' using errcode = '22023';
  end if;

  perform 1 from public.units where id = p_unit_id for update;

  -- Ending the seller's occupancy fires end_owner_unit_items_when_occupancy_ends
  -- (parking, parking charge, pets) and cancel_autopay_when_occupancy_ends.
  update public.occupancies o
     set status = 'past',
         move_out_date = p_transfer_date,
         is_primary = false
   where o.unit_id = p_unit_id
     and o.occupancy_type = 'owner'
     and o.status = 'current'
     and o.owner_id is distinct from p_new_owner_id;
  get diagnostics v_ended = row_count;

  update public.unit_owners uo
     set end_date = greatest(p_transfer_date, uo.start_date)
   where uo.unit_id = p_unit_id
     and uo.end_date is null
     and uo.owner_id <> p_new_owner_id;

  update public.occupancies o
     set is_primary = true
   where o.unit_id = p_unit_id
     and o.owner_id = p_new_owner_id
     and o.occupancy_type = 'owner'
     and o.status = 'current';

  select coalesce(max(o.share_pct), 100) into v_share
  from public.occupancies o
  where o.unit_id = p_unit_id and o.owner_id = p_new_owner_id
    and o.occupancy_type = 'owner' and o.status = 'current';

  insert into public.unit_owners (unit_id, owner_id, is_primary, share_pct, start_date, end_date)
  values (p_unit_id, p_new_owner_id, true, v_share, p_transfer_date, null)
  on conflict (unit_id, owner_id) do update
     set is_primary = true,
         share_pct = excluded.share_pct,
         start_date = excluded.start_date,
         end_date = null;

  return v_ended;
end;
$function$;

-- 1. change_unit_homeowner ---------------------------------------------------
create or replace function public.change_unit_homeowner(p_unit_id uuid, p_new_owner_id uuid, p_transfer_date date)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_association_id uuid;
  v_portfolio_id uuid;
  v_owner_portfolio_id uuid;
  v_dues numeric;
  v_frequency public.recurring_frequency;
begin
  if p_unit_id is null or p_new_owner_id is null or p_transfer_date is null then
    raise exception 'Unit, new owner and transfer date are required.' using errcode = '22023';
  end if;

  select b.association_id, a.portfolio_id
    into v_association_id, v_portfolio_id
  from public.units u
  join public.buildings b on b.id = u.building_id
  join public.associations a on a.id = b.association_id
  where u.id = p_unit_id and u.archived_at is null;

  if v_association_id is null then
    raise exception 'Unit not found.' using errcode = 'P0002';
  end if;

  if not public.can_manage_association(v_association_id)
     or not public.can_access_portfolio(v_portfolio_id) then
    raise exception 'You are not authorized to manage this unit.' using errcode = '42501';
  end if;

  -- ownership_fixes: checked before the buyer's occupancy is created.
  if p_transfer_date > public.association_local_date(v_association_id) then
    raise exception 'The transfer date can''t be in the future. Record the sale on or after its closing date.' using errcode = '22023';
  end if;

  select ow.portfolio_id into v_owner_portfolio_id
  from public.owners ow
  where ow.id = p_new_owner_id and ow.archived_at is null;

  if v_owner_portfolio_id is null or v_owner_portfolio_id <> v_portfolio_id then
    raise exception 'The new owner does not belong to this unit''s portfolio.' using errcode = '42501';
  end if;

  perform 1 from public.units where id = p_unit_id for update;

  if not exists (
    select 1 from public.occupancies o
    where o.unit_id = p_unit_id and o.owner_id = p_new_owner_id
      and o.occupancy_type = 'owner' and o.status = 'current'
  ) then
    select o.dues_amount, o.dues_frequency
      into v_dues, v_frequency
    from public.occupancies o
    where o.unit_id = p_unit_id and o.occupancy_type = 'owner' and o.status = 'current'
    order by o.is_primary desc nulls last, o.move_in_date desc nulls last
    limit 1;

    insert into public.occupancies (
      owner_id, unit_id, association_id, occupancy_type, status,
      move_in_date, dues_amount, dues_frequency, share_pct, is_primary
    ) values (
      p_new_owner_id, p_unit_id, v_association_id, 'owner', 'current',
      p_transfer_date, coalesce(v_dues, 0), coalesce(v_frequency, 'monthly'::public.recurring_frequency), 100, false
    );
  elsif not exists (
    select 1 from public.occupancies o
    where o.unit_id = p_unit_id and o.owner_id is distinct from p_new_owner_id
      and o.occupancy_type = 'owner' and o.status = 'current'
  ) then
    raise exception 'That owner already owns this unit.' using errcode = '22023';
  end if;

  return public.transfer_unit_ownership(p_unit_id, p_new_owner_id, p_transfer_date);
end;
$function$;

-- 3. Outgoing owner's parking, parking charge and pets ------------------------
-- Fires on every writer that ends an owner occupancy (sale, move-out, the
-- nightly move-out job, imports). The day is the move-out date, or the
-- association's local today when none was entered. Nothing is deleted:
-- assignments are ended, the linked charge stops (active false, end date
-- set, as releasing a space does), pets are archived.
create or replace function public.end_owner_unit_items_when_occupancy_ends()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_day date;
  v_charge_ids uuid[];
begin
  if not (old.status = 'current' and new.status = 'past'
          and new.occupancy_type = 'owner' and new.owner_id is not null) then
    return null;
  end if;

  -- Still an owner of this unit through another current occupancy: keep.
  if exists (
    select 1 from public.occupancies o
     where o.id <> new.id
       and o.unit_id = new.unit_id
       and o.owner_id = new.owner_id
       and o.occupancy_type = 'owner'
       and o.status = 'current'
  ) then
    return null;
  end if;

  v_day := coalesce(new.move_out_date, public.association_local_date(new.association_id));

  with ended as (
    update public.parking_assignments pa
       set status = 'ended',
           end_date = greatest(v_day, pa.start_date),
           updated_at = now()
     where pa.unit_id = new.unit_id
       and pa.owner_id = new.owner_id
       and pa.status = 'active'
    returning pa.recurring_charge_id
  )
  select array_agg(recurring_charge_id) filter (where recurring_charge_id is not null)
    into v_charge_ids
    from ended;

  if v_charge_ids is not null then
    update public.unit_recurring_charges urc
       set active = false,
           end_date = greatest(v_day, urc.start_date)
     where urc.id = any (v_charge_ids)
       and urc.unit_id = new.unit_id
       and urc.active;
  end if;

  update public.unit_pets p
     set archived_at = now()
   where p.unit_id = new.unit_id
     and p.owner_id = new.owner_id
     and p.archived_at is null;

  return null;
end
$function$;

revoke all on function public.end_owner_unit_items_when_occupancy_ends() from public, anon, authenticated;

create or replace trigger trg_occupancies_end_owner_unit_items
  after update of status on public.occupancies
  for each row execute function public.end_owner_unit_items_when_occupancy_ends();

-- 5. end_occupancies_past_move_out: association-local today -------------------
create or replace function public.end_occupancies_past_move_out()
 returns integer
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare n integer;
begin
  -- ownership_fixes: a move-out date is a day in the association's calendar.
  update public.occupancies o
     set status = 'past', updated_at = now()
   where o.status = 'current'
     and o.move_out_date is not null
     and o.move_out_date <= public.association_local_date(o.association_id);
  get diagnostics n = row_count;
  return n;
end $function$;

-- 5. sync_unit_owners_from_occupancy: association-local today -----------------
create or replace function public.sync_unit_owners_from_occupancy()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_new_open boolean := false;
  v_old_open boolean := false;
  v_end date;
  v_today date;
begin
  -- ownership_fixes: "today" is the association's local date, not UTC.
  v_today := public.association_local_date(new.association_id);

  v_new_open := new.occupancy_type = 'owner'
    and new.owner_id is not null
    and new.status = 'current'
    and (new.move_out_date is null or new.move_out_date > v_today);

  if tg_op = 'UPDATE' then
    v_old_open := old.occupancy_type = 'owner'
      and old.owner_id is not null
      and old.status = 'current';
  end if;

  if v_old_open and not (
       v_new_open and new.owner_id = old.owner_id and new.unit_id = old.unit_id
     ) then
    if not exists (
      select 1 from public.occupancies o
      where o.id <> new.id
        and o.unit_id = old.unit_id
        and o.owner_id = old.owner_id
        and o.occupancy_type = 'owner'
        and o.status = 'current'
        and (o.move_out_date is null or o.move_out_date > v_today)
    ) then
      v_end := coalesce(
        case when new.unit_id = old.unit_id and new.owner_id = old.owner_id
             then new.move_out_date end,
        v_today
      );
      update public.unit_owners uo
         set end_date = greatest(v_end, uo.start_date)
       where uo.unit_id = old.unit_id
         and uo.owner_id = old.owner_id
         and uo.end_date is null;
    end if;
  end if;

  if v_new_open then
    insert into public.unit_owners (unit_id, owner_id, is_primary, share_pct, start_date, end_date)
    values (
      new.unit_id, new.owner_id, coalesce(new.is_primary, true),
      coalesce(new.share_pct, 100), coalesce(new.move_in_date, v_today), null
    )
    on conflict (unit_id, owner_id) do update
       set is_primary = excluded.is_primary,
           share_pct  = excluded.share_pct,
           start_date = case when public.unit_owners.end_date is null
                             then public.unit_owners.start_date
                             else excluded.start_date end,
           end_date   = null;
  end if;

  return null;
end;
$function$;

-- 2. generate_owner_statements: every owner of record during the period ------
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
  if not public.can_view_association_row(p_association_id) then
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

  -- ownership_fixes: the owners whose ownership overlaps the period (moved in
  -- by its last day, not moved out before its first), one statement per owner
  -- and unit, instead of whoever is current when the batch runs.
  for v_owner in
    select distinct on (occ.owner_id, occ.unit_id)
           o.id as owner_id, occ.unit_id, occ.id as occupancy_id,
           -- An owner who left during the period is stated as of their last
           -- day (the move-out day is the next owner's first), so the
           -- seller's statement leaves out the buyer's charges and payments.
           case when occ.move_out_date is not null and occ.move_out_date <= p_period_end
                then occ.move_out_date - 1 else p_period_end end as cutoff
      from public.occupancies occ
      join public.owners o on o.id = occ.owner_id
     where occ.association_id = p_association_id
       and occ.occupancy_type = 'owner'
       and o.archived_at is null
       and (occ.move_in_date is null or occ.move_in_date <= p_period_end)
       and ((occ.status = 'current'
             and (occ.move_out_date is null or occ.move_out_date > p_period_start))
            or (occ.status = 'past'
                and occ.move_out_date is not null and occ.move_out_date > p_period_start))
     order by occ.owner_id, occ.unit_id, (occ.status = 'current') desc,
              occ.move_in_date desc nulls last, occ.id
  loop
    select coalesce(sum(case when c.due_date <= v_owner.cutoff then c.amount else 0 end), 0),
           coalesce(sum(case when c.due_date < p_period_start then c.amount else 0 end), 0)
      into v_charged, v_charged_before
      from public.charges c
     where c.unit_id = v_owner.unit_id;

    select coalesce(sum(p.amount), 0) into v_paid
      from public.payments p
     where p.unit_id = v_owner.unit_id
       and p.payment_date <= v_owner.cutoff;

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

-- 2. generate_monthly_statements: the owner of record during the month -------
create or replace function public.generate_monthly_statements(p_year integer default (extract(year from (now() - '1 mon'::interval)))::integer, p_month integer default (extract(month from (now() - '1 mon'::interval)))::integer)
 returns integer
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  n_statements integer := 0;
  row record;
  period_start date;
  period_end date;
begin
  period_start := make_date(p_year, p_month, 1);
  period_end := (period_start + interval '1 month')::date;  -- exclusive

  -- ownership_fixes: one owner per unit whose ownership overlaps the month
  -- (the primary one when several do; a seller is no longer primary), instead
  -- of whoever is current and primary when the job runs.
  for row in
    select u.id as unit_id, b.association_id, occ.owner_id,
           -- opening balance: charges - payments before period_start
           coalesce((select sum(amount) from public.charges
                     where unit_id = u.id and due_date < period_start), 0)
           -
           coalesce((select sum(amount) from public.payments
                     where unit_id = u.id and payment_date < period_start), 0)
             as opening_balance,
           coalesce((select sum(amount) from public.charges
                     where unit_id = u.id and due_date >= period_start and due_date < period_end), 0)
             as total_charges,
           coalesce((select sum(amount) from public.payments
                     where unit_id = u.id and payment_date >= period_start and payment_date < period_end), 0)
             as total_payments
      from public.units u
      join public.buildings b on b.id = u.building_id
      join lateral (
        select o.owner_id
          from public.occupancies o
         where o.unit_id = u.id
           and o.occupancy_type = 'owner'
           and o.owner_id is not null
           and (o.move_in_date is null or o.move_in_date < period_end)
           and ((o.status = 'current'
                 and (o.move_out_date is null or o.move_out_date > period_start))
                or (o.status = 'past'
                    and o.move_out_date is not null and o.move_out_date > period_start))
         order by o.is_primary desc, (o.status = 'current') desc,
                  o.move_in_date desc nulls last, o.id
         limit 1
      ) occ on true
     where u.archived_at is null
  loop
    insert into public.statements (
      owner_id, unit_id, association_id, period_month, period_year,
      opening_balance, total_charges, total_payments, closing_balance
    ) values (
      row.owner_id, row.unit_id, row.association_id, p_month, p_year,
      row.opening_balance, row.total_charges, row.total_payments,
      row.opening_balance + row.total_charges - row.total_payments
    )
    on conflict do nothing;

    if found then n_statements := n_statements + 1; end if;
  end loop;

  return n_statements;
end;
$function$;

-- 4. Residents: the owner's own period for charges, own statements ----------
-- A charge of the owner's current unit dated in their ownership (on or after
-- their move-in, the association's calendar day), or one still open. Same
-- shape as resident_visible_payment_ids: one definer id set per query.
create or replace function rls_private.resident_visible_charge_ids()
 returns setof uuid
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return query
  select c.id
    from public.charges c
    join rls_private.resident_unit_tenure() t on t.unit_id = c.unit_id
   where t.since is null
      or c.due_date >= t.since
      or c.amount > coalesce((select sum(pa.amount_applied)
                                from public.payment_applications pa
                               where pa.charge_id = c.id), 0);
end
$function$;

revoke all on function rls_private.resident_visible_charge_ids() from public, anon;
grant execute on function rls_private.resident_visible_charge_ids() to authenticated;

alter policy charges_resident_read on public.charges
  using (( select public.is_portal_resident() )
         and (id in ( select rls_private.resident_visible_charge_ids() )));

-- A statement addressed to the owner, or one of their current unit for a
-- month from their move-in on (a co-owner sees the unit's statements; a
-- buyer doesn't see the seller's).
create or replace function rls_private.resident_visible_statement_ids()
 returns setof uuid
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return query
  select s.id
    from public.statements s
   where s.owner_id in (select public.current_owner_ids())
  union
  select s.id
    from public.statements s
    join rls_private.resident_unit_tenure() t on t.unit_id = s.unit_id
   where t.since is null
      or make_date(s.period_year, s.period_month, 1) >= date_trunc('month', t.since)::date;
end
$function$;

revoke all on function rls_private.resident_visible_statement_ids() from public, anon;
grant execute on function rls_private.resident_visible_statement_ids() to authenticated;

alter policy statements_resident_read on public.statements
  using (( select public.is_portal_resident() )
         and (id in ( select rls_private.resident_visible_statement_ids() )));
