-- Review fixes for CSV imports:
-- * an association or vendor name that matches more than one record is a row
--   error (use the id) instead of silently picking one;
-- * amounts with more than two decimals are rejected, not silently rounded;
-- * invoice numbers compare case/space-insensitively (lower(trim)), like the
--   vendor invoice flow, in the file and against existing bills;
-- * the vendor+invoice key is locked (same advisory key as
--   submit_vendor_invoice) before the duplicate check, so concurrent uploads
--   cannot both create the same invoice.

create or replace function public.csv_association_matches(p_pid uuid, p_value text)
returns integer language sql stable security definer set search_path = pg_catalog, public as $$
  select case when btrim(coalesce(p_value, '')) ~* '^[0-9a-f-]{36}$' then 1
    else (select count(*)::int from public.associations a
           where a.portfolio_id = p_pid and a.archived_at is null and lower(a.name) = lower(btrim(p_value))) end;
$$;
revoke all on function public.csv_association_matches(uuid, text) from public, anon, authenticated;

create or replace function public.import_journal_entry_batch(p_name text, p_rows jsonb)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.current_portfolio_id();
  v_errors text[] := '{}';
  r jsonb;
  v_row int;
  v_assoc uuid;
  v_gl uuid;
  v_debit numeric;
  v_credit numeric;
  v_date date;
  v_batch uuid;
  v_entry uuid;
  e record;
  v_entries int := 0;
  v_total numeric := 0;
  v_matches int;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'The file has no rows' using errcode = '22023'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception 'Upload at most 5,000 lines at a time' using errcode = '22023'; end if;

  create temp table if not exists _je_rows (row_no int, entry_key text, entry_date date, association_id uuid, gl_account_id uuid,
                              debit numeric, credit numeric, memo text) on commit drop;
  delete from _je_rows;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_row := coalesce((r->>'row')::int, 0);
    v_assoc := public.csv_association_id(v_pid, r->>'association');
    v_matches := public.csv_association_matches(v_pid, r->>'association');
    v_gl := null; v_date := null; v_debit := null; v_credit := null;
    begin v_date := (r->>'date')::date; exception when others then v_date := null; end;
    begin v_debit := coalesce(nullif(regexp_replace(coalesce(r->>'debit', ''), '[$,\s]', '', 'g'), '')::numeric, 0);
          v_credit := coalesce(nullif(regexp_replace(coalesce(r->>'credit', ''), '[$,\s]', '', 'g'), '')::numeric, 0);
    exception when others then v_debit := null; end;
    if coalesce(btrim(r->>'entry'), '') = '' then v_errors := v_errors || format('Row %s: entry is required (rows with the same entry form one journal entry)', v_row); end if;
    if v_date is null then v_errors := v_errors || format('Row %s: date must be YYYY-MM-DD', v_row); end if;
    if v_matches > 1 then v_errors := v_errors || format('Row %s: more than one association is named "%s" — use its id instead', v_row, r->>'association');
    elsif v_assoc is null then v_errors := v_errors || format('Row %s: association "%s" not found', v_row, coalesce(r->>'association', ''));
    elsif not public.can_access_association(v_assoc) then v_errors := v_errors || format('Row %s: you do not manage that association', v_row);
    else
      v_gl := public.csv_gl_id(v_pid, v_assoc, r->>'gl');
      if v_gl is null then v_errors := v_errors || format('Row %s: GL account "%s" not found for that association', v_row, coalesce(r->>'gl', '')); end if;
    end if;
    if v_debit is not null and (scale(v_debit) > 2 or scale(v_credit) > 2) then
      v_errors := v_errors || format('Row %s: amounts can have at most two decimals', v_row);
    end if;
    if v_debit is null then v_errors := v_errors || format('Row %s: debit/credit must be numbers', v_row);
    elsif v_debit < 0 or v_credit < 0 or (v_debit > 0) = (v_credit > 0) then
      v_errors := v_errors || format('Row %s: enter either a debit or a credit (positive), not both', v_row);
    end if;
    insert into _je_rows values (v_row, btrim(r->>'entry'), v_date, v_assoc, v_gl, v_debit, v_credit, nullif(btrim(r->>'memo'), ''));
  end loop;

  if cardinality(v_errors) = 0 then
    for e in
      select entry_key, count(distinct entry_date) dates, sum(debit) d, sum(credit) c, count(*) n
        from _je_rows group by entry_key
    loop
      if e.dates > 1 then v_errors := v_errors || format('Entry "%s": all its lines need the same date', e.entry_key); end if;
      if e.n < 2 then v_errors := v_errors || format('Entry "%s": needs at least two lines', e.entry_key); end if;
      if round(e.d, 2) <> round(e.c, 2) then
        v_errors := v_errors || format('Entry "%s": debits %s do not equal credits %s', e.entry_key, e.d, e.c);
      end if;
    end loop;
  end if;
  if cardinality(v_errors) > 0 then
    return jsonb_build_object('ok', false, 'errors', to_jsonb(v_errors[1:50]), 'error_count', cardinality(v_errors));
  end if;

  insert into public.journal_entry_batches (portfolio_id, name, status, total_entries, total_debit, total_credit, created_by)
  values (v_pid, coalesce(nullif(btrim(p_name), ''), 'Upload ' || to_char(now(), 'YYYY-MM-DD HH24:MI')), 'validated',
          (select count(distinct entry_key) from _je_rows), (select sum(debit) from _je_rows), (select sum(credit) from _je_rows), auth.uid())
  returning id into v_batch;

  for e in select entry_key, min(entry_date) entry_date, string_agg(distinct memo, '; ') memo from _je_rows group by entry_key order by min(row_no) loop
    insert into public.journal_entries (portfolio_id, entry_date, reference_number, memo, description, source_type, created_by, posted, batch_id)
    values (v_pid, e.entry_date, left(e.entry_key, 60), left(e.memo, 500), left(coalesce(e.memo, e.entry_key), 500), 'je_batch', auth.uid(), false, v_batch)
    returning id into v_entry;
    insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
    select v_entry, gl_account_id, association_id, debit, credit, memo, row_number() over (order by row_no) - 1
      from _je_rows where entry_key = e.entry_key;
    update public.journal_entries set posted = true where id = v_entry;  -- balance + closed-period checks run here
    v_entries := v_entries + 1;
  end loop;

  update public.journal_entry_batches set status = 'posted', posted_at = now(), posted_by = auth.uid(), updated_at = now() where id = v_batch;
  select sum(debit) into v_total from _je_rows;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'journal_entry_batch', v_batch, 'uploaded', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('entries', v_entries, 'total', v_total));
  return jsonb_build_object('ok', true, 'batch_id', v_batch, 'entries', v_entries, 'total', v_total);
end $$;

create or replace function public.import_bills(p_rows jsonb)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.current_portfolio_id();
  v_errors text[] := '{}';
  r jsonb;
  v_row int;
  v_vendor uuid;
  v_assoc uuid;
  v_gl uuid;
  v_amount numeric;
  v_bill_date date;
  v_due date;
  v_ids uuid[] := '{}';
  v_total numeric := 0;
  t record;
  v_matches int;
  v_vendor_matches int;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'The file has no rows' using errcode = '22023'; end if;
  if jsonb_array_length(p_rows) > 1000 then raise exception 'Upload at most 1,000 bills at a time' using errcode = '22023'; end if;

  create temp table if not exists _bill_rows (row_no int, vendor_id uuid, association_id uuid, gl_account_id uuid, bill_number text,
                                bill_date date, due_date date, amount numeric, memo text) on commit drop;
  delete from _bill_rows;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_row := coalesce((r->>'row')::int, 0);
    select v.id into v_vendor from public.vendors v
     where v.portfolio_id = v_pid and v.archived_at is null
       and (v.id::text = btrim(coalesce(r->>'vendor', '')) or lower(v.name) = lower(btrim(coalesce(r->>'vendor', ''))))
     order by (v.id::text = btrim(coalesce(r->>'vendor', ''))) desc limit 1;
    select count(*) into v_vendor_matches from public.vendors v
     where v.portfolio_id = v_pid and v.archived_at is null and lower(v.name) = lower(btrim(coalesce(r->>'vendor', '')));
    v_assoc := public.csv_association_id(v_pid, r->>'association');
    v_matches := public.csv_association_matches(v_pid, r->>'association');
    v_gl := null; v_bill_date := null; v_due := null; v_amount := null;
    begin v_bill_date := (r->>'bill_date')::date; exception when others then v_bill_date := null; end;
    begin v_due := nullif(btrim(coalesce(r->>'due_date', '')), '')::date; exception when others then v_due := '0001-01-01'; end;
    begin v_amount := nullif(regexp_replace(coalesce(r->>'amount', ''), '[$,\s]', '', 'g'), '')::numeric; exception when others then v_amount := null; end;
    if v_vendor_matches > 1 and btrim(coalesce(r->>'vendor', '')) !~* '^[0-9a-f-]{36}$' then
      v_errors := v_errors || format('Row %s: more than one vendor is named "%s" — use its id instead', v_row, r->>'vendor');
    elsif v_vendor is null then v_errors := v_errors || format('Row %s: vendor "%s" not found', v_row, coalesce(r->>'vendor', '')); end if;
    if v_matches > 1 then v_errors := v_errors || format('Row %s: more than one association is named "%s" — use its id instead', v_row, r->>'association');
    elsif v_assoc is null then v_errors := v_errors || format('Row %s: association "%s" not found', v_row, coalesce(r->>'association', ''));
    elsif not public.can_access_association(v_assoc) then v_errors := v_errors || format('Row %s: you do not manage that association', v_row);
    else
      v_gl := public.csv_gl_id(v_pid, v_assoc, r->>'gl');
      if v_gl is null then v_errors := v_errors || format('Row %s: GL account "%s" not found for that association', v_row, coalesce(r->>'gl', '')); end if;
    end if;
    if v_bill_date is null then v_errors := v_errors || format('Row %s: bill_date must be YYYY-MM-DD', v_row); end if;
    if v_due = '0001-01-01' then v_errors := v_errors || format('Row %s: due_date must be YYYY-MM-DD or blank', v_row); end if;
    if v_amount is null or v_amount <= 0 then v_errors := v_errors || format('Row %s: amount must be a positive number', v_row);
    elsif scale(v_amount) > 2 then v_errors := v_errors || format('Row %s: amount can have at most two decimals', v_row); end if;
    if v_bill_date is not null and v_due is not null and v_due <> '0001-01-01' and v_due < v_bill_date then
      v_errors := v_errors || format('Row %s: due_date is before bill_date', v_row);
    end if;
    insert into _bill_rows values (v_row, v_vendor, v_assoc, v_gl, nullif(btrim(r->>'bill_number'), ''), v_bill_date,
                                   nullif(v_due, '0001-01-01'), v_amount, nullif(btrim(r->>'memo'), ''));
  end loop;

  if cardinality(v_errors) = 0 then
    -- Same lock key as submit_vendor_invoice, so concurrent uploads / portal
    -- submissions of one invoice serialize before the duplicate check.
    for t in select distinct vendor_id, lower(btrim(bill_number)) as bn from _bill_rows where bill_number is not null order by 1, 2 loop
      perform pg_advisory_xact_lock(hashtextextended(t.vendor_id::text || ':' || t.bn, 0));
    end loop;
    for t in select b.row_no, b.bill_number from _bill_rows b
              where b.bill_number is not null and exists (
                select 1 from public.payable_bills pb
                 where pb.vendor_id = b.vendor_id and lower(btrim(pb.bill_number)) = lower(btrim(b.bill_number)) and pb.archived_at is null
                   and pb.status <> 'void'::public.payable_bill_status) loop
      v_errors := v_errors || format('Row %s: bill %s from this vendor is already entered', t.row_no, t.bill_number);
    end loop;
    for t in select min(b.row_no) as row_no, min(b.bill_number) as bill_number from _bill_rows b where b.bill_number is not null
              group by b.vendor_id, lower(btrim(b.bill_number)) having count(*) > 1 loop
      v_errors := v_errors || format('Row %s: bill %s appears more than once for the same vendor in this file', t.row_no, t.bill_number);
    end loop;
  end if;
  if cardinality(v_errors) > 0 then
    return jsonb_build_object('ok', false, 'errors', to_jsonb(v_errors[1:50]), 'error_count', cardinality(v_errors));
  end if;

  for t in select * from _bill_rows order by row_no loop
    v_ids := v_ids || public.create_payable_bill(v_pid, t.vendor_id, t.association_id, t.gl_account_id, null,
                                                 t.bill_number, t.bill_date, coalesce(t.due_date, t.bill_date), t.amount, t.memo, false, false);
    v_total := v_total + t.amount;
  end loop;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'payable_bill', null, 'bills_uploaded', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('count', cardinality(v_ids), 'total', v_total));
  return jsonb_build_object('ok', true, 'count', cardinality(v_ids), 'total', v_total);
end $$;

