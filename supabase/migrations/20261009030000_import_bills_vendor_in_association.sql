-- Bills CSV upload: match the vendor inside the row's association.
--
-- Since 20261009020000 each vendor record belongs to one association (the
-- management company is the one company-level vendor), so the same contractor
-- can have a record in several associations. import_bills matched vendor
-- names across the whole company and rejected such a row as ambiguous even
-- though its association says which record it means.
--
-- Now the row's association is resolved first and the vendor is matched by
-- name (or id) among that association's vendors plus the company's
-- management company. A vendor of another association is reported, not
-- created (the database trigger refuses it anyway). Everything else is
-- unchanged from the live definition (20260930132000).
--
-- The body clears its per-call temp table (delete from _bill_rows), so per
-- the PR rules Mirsad runs this file in the SQL editor.

create or replace function public.import_bills(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_pid uuid := public.current_portfolio_id();
  v_errors text[] := '{}';
  r jsonb;
  v_row int;
  v_vendor uuid;
  v_vendor_text text;
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
    v_vendor_text := btrim(coalesce(r->>'vendor', ''));
    v_assoc := public.csv_association_id(v_pid, r->>'association');
    v_matches := public.csv_association_matches(v_pid, r->>'association');
    v_vendor := null; v_vendor_matches := 0;
    -- The vendor is one of the row's association (or the management company).
    if v_assoc is not null and v_matches = 1 then
      select v.id into v_vendor from public.vendors v
       where v.portfolio_id = v_pid and v.archived_at is null
         and (v.association_id = v_assoc or v.is_management_company)
         and (v.id::text = v_vendor_text or lower(v.name) = lower(v_vendor_text))
       order by (v.id::text = v_vendor_text) desc limit 1;
      select count(*) into v_vendor_matches from public.vendors v
       where v.portfolio_id = v_pid and v.archived_at is null
         and (v.association_id = v_assoc or v.is_management_company)
         and lower(v.name) = lower(v_vendor_text);
    end if;
    v_gl := null; v_bill_date := null; v_due := null; v_amount := null;
    begin v_bill_date := public.csv_date(r->>'bill_date'); exception when others then v_bill_date := null; end;
    begin v_due := public.csv_date(r->>'due_date'); exception when others then v_due := '0001-01-01'; end;
    begin v_amount := public.csv_money(r->>'amount'); exception when others then v_amount := null; end;
    if v_matches > 1 then v_errors := v_errors || format('Row %s: more than one association is named "%s"; use its id instead', v_row, r->>'association');
    elsif v_assoc is null then v_errors := v_errors || format('Row %s: association "%s" not found', v_row, coalesce(r->>'association', ''));
    elsif not public.can_manage_association(v_assoc) then v_errors := v_errors || format('Row %s: you do not manage that association', v_row);
    else
      if v_vendor_matches > 1 and v_vendor_text !~* '^[0-9a-f-]{36}$' then
        v_errors := v_errors || format('Row %s: more than one vendor of that association is named "%s"; use its id instead', v_row, r->>'vendor');
      elsif v_vendor is null then
        -- Only associations the caller can see are named (a manager limited
        -- to some associations gets plain "not found" for the others).
        if exists (select 1 from public.vendors v
                    where v.portfolio_id = v_pid and v.archived_at is null
                      and public.can_view_association_row(v.association_id)
                      and (v.id::text = v_vendor_text or lower(v.name) = lower(v_vendor_text))) then
          v_errors := v_errors || format('Row %s: vendor "%s" is not a vendor of that association; add it to the association first', v_row, v_vendor_text);
        else
          v_errors := v_errors || format('Row %s: vendor "%s" not found', v_row, v_vendor_text);
        end if;
      end if;
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
end $function$;

revoke all on function public.import_bills(jsonb) from public, anon;
grant execute on function public.import_bills(jsonb) to authenticated, service_role;
