-- Receivables audit fixes (functions only; copied from the live definitions
-- and changed minimally).
--
-- 1. bulk_create_recurring_charges: a new subscription now ends the unit's
--    existing active subscription for the same charge category, so a dues
--    increase entered through the bulk tool no longer bills the unit twice.
--    The old schedule ends the day before the new one starts (it stays
--    active so periods before that date still post; post_unit_recurring_charges
--    honours end_date). A schedule that would not start until on/after the new
--    start date is deactivated. Every permission check is unchanged.
-- 2. void_other_receipt: refuses to void a receipt that is on a bank deposit.

create or replace function public.bulk_create_recurring_charges(p_subscriptions jsonb, p_charge_category_id uuid default null::uuid, p_frequency text default 'monthly'::text, p_start_date date default null::date, p_memo text default null::text)
 returns table(inserted_count integer, subscription_ids uuid[])
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  sub record;
  new_ids uuid[] := '{}';
  new_id uuid;
  cnt integer := 0;
  v_portfolio uuid;
  v_cat_id uuid;
  v_freq public.recurring_frequency;
  v_row_freq public.recurring_frequency;
  v_start date;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_subscriptions is null or jsonb_typeof(p_subscriptions) <> 'array' or jsonb_array_length(p_subscriptions) = 0 then
    raise exception 'No subscriptions supplied' using errcode = '22023';
  end if;
  if jsonb_array_length(p_subscriptions) > 5000 then
    raise exception 'At most 5000 subscriptions per batch' using errcode = '22023';
  end if;
  begin
    v_freq := coalesce(p_frequency, 'monthly')::public.recurring_frequency;
  exception when others then
    raise exception 'Invalid frequency: %', p_frequency using errcode = '22023';
  end;

  for sub in
    select * from jsonb_to_recordset(p_subscriptions)
      as x(unit_id uuid, amount numeric, charge_category_id uuid, frequency text, start_date date, memo text)
  loop
    v_portfolio := public.unit_portfolio_id(sub.unit_id);
    if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
      raise exception 'Permission denied for unit %', sub.unit_id using errcode = '42501';
    end if;
    if sub.amount is null or sub.amount <= 0 or sub.amount > 10000000 then
      raise exception 'Recurring amount must be positive' using errcode = '22023';
    end if;
    v_cat_id := coalesce(sub.charge_category_id, p_charge_category_id);
    if v_cat_id is null or not exists (
      select 1 from public.charge_categories c
       where c.id = v_cat_id and c.portfolio_id = v_portfolio and c.active and c.archived_at is null
    ) then
      raise exception 'Charge category is outside this portfolio or inactive' using errcode = '42501';
    end if;

    v_row_freq := v_freq;
    if sub.frequency is not null then
      begin
        v_row_freq := sub.frequency::public.recurring_frequency;
      exception when others then
        raise exception 'Invalid frequency: %', sub.frequency using errcode = '22023';
      end;
    end if;
    v_start := coalesce(sub.start_date, p_start_date, current_date);

    -- End the unit's current schedule for this category the day before the
    -- new one starts, so the unit is never billed by both.
    update public.unit_recurring_charges
       set end_date = greatest(start_date, v_start - 1),
           active = coalesce(start_date < v_start and next_post_date <= v_start - 1, false),
           updated_at = now()
     where unit_id = sub.unit_id
       and charge_category_id = v_cat_id
       and active
       and (end_date is null or end_date >= v_start);

    insert into public.unit_recurring_charges (
      unit_id, charge_category_id, amount, frequency, start_date, next_post_date, memo, active, created_by
    ) values (
      sub.unit_id, v_cat_id, round(sub.amount, 2), v_row_freq, v_start, v_start,
      left(coalesce(nullif(btrim(sub.memo), ''), nullif(btrim(p_memo), '')), 500), true, auth.uid()
    ) returning id into new_id;

    new_ids := array_append(new_ids, new_id);
    cnt := cnt + 1;
  end loop;

  return query select cnt, new_ids;
end;
$function$;

create or replace function public.void_other_receipt(p_receipt_id uuid, p_reason text)
 returns void
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  r public.other_receipts;
  v_entry uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Sign in to void receipts' using errcode = '42501';
  end if;
  select * into r from public.other_receipts where id = p_receipt_id for update;
  if r.id is null then
    raise exception 'Receipt not found';
  end if;
  if not ((public.can_manage_finance(r.portfolio_id) and public.can_manage_association(r.association_id))
          or public.is_platform_operator()) then
    raise exception 'You do not have accounting access to this association' using errcode = '42501';
  end if;
  if r.voided_at is not null then
    raise exception 'This receipt is already void';
  end if;
  if r.bank_deposit_id is not null then
    raise exception 'This receipt is on a bank deposit. Remove it from its bank deposit first.' using errcode = '55000';
  end if;
  if v_reason is null then
    raise exception 'Enter a reason for voiding';
  end if;

  insert into public.journal_entries (portfolio_id, entry_date, reference_number, description, memo, source_type, source_id, posted, created_by)
  values (r.portfolio_id, current_date, 'VOID-' || coalesce(r.reference, left(r.id::text, 8)),
          'Void: receipt from ' || left(r.payer_name, 150), left(v_reason, 1000), 'other_receipt_void', r.id, false, auth.uid())
  returning id into v_entry;
  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
  select v_entry, jl.gl_account_id, jl.association_id, jl.credit_amount, jl.debit_amount, 'Void: ' || coalesce(jl.memo, ''), jl.sort_order
    from public.journal_lines jl where jl.entry_id = r.journal_entry_id;
  update public.journal_entries set posted = true, posted_at = now() where id = v_entry;

  update public.other_receipts
     set voided_at = now(), voided_by = auth.uid(), void_reason = left(v_reason, 500), void_journal_entry_id = v_entry
   where id = r.id;
end $function$;
