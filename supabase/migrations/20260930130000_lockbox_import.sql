-- Lockbox import (AppFolio "Lockbox"): the bank's lockbox file of homeowner
-- checks is uploaded, each check is auto-matched to a unit, staff review and
-- correct the matches, then post — every matched check becomes an office
-- receipt (method check) deposited to the batch's bank account, applied to
-- the unit's charges and posted to the ledger by the existing receipt triggers.
--
-- Matching, within the bank account's association:
--   1. unit number from the coupon / remittance column   → 95% "Unit number"
--   2. payer name = the unit's current owner (either order) → 80% "Owner name"
--   3. amount = exactly one unit's open balance            → 50% "Amount matches balance"
-- Anything else stays unmatched until staff choose the unit.

alter table public.lockbox_items
  add column if not exists row_no integer,
  add column if not exists match_reason text,
  add column if not exists memo text,
  add column if not exists post_error text,
  add column if not exists posted_at timestamptz;
alter table public.lockbox_batches
  add column if not exists association_id uuid,
  add column if not exists created_by uuid;

create or replace function public.lockbox_match_unit(p_association_id uuid, p_unit text, p_payer text, p_amount numeric,
                                                    out unit_id uuid, out owner_id uuid, out confidence numeric, out reason text)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_payer text := lower(regexp_replace(btrim(coalesce(p_payer, '')), '\s+', ' ', 'g')); v_n int;
begin
  if btrim(coalesce(p_unit, '')) <> '' then
    select count(*) into v_n from public.units u join public.buildings b on b.id = u.building_id
     where b.association_id = p_association_id and u.archived_at is null and lower(u.unit_number) = lower(btrim(p_unit));
    if v_n = 1 then
      select u.id into unit_id from public.units u join public.buildings b on b.id = u.building_id
       where b.association_id = p_association_id and u.archived_at is null and lower(u.unit_number) = lower(btrim(p_unit));
      confidence := 0.95; reason := 'Unit number';
    end if;
  end if;

  if unit_id is null and v_payer <> '' then
    select count(distinct occ.unit_id) into v_n
      from public.occupancies occ join public.owners o on o.id = occ.owner_id
     where occ.association_id = p_association_id and occ.status = 'current' and occ.occupancy_type = 'owner'
       and (lower(o.full_name) = v_payer
            or lower(coalesce(o.last_name, '') || ', ' || coalesce(o.first_name, '')) = v_payer
            or lower(coalesce(o.first_name, '') || ' ' || coalesce(o.last_name, '')) = v_payer);
    if v_n = 1 then
      select occ.unit_id into unit_id
        from public.occupancies occ join public.owners o on o.id = occ.owner_id
       where occ.association_id = p_association_id and occ.status = 'current' and occ.occupancy_type = 'owner'
         and (lower(o.full_name) = v_payer
              or lower(coalesce(o.last_name, '') || ', ' || coalesce(o.first_name, '')) = v_payer
              or lower(coalesce(o.first_name, '') || ' ' || coalesce(o.last_name, '')) = v_payer)
       limit 1;
      confidence := 0.80; reason := 'Owner name';
    end if;
  end if;

  if unit_id is null and p_amount > 0 then
    with bal as (
      select c.unit_id, sum(c.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = c.id), 0)) as open
        from public.charges c join public.units u on u.id = c.unit_id join public.buildings b on b.id = u.building_id
       where b.association_id = p_association_id and u.archived_at is null
       group by c.unit_id)
    select count(*) into v_n from bal where round(open, 2) = round(p_amount, 2);
    if v_n = 1 then
      with bal as (
        select c.unit_id, sum(c.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = c.id), 0)) as open
          from public.charges c join public.units u on u.id = c.unit_id join public.buildings b on b.id = u.building_id
         where b.association_id = p_association_id and u.archived_at is null
         group by c.unit_id)
      select bal.unit_id into unit_id from bal where round(open, 2) = round(p_amount, 2);
      confidence := 0.50; reason := 'Amount matches balance';
    end if;
  end if;

  if unit_id is not null then
    select occ.owner_id into owner_id from public.occupancies occ
     where occ.unit_id = lockbox_match_unit.unit_id and occ.status = 'current' and occ.occupancy_type = 'owner'
     order by occ.is_primary desc nulls last limit 1;
  end if;
end $$;

create or replace function public.import_lockbox_batch(p_bank_account_id uuid, p_batch_date date, p_reference text, p_rows jsonb)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.current_portfolio_id();
  v_bank record;
  v_batch uuid;
  r jsonb;
  v_amount numeric;
  v_errors text[] := '{}';
  m record;
  v_items int := 0;
  v_matched int := 0;
  v_total numeric := 0;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
  select * into v_bank from public.bank_accounts where id = p_bank_account_id and portfolio_id = v_pid and archived_at is null;
  if not found then raise exception 'Choose the bank account the lockbox deposits into' using errcode = '22023'; end if;
  if v_bank.association_id is null or not public.can_access_association(v_bank.association_id) then
    raise exception 'That bank account is not linked to an association you manage' using errcode = '22023';
  end if;
  if p_batch_date is null then raise exception 'Enter the deposit date' using errcode = '22023'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'The file has no checks' using errcode = '22023'; end if;
  if jsonb_array_length(p_rows) > 2000 then raise exception 'Upload at most 2,000 checks at a time' using errcode = '22023'; end if;
  if nullif(btrim(p_reference), '') is not null and exists (
       select 1 from public.lockbox_batches where portfolio_id = v_pid and bank_account_id = p_bank_account_id
          and lower(deposit_reference) = lower(btrim(p_reference))) then
    raise exception 'A lockbox batch with reference % was already imported for this account', btrim(p_reference) using errcode = '23505';
  end if;

  -- Validate every amount first: a bad file is rejected with row numbers.
  for r in select * from jsonb_array_elements(p_rows) loop
    v_amount := null;
    begin v_amount := public.csv_money(r->>'amount'); exception when others then v_amount := -1; end;
    if v_amount is null or v_amount <= 0 then
      v_errors := v_errors || format('Row %s: amount "%s" is not a positive number', coalesce(r->>'row', '?'), coalesce(r->>'amount', ''));
    elsif scale(v_amount) > 2 then
      v_errors := v_errors || format('Row %s: amount has more than two decimals', coalesce(r->>'row', '?'));
    end if;
  end loop;
  if cardinality(v_errors) > 0 then
    return jsonb_build_object('ok', false, 'errors', to_jsonb(v_errors[1:50]), 'error_count', cardinality(v_errors));
  end if;

  insert into public.lockbox_batches (portfolio_id, bank_account_id, association_id, provider, batch_date, status,
                                      deposit_reference, received_at, created_by)
  values (v_pid, p_bank_account_id, v_bank.association_id, 'upload', p_batch_date, 'received',
          nullif(btrim(p_reference), ''), now(), auth.uid())
  returning id into v_batch;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_amount := public.csv_money(r->>'amount');
    select * into m from public.lockbox_match_unit(v_bank.association_id, r->>'unit', r->>'payer', v_amount);
    insert into public.lockbox_items (batch_id, portfolio_id, association_id, unit_id, owner_id, row_no, check_number,
                                      check_amount_cents, payer_name, memo, matched_confidence, match_reason,
                                      manually_matched, rejected)
    values (v_batch, v_pid, v_bank.association_id, m.unit_id, m.owner_id, nullif(r->>'row', '')::int,
            nullif(btrim(r->>'check_number'), ''), round(v_amount * 100)::bigint,
            nullif(btrim(r->>'payer'), ''), nullif(btrim(r->>'memo'), ''), m.confidence, m.reason, false, false);
    v_items := v_items + 1;
    v_total := v_total + v_amount;
    if m.unit_id is not null then v_matched := v_matched + 1; end if;
  end loop;

  update public.lockbox_batches set total_items = v_items, total_amount_cents = round(v_total * 100)::bigint, updated_at = now()
   where id = v_batch;
  return jsonb_build_object('ok', true, 'batch_id', v_batch, 'items', v_items, 'matched', v_matched, 'total', v_total);
end $$;

create or replace function public.lockbox_item_scope(p_item uuid, out batch_id uuid, out association_id uuid, out posted boolean)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  select i.batch_id, b.association_id, i.payment_id is not null into batch_id, association_id, posted
    from public.lockbox_items i join public.lockbox_batches b on b.id = i.batch_id
   where i.id = p_item and public.can_manage_finance(b.portfolio_id) and public.can_access_association(b.association_id);
  if batch_id is null then raise exception 'Lockbox item not found' using errcode = 'P0002'; end if;
  if posted then raise exception 'That check is already posted' using errcode = '22023'; end if;
end $$;

create or replace function public.match_lockbox_item(p_item uuid, p_unit_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare s record; v_owner uuid;
begin
  select * into s from public.lockbox_item_scope(p_item);
  if p_unit_id is not null and not exists (
       select 1 from public.units u join public.buildings b on b.id = u.building_id
        where u.id = p_unit_id and b.association_id = s.association_id and u.archived_at is null) then
    raise exception 'Choose a unit in this association' using errcode = '22023';
  end if;
  select occ.owner_id into v_owner from public.occupancies occ
   where occ.unit_id = p_unit_id and occ.status = 'current' and occ.occupancy_type = 'owner'
   order by occ.is_primary desc nulls last limit 1;
  update public.lockbox_items
     set unit_id = p_unit_id, owner_id = v_owner, manually_matched = true,
         matched_confidence = case when p_unit_id is null then null else 1 end,
         match_reason = case when p_unit_id is null then null else 'Chosen by staff' end,
         rejected = false, rejection_reason = null, post_error = null
   where id = p_item;
end $$;

create or replace function public.reject_lockbox_item(p_item uuid, p_reason text)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare s record;
begin
  select * into s from public.lockbox_item_scope(p_item);
  update public.lockbox_items set rejected = true, rejection_reason = coalesce(nullif(btrim(p_reason), ''), 'Rejected by staff')
   where id = p_item;
end $$;

create or replace function public.post_lockbox_batch(p_batch uuid)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  b record;
  i record;
  v_payment uuid;
  v_posted int := 0;
  v_failed int := 0;
  v_open int;
begin
  select * into b from public.lockbox_batches where id = p_batch for update;
  if not found or not public.can_manage_finance(b.portfolio_id) or not public.can_access_association(b.association_id) then
    raise exception 'Lockbox batch not found' using errcode = 'P0002';
  end if;

  for i in select * from public.lockbox_items
            where batch_id = p_batch and not rejected and payment_id is null and unit_id is not null and check_amount_cents > 0
            order by row_no nulls last, created_at
  loop
    begin
      insert into public.payments (unit_id, amount, payment_date, method, reference, notes, bank_account_id, created_by)
      values (i.unit_id, i.check_amount_cents / 100.0, b.batch_date, 'check',
              coalesce('Check ' || i.check_number, 'Lockbox check'),
              btrim(concat_ws(' · ', 'Lockbox' || coalesce(' ' || b.deposit_reference, ''), i.payer_name, i.memo)),
              b.bank_account_id, auth.uid())
      returning id into v_payment;
      update public.lockbox_items set payment_id = v_payment, posted_at = now(), post_error = null where id = i.id;
      v_posted := v_posted + 1;
    exception when others then
      update public.lockbox_items set post_error = left(sqlerrm, 300) where id = i.id;
      v_failed := v_failed + 1;
    end;
  end loop;

  select count(*) into v_open from public.lockbox_items where batch_id = p_batch and not rejected and payment_id is null;
  update public.lockbox_batches
     set status = case when v_open = 0 then 'deposited'::public.lockbox_batch_status else 'processing'::public.lockbox_batch_status end,
         deposited_at = case when v_open = 0 then coalesce(deposited_at, now()) else deposited_at end,
         updated_at = now()
   where id = p_batch;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (b.portfolio_id, 'lockbox_batch', p_batch, 'lockbox_posted', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('posted', v_posted, 'failed', v_failed, 'still_open', v_open));
  return jsonb_build_object('posted', v_posted, 'failed', v_failed, 'open', v_open);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.import_lockbox_batch(uuid, date, text, jsonb)', 'public.match_lockbox_item(uuid, uuid)',
    'public.reject_lockbox_item(uuid, text)', 'public.post_lockbox_batch(uuid)'] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  foreach f in array array['public.lockbox_match_unit(uuid, text, text, numeric)', 'public.lockbox_item_scope(uuid)'] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
