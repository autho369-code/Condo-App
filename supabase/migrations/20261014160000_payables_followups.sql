-- Payables follow-ups (deep check and migration review on #359).
--
-- 1. Finance users could write recurring_bills directly (next_post_date,
--    created_by, amounts) instead of through save_recurring_bill and
--    archive_recurring_bill, which check the vendor, accounts and schedule.
--    The app only reads the table; every write function is SECURITY
--    DEFINER, so direct writes are withdrawn from signed-in users.
-- 2. Homeowner payables (pay_owner_payable) accepted any payment date, like
--    bills did before 20261014150000: now not before the payable's date and
--    at most 90 days ahead.
-- 3. A bill paid entirely by a vendor credit was marked paid at the moment
--    of the click (UTC) rather than on the association's day, like other
--    payments; the credit-date check used the UTC date too.
-- 4. The 1099 bill count included bills settled only by vendor credit
--    (nothing paid in cash); both 1099 functions now count bills with a
--    cash amount.

-- 1.
revoke insert, update, delete on public.recurring_bills from anon, authenticated;

-- 2.
do $$
declare
  v_def text := pg_get_functiondef('public.pay_owner_payable(uuid, uuid, date, text, text)'::regprocedure);
  v_old text := $o$  if p_payment_date is null then raise exception 'Choose the payment date' using errcode = '22023'; end if;$o$;
  v_new text := $n$  if p_payment_date is null then raise exception 'Choose the payment date' using errcode = '22023'; end if;
  if r.payable_date is not null and p_payment_date < r.payable_date then
    raise exception 'The payment date can''t be before the payable''s date (%)', r.payable_date using errcode = '22023';
  end if;
  if p_payment_date > coalesce(public.association_local_date(r.association_id, now()), current_date) + 90 then
    raise exception 'The payment date can be at most 90 days ahead' using errcode = '22023';
  end if;$n$;
begin
  if position('at most 90 days ahead' in v_def) > 0 then
    return;  -- already applied
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'pay_owner_payable: payment date check not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;

-- 3.
do $$
declare
  v_def text := pg_get_functiondef('public.apply_vendor_credit(uuid, uuid, numeric)'::regprocedure);
  v_parts text[][] := array[
    array[$o$  if c.credit_date > current_date then$o$,
          $n$  if c.credit_date > coalesce(public.association_local_date(c.association_id, now()), current_date) then$n$],
    array[$o$status = 'paid'::public.payable_bill_status, paid_at = now(), updated_at = now()$o$,
          $n$status = 'paid'::public.payable_bill_status,
           paid_at = (coalesce(public.association_local_date(b.association_id, now()), current_date)::timestamp + interval '12 hours') at time zone 'UTC',
           updated_at = now()$n$]
  ];
  i integer;
begin
  if position('association_local_date(b.association_id' in v_def) > 0 then
    return;  -- already applied
  end if;
  for i in 1 .. array_length(v_parts, 1) loop
    if (length(v_def) - length(replace(v_def, v_parts[i][1], ''))) / length(v_parts[i][1]) <> 1 then
      raise exception 'apply_vendor_credit: part % not found exactly once', i;
    end if;
    v_def := replace(v_def, v_parts[i][1], v_parts[i][2]);
  end loop;
  execute v_def;
end
$$;

-- 4.
do $$
declare
  v_def text := pg_get_functiondef('public.vendor_1099_totals(integer)'::regprocedure);
  v_old text := $o$         count(*)::integer$o$;
  v_new text := $n$         (count(*) filter (where pb.amount - coalesce(pb.credit_applied, 0) > 0))::integer$n$;
begin
  if position('count(*) filter' in v_def) > 0 then
    return;  -- already applied
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'vendor_1099_totals: bill count not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;

do $$
declare
  v_def text := pg_get_functiondef('public.assemble_vendor_1099_data(uuid, integer)'::regprocedure);
  v_old text := $o$        count(*) as bill_count,$o$;
  v_new text := $n$        count(*) filter (where pb.amount - coalesce(pb.credit_applied, 0) > 0) as bill_count,$n$;
begin
  if position('count(*) filter' in v_def) > 0 then
    return;  -- already applied
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'assemble_vendor_1099_data: bill count not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;
