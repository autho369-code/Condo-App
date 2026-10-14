-- Board and vendor portal fixes. Re-runnable: every function patch checks a
-- marker first and replaces an anchor that must appear exactly once.

-- 1. Vendor-entered compliance dates are claims, not official dates
--    (20261002131203_vendor_compliance_claims meant to turn the sync off, but
--    trg_vendor_compliance_sync was still enabled). Official
--    vendors.*_expiration dates change when staff approve the uploaded
--    document (review_vendor_document_request) or edit the vendor.
alter table public.vendor_compliance disable trigger trg_vendor_compliance_sync;

-- If the trigger is ever turned back on, a vendor's own save still never
-- reaches the official columns.
do $$
declare
  d text := replace(pg_get_functiondef('public.sync_vendor_compliance_to_vendor()'::regprocedure), chr(13), '');
  a text := E'begin\n  update public.vendors\n';
begin
  if position('board_vendor_fixes' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then
    raise exception 'sync_vendor_compliance_to_vendor: anchor not found exactly once';
  end if;
  execute replace(d, a, E'begin\n  -- board_vendor_fixes: a vendor''s own dates are claims for management review.\n  if public.is_self_service_caller() then return new; end if;\n  update public.vendors\n');
end $$;

-- The vendors guard no longer lets every nested write through: for a vendor
-- caller, nested writes may change only the columns the system triggers
-- running on the vendor's behalf set (invitation link, email relink, private
-- financial details), and only to the values those triggers set.
do $$
declare
  d text := replace(pg_get_functiondef('public.vendors_self_service_guard()'::regprocedure), chr(13), '');
  a text := E'  if pg_trigger_depth() > 1 or not public.is_self_service_caller() then return new; end if;\n  n := new;\n  new := old;\n';
begin
  if position('board_vendor_fixes' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then
    raise exception 'vendors_self_service_guard: anchor not found exactly once';
  end if;
  execute replace(d, a, $new$  -- board_vendor_fixes: trigger depth alone is not trusted.
  if not public.is_self_service_caller() then return new; end if;
  n := new;
  new := old;
  if pg_trigger_depth() > 1 then
    -- Linking this login to the record, or unlinking it.
    if n.auth_user_id is null or n.auth_user_id = auth.uid() then
      new.auth_user_id := n.auth_user_id;
    end if;
    if n.portal_activated then new.portal_activated := true; end if;
    -- Flags kept in step with vendor_financial_details.
    new.has_taxpayer_id := n.has_taxpayer_id;
    new.has_bank_account := n.has_bank_account;
    -- Changed bank details reset ACH to pending, never the other way.
    if n.ach_status = 'pending' and n.ach_verified_at is null and n.ach_verified_by is null
       and n.ach_activated_at is null and n.ach_activated_by is null and not coalesce(n.is_auto_pay, false) then
      new.ach_status := n.ach_status;
      new.ach_verified_at := null; new.ach_verified_by := null;
      new.ach_activated_at := null; new.ach_activated_by := null;
      new.is_auto_pay := false;
    end if;
    -- Financial fields are only ever cleared here (they live privately).
    if n.taxpayer_id is null then new.taxpayer_id := null; end if;
    if n.tax_account_number is null then new.tax_account_number := null; end if;
    if n.bank_routing_number is null then new.bank_routing_number := null; end if;
    if n.bank_account_number is null then new.bank_account_number := null; end if;
  end if;
$new$);
end $$;

-- 2. Board seats come from the linked login only, never by email match.
--    Skipped (with a notice) while any active seat still depends on it.
do $$
declare
  d text := replace(pg_get_functiondef('public.current_board_association_ids()'::regprocedure), chr(13), '');
  a text := E'\n  union\n  select bm.association_id\n  from public.board_members bm\n  join public.associations a on a.id = bm.association_id and a.archived_at is null\n  join public.profiles p on p.id = auth.uid() and p.disabled_at is null and p.hoa_role = ''board'' and p.portfolio_id = a.portfolio_id\n  join auth.users u on u.id = auth.uid() and lower(u.email) = lower(bm.email)\n  where public.is_current_identity_enabled()\n    and bm.active\n    and bm.auth_user_id is null;';
  n integer;
begin
  if position('board_vendor_fixes' in d) > 0 then return; end if;
  -- Exactly the seats the removed branch grants: active, unlinked, in a
  -- live association, matching a board login of the same company.
  select count(*) into n
    from public.board_members bm
    join public.associations a on a.id = bm.association_id and a.archived_at is null
    join auth.users u on lower(u.email) = lower(bm.email)
    join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role = 'board' and p.portfolio_id = a.portfolio_id
   where bm.active
     and bm.auth_user_id is null;
  if n > 0 then
    raise notice 'current_board_association_ids: % board seat(s) still rely on email match; branch kept', n;
    return;
  end if;
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then
    raise exception 'current_board_association_ids: anchor not found exactly once';
  end if;
  execute replace(d, a, E';\n  -- board_vendor_fixes: linked login only, never by email match.');
end $$;

-- 3. Board dashboard dates: each association's local date, not the server's.
create or replace view public.aged_receivables with (security_invoker = true) as
 SELECT c.unit_id,
    ua.unit_number,
    ua.building_name,
    ua.association_name,
    ua.association_id,
    c.id AS charge_id,
    c.description,
    c.amount,
    c.due_date,
    COALESCE(pa.paid, (0)::numeric) AS total_paid,
    (c.amount - COALESCE(pa.paid, (0)::numeric)) AS balance_due,
        CASE
            WHEN (c.due_date >= ua.local_today) THEN 'current'::text
            WHEN (c.due_date >= (ua.local_today - '30 days'::interval)) THEN '1_30'::text
            WHEN (c.due_date >= (ua.local_today - '60 days'::interval)) THEN '31_60'::text
            WHEN (c.due_date >= (ua.local_today - '90 days'::interval)) THEN '61_90'::text
            ELSE '90_plus'::text
        END AS aging_bucket
   FROM ((charges c
     JOIN LATERAL ( SELECT u.unit_number,
            b.name AS building_name,
            a.name AS association_name,
            a.id AS association_id,
            (pg_catalog.now() AT TIME ZONE COALESCE(NULLIF(a.timezone, ''), 'America/Chicago'))::date AS local_today
           FROM ((units u
             JOIN buildings b ON ((b.id = u.building_id)))
             JOIN associations a ON ((a.id = b.association_id)))
          WHERE (u.id = c.unit_id)) ua ON (true))
     LEFT JOIN LATERAL ( SELECT sum(p.amount_applied) AS paid
           FROM payment_applications p
          WHERE (p.charge_id = c.id)) pa ON (true))
  WHERE ((c.amount - COALESCE(pa.paid, (0)::numeric)) > (0)::numeric);

-- Overdue = due before the association's local today (or p_as_of when given).
-- Delinquent units = units with an overdue balance, as delinquent_units and
-- receivable_summary_by_months count them; charges not yet due don't count.
create or replace function public.receivable_summary(p_association_ids uuid[] default null, p_as_of date default null)
returns table(ar_total numeric, overdue_total numeric, delinquent_units integer, weighted_days numeric)
language sql
stable
set search_path to 'public'
as $function$
  with open_rows as (
    select r.unit_id, r.balance_due, r.due_date, r.association_id
      from public.aged_receivables r
     where (p_association_ids is null or r.association_id = any (p_association_ids))
       and r.balance_due > 0
  ),
  -- the as-of date once per association, not once per charge
  days as materialized (
    select x.association_id, coalesce(p_as_of, public.association_local_date(x.association_id)) as as_of
      from (select distinct association_id from open_rows) x
  ),
  ar as (
    select r.unit_id, r.balance_due, r.due_date, d.as_of
      from open_rows r join days d on d.association_id = r.association_id
  )
  select coalesce(sum(ar.balance_due), 0)::numeric,
         coalesce(sum(ar.balance_due) filter (where ar.due_date < ar.as_of), 0)::numeric,
         (count(distinct ar.unit_id) filter (where ar.due_date < ar.as_of))::integer,
         case when coalesce(sum(ar.balance_due) filter (where ar.due_date is not null), 0) > 0
              then sum(greatest(0, ar.as_of - ar.due_date) * ar.balance_due) filter (where ar.due_date is not null)
                   / sum(ar.balance_due) filter (where ar.due_date is not null)
              else null end::numeric
    from ar;
$function$;

-- 4. Meeting financial snapshot: the association's local month, by charge
--    date (due_date), not when the charge row was created.
do $$
declare
  d text := replace(pg_get_functiondef('public.get_meeting_financial_snapshot(uuid)'::regprocedure), chr(13), '');
  a1 text := E'  v_current_month_expenses numeric := 0;\nbegin\n';
  a2 text := E'    raise exception ''Not authorized for this association'' using errcode = ''42501'';\n  end if;\n';
  a3 text := E'    and c.created_at >= date_trunc(''month'', pg_catalog.now());';
  a4 text := E'    and pb.occurred_on >= date_trunc(''month'', pg_catalog.now())::date\n';
  x text;
begin
  if position('board_vendor_fixes' in d) > 0 then return; end if;
  foreach x in array array[a1, a2, a3, a4] loop
    if (length(d) - length(replace(d, x, ''))) / length(x) <> 1 then
      raise exception 'get_meeting_financial_snapshot: anchor not found exactly once: %', x;
    end if;
  end loop;
  d := replace(d, a1, E'  v_current_month_expenses numeric := 0;\n  v_month_start date;\nbegin\n');
  d := replace(d, a2, a2 || E'  -- board_vendor_fixes: the association''s own month.\n  v_month_start := date_trunc(''month'', public.association_local_date(p_association_id))::date;\n');
  d := replace(d, a3, E'    and c.due_date >= v_month_start\n    and c.due_date < (v_month_start + interval ''1 month'')::date;');
  d := replace(d, a4, E'    and pb.occurred_on >= v_month_start\n    and pb.occurred_on < (v_month_start + interval ''1 month'')::date\n');
  execute d;
end $$;

-- 5. In-house labor costs are management's: vendors no longer read them
--    (no vendor page uses work_order_labor_entries).
alter policy labor_entries_vendor_read on public.work_order_labor_entries using (false);

-- 6. With email matching gone from board access, a seat staff add for someone
--    who already has a board login links to that login when it is saved
--    (same company, board role, not disabled), as sign-up already does.
create or replace function public.board_members_link_login()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.auth_user_id is null and nullif(btrim(coalesce(new.email, '')), '') is not null then
    select p.id into new.auth_user_id
      from public.associations a
      join public.profiles p on p.portfolio_id = a.portfolio_id and p.hoa_role = 'board' and p.disabled_at is null
      join auth.users u on u.id = p.id and lower(u.email) = lower(btrim(new.email))
     where a.id = new.association_id
     limit 1;
  end if;
  return new;
end
$function$;

revoke all on function public.board_members_link_login() from public, anon, authenticated;

create or replace trigger trg_board_members_link_login
  before insert or update of email on public.board_members
  for each row execute function public.board_members_link_login();
