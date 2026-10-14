-- Purchase order / project decisions (Mirsad, 2026-10-14).
-- 2. A bill from a board-approved PO doesn't go to the board again while the
--    PO's bills (this one included) stay within the approved PO amount.
-- 4. A recurring PO that fell behind creates only the next period, not one
--    draft for every missed period (whose needed-by dates had already gone).
--    "Today" is the association's own day.
-- 5. Project cost: Committed = open balances of approved POs on the project's
--    work orders + unpaid bills; Spent = paid bills. New functions
--    capital_project_cost_totals / project_cost_by_category (the old
--    capital_project_spend_totals / project_budget_vs_actual return one
--    figure and can't change shape without a DROP; they stay until the new
--    pages are live).
-- 6. PO numbers: a blank number is filled per company (PO-00001, ...); a
--    number is unique within the company (no duplicates on production when
--    written: 0 purchase orders).
-- 7. Purchase orders and their line items are readable by finance staff
--    only (the pages already require finance access); purchase order
--    reports likewise. Vendors' read of their approved POs is unchanged.
-- 3 (vendor email on approval) is app code: lib/notifications/purchase-order-approved.ts.
-- Bodies are the live ones plus the change (read with pg_get_functiondef).

-- ---------------------------------------------------------------------------
-- 2. Bills within a board-approved PO.
-- True when the bill is on a PO the board approved (its approval request was
-- approved) and the PO's live bills, this one included, add up to no more
-- than the PO total. Internal: called by the bill functions only.
create or replace function public.payable_bill_within_board_approved_po(p_bill_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  po public.purchase_orders;
  v_billed numeric;
begin
  select po_row.* into po
    from public.payable_bills b
    join public.purchase_orders po_row on po_row.id = b.purchase_order_id
   where b.id = p_bill_id
     and po_row.portfolio_id = b.portfolio_id
     and po_row.association_id is not distinct from b.association_id;
  if po.id is null
     or po.archived_at is not null
     or po.status::text = 'cancelled'
     or po.approval_status <> 'approved'
     or not coalesce(po.approval_required, false)
     or po.approval_request_id is null
     or not exists (select 1 from public.approval_requests r
                     where r.id = po.approval_request_id
                       and r.request_type = 'purchase_order'
                       and r.status = 'approved'::public.approval_request_status) then
    return false;
  end if;
  select coalesce(sum(b.amount), 0) into v_billed
    from public.payable_bills b
   where b.purchase_order_id = po.id and b.status::text <> 'void' and b.archived_at is null;
  return v_billed <= po.po_total;
end $function$;

revoke all on function public.payable_bill_within_board_approved_po(uuid) from public, anon, authenticated;

create or replace function public.bill_purchase_order(p_po_id uuid, p_bill_number text, p_bill_date date, p_due_date date, p_amount numeric, p_gl_account_id uuid, p_memo text, p_submit_for_approval boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  po public.purchase_orders;
  v_gl uuid;
  v_gl_count integer;
  v_uncategorized integer;
  v_amount numeric := round(p_amount, 2);
  v_bill uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to bill purchase orders' using errcode = '42501';
  end if;
  select * into po from public.purchase_orders where id = p_po_id and archived_at is null;
  if po.id is null then
    raise exception 'Purchase order not found';
  end if;
  if not ((public.can_manage_finance(po.portfolio_id) and (po.association_id is null or public.can_manage_association(po.association_id)))
          or public.is_platform_operator()) then
    raise exception 'You do not have accounting access to this purchase order' using errcode = '42501';
  end if;
  if po.vendor_id is null then
    raise exception 'Add a vendor to the purchase order before billing it' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Enter the bill amount' using errcode = '22023';
  end if;

  select count(distinct l.gl_account_id), min(l.gl_account_id::text)::uuid, count(*) filter (where l.gl_account_id is null)
    into v_gl_count, v_gl, v_uncategorized
    from public.purchase_order_line_items l where l.purchase_order_id = po.id;
  if p_gl_account_id is not null then
    if not exists (select 1 from public.gl_accounts g where g.id = p_gl_account_id and g.portfolio_id = po.portfolio_id
                     and (g.association_id is null or g.association_id is not distinct from po.association_id)
                     and coalesce(g.active, true)) then
      raise exception 'Choose an active GL account of this association' using errcode = '22023';
    end if;
    v_gl := p_gl_account_id;
  elsif v_gl_count <> 1 or v_uncategorized > 0 then
    raise exception 'Choose the GL account for this bill % the purchase order''s lines don''t all use one account', chr(8212) using errcode = '22023';
  end if;

  if not exists (select 1 from public.gl_accounts g where g.id = v_gl and g.portfolio_id = po.portfolio_id and (g.association_id is null or g.association_id is not distinct from po.association_id) and coalesce(g.active, true) and g.account_type::text in ('expense', 'other_expense', 'cost_of_goods_sold')) then
    raise exception 'Choose an active expense account for this bill % the purchase order''s account is inactive or not an expense account', chr(8212) using errcode = '22023';
  end if;

  v_bill := public.create_payable_bill(po.portfolio_id, po.vendor_id, po.association_id, v_gl, null,
    p_bill_number,
    -- purchase_orders_fixes: the association's own day, not the database's.
    coalesce(p_bill_date, public.association_local_date(po.association_id), current_date),
    p_due_date, v_amount,
    coalesce(nullif(btrim(coalesce(p_memo, '')), ''), 'PO ' || coalesce(po.number, left(po.id::text, 8))), false, false);
  -- purchase_orders_fixes: the PO's work order follows to the bill, so the
  -- bill counts toward the work order's capital project.
  update public.payable_bills
     set purchase_order_id = po.id,
         work_order_id = coalesce(work_order_id, po.work_order_id)
   where id = v_bill;
  -- po_decisions: the board already approved this spend. Within the PO
  -- amount the bill doesn't go to the board again; otherwise the bills
  -- threshold create_payable_bill applied stands.
  if public.payable_bill_within_board_approved_po(v_bill) then
    update public.payable_bills set approval_required = false where id = v_bill;
  end if;
  if coalesce(p_submit_for_approval, false) then
    perform public.request_payable_bill_approval(v_bill);
  end if;
  return v_bill;
end $function$;

create or replace function public.request_payable_bill_approval(p_bill_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  bill_row public.payable_bills;
  settings_row public.board_approval_settings;
  member_ids uuid[];
  member_count integer;
  required_count integer;
  request_id uuid;
  vendor_name text;
begin
  select * into bill_row from public.payable_bills where id = p_bill_id for update;
  if not found then raise exception 'Bill not found'; end if;
  if not public.can_manage_finance(bill_row.portfolio_id) then raise exception 'Permission denied'; end if;
  if not public.can_view_association_row(bill_row.association_id) then raise exception 'Bill not found'; end if;
  if not public.operator_may_write(false) then raise exception 'Permission denied'; end if;
  if bill_row.status not in ('draft'::public.payable_bill_status, 'pending_approval'::public.payable_bill_status) then
    raise exception 'Only draft or pending bills can be submitted for approval';
  end if;
  if bill_row.approval_request_id is not null then return bill_row.approval_request_id; end if;

  -- po_decisions: a bill within a board-approved PO's amount (checked now,
  -- with every bill on the PO) doesn't go to the board again.
  if bill_row.approval_required and bill_row.purchase_order_id is not null
     and public.payable_bill_within_board_approved_po(p_bill_id) then
    update public.payable_bills set approval_required = false where id = p_bill_id;
    bill_row.approval_required := false;
  end if;

  if not bill_row.approval_required then
    update public.payable_bills
       set status = 'pending_approval'::public.payable_bill_status, updated_at = now()
     where id = p_bill_id;
    return null;
  end if;
  if bill_row.association_id is null then
    raise exception 'Board-approved bills require an association';
  end if;

  select * into settings_row from public.board_approval_settings
   where association_id = bill_row.association_id;
  select coalesce(array_agg(bm.id order by bm.id), '{}'::uuid[])
    into member_ids
    from public.board_members bm
   where bm.association_id = bill_row.association_id
     and bm.active
     and (
       coalesce(cardinality(settings_row.default_board_member_ids), 0) = 0
       or bm.id = any(settings_row.default_board_member_ids)
     );
  member_count := coalesce(cardinality(member_ids), 0);
  if member_count = 0 then raise exception 'No active board approvers are configured'; end if;

  settings_row.default_voting_scheme := coalesce(settings_row.default_voting_scheme, 'majority_approval_required'::public.voting_scheme);
  settings_row.signatures_required := coalesce(settings_row.signatures_required, true);
  required_count := case settings_row.default_voting_scheme
    when 'any_one_approver'::public.voting_scheme then 1
    when 'unanimous_approval_required'::public.voting_scheme then member_count
    when 'percentage_required'::public.voting_scheme then greatest(1, ceil(member_count * coalesce(settings_row.default_percentage_required, 100) / 100.0)::integer)
    else floor(member_count / 2.0)::integer + 1
  end;
  select name into vendor_name from public.vendors where id = bill_row.vendor_id;

  insert into public.approval_requests (
    portfolio_id, association_id, vendor_id, request_type, title, description,
    requested_by_name, requested_by_email, amount, due_date, status,
    voting_scheme, required_votes, signatures_required, board_member_ids,
    percentage_required, requested_at
  ) values (
    bill_row.portfolio_id, bill_row.association_id, bill_row.vendor_id, 'expense',
    'Bill ' || coalesce(nullif(trim(bill_row.bill_number), ''), left(bill_row.id::text, 8)) || ' ' || chr(8212) || ' ' || coalesce(vendor_name, 'Vendor'),
    bill_row.memo, coalesce((select full_name from public.profiles where id = auth.uid()), 'Management staff'),
    (select email from auth.users where id = auth.uid()), bill_row.amount, bill_row.due_date, 'pending',
    settings_row.default_voting_scheme, required_count, settings_row.signatures_required,
    member_ids, settings_row.default_percentage_required, now()
  ) returning id into request_id;

  update public.payable_bills
     set status = 'pending_approval'::public.payable_bill_status,
         approval_request_id = request_id,
         updated_at = now()
   where id = p_bill_id;
  return request_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Recurring POs: only the next period.
create or replace function public.generate_recurring_purchase_orders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  t record;
  v_today date;
  v_date date;
  v_guard integer;
  n integer := 0;
begin
  for t in
    select * from public.recurring_purchase_orders r
     where r.auto_generate and r.archived_at is null and r.next_post_date is not null
       -- po_decisions: the association's own day, not the database's.
       and r.next_post_date <= coalesce(public.association_local_date(r.association_id), current_date)
       and (r.end_date is null or r.next_post_date <= r.end_date)
  loop
    begin
      v_today := coalesce(public.association_local_date(t.association_id), current_date);
      v_date := t.next_post_date;
      -- po_decisions: a schedule that fell behind (first date in the past,
      -- or resumed late) skips the missed periods without creating them;
      -- only the next period, on or after today, is created.
      v_guard := 0;
      while v_date < v_today and v_guard < 10000 loop
        v_date := public.recurring_next_date(v_date, t.frequency::text, t.interval_count, extract(day from coalesce(t.start_date, t.next_post_date))::integer);
        v_guard := v_guard + 1;
      end loop;
      if t.end_date is null or v_date <= t.end_date then
        if public.app_po_from_recurring(t.id, v_date) is not null then n := n + 1; end if;
        v_date := public.recurring_next_date(v_date, t.frequency::text, t.interval_count, extract(day from coalesce(t.start_date, t.next_post_date))::integer);
      end if;
      update public.recurring_purchase_orders
         set next_post_date = v_date, last_generated_at = now(), last_error = null, updated_at = now(),
             auto_generate = (t.end_date is null or v_date <= t.end_date)
       where id = t.id;
    exception when others then
      update public.recurring_purchase_orders set last_error = left(sqlerrm, 500), updated_at = now() where id = t.id;
    end;
  end loop;
  return n;
end $function$;

-- ---------------------------------------------------------------------------
-- 5. Project cost: committed and spent.
-- Open PO balance per line: the PO's billed amount uses up its lines in
-- order, so the open amounts are exact cents and add up to po_total -
-- po_billed (both functions use the same rule, so the list and the project
-- page agree).
create or replace function public.capital_project_cost_totals()
returns table(project_id uuid, work_order_count integer, committed_amount numeric, spent_amount numeric)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  -- Same access as capital_project_spend_totals: worked out once per call.
  v_op boolean := coalesce(public.is_platform_operator(), false);
  v_pf uuid := public.my_access_portfolio();
  v_scoped boolean := coalesce(public.manager_is_scoped(), false);
begin
  if not (v_op or v_pf is not null) then
    return;
  end if;

  return query
  with proj as (
    select p.id, p.association_id
      from public.capital_projects p
     where p.portfolio_id is not null
       and (v_op or p.portfolio_id = v_pf)
       and (not v_scoped
            or p.association_id is null
            or p.association_id in (select am.association_id
                                      from public.association_managers am
                                     where am.user_id = auth.uid()))
  ),
  links as (
    select distinct link.project_id, link.work_order_id, proj.association_id
      from public.capital_project_work_orders link
      join proj on proj.id = link.project_id
  ),
  bills as (
    select lk.project_id,
           sum(b.amount) filter (where b.status::text = 'paid') as spent,
           sum(b.amount) filter (where b.status::text in ('draft', 'pending_approval', 'approved')) as unpaid
      from links lk
      join public.payable_bills b on b.work_order_id = lk.work_order_id
     where b.archived_at is null
       and b.association_id = lk.association_id
     group by lk.project_id
  ),
  po_lines as (
    select lk.project_id, po.po_billed, l.line_total,
           sum(l.line_total) over (partition by lk.project_id, po.id order by l.sort_order, l.id) as running
      from links lk
      join public.purchase_orders po on po.work_order_id = lk.work_order_id
      join public.purchase_order_line_items l on l.purchase_order_id = po.id
     where po.archived_at is null
       and po.association_id = lk.association_id
       and po.approval_status = 'approved'
       and po.status::text <> 'cancelled'
  ),
  pos as (
    select pl.project_id,
           sum(greatest(least(pl.line_total, pl.running - coalesce(pl.po_billed, 0)), 0)) as open_balance
      from po_lines pl
     group by pl.project_id
  ),
  counts as (
    select lk.project_id, count(*) as n from links lk group by lk.project_id
  )
  select proj.id,
         coalesce(counts.n, 0)::integer,
         (coalesce(pos.open_balance, 0) + coalesce(bills.unpaid, 0))::numeric(16, 2),
         coalesce(bills.spent, 0)::numeric(16, 2)
    from proj
    left join counts on counts.project_id = proj.id
    left join bills on bills.project_id = proj.id
    left join pos on pos.project_id = proj.id;
end
$function$;

revoke all on function public.capital_project_cost_totals() from public, anon;
grant execute on function public.capital_project_cost_totals() to authenticated;

create or replace function public.project_cost_by_category(p_project_id uuid)
returns table(line_id uuid, category text, gl_account_id uuid, gl_label text, budget_amount numeric, committed_amount numeric, spent_amount numeric)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  p public.capital_projects;
begin
  select * into p from public.capital_projects where id = p_project_id;
  if not found
     or not (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())
     or not public.can_access_portfolio(p.portfolio_id)
     or not public.can_view_association_row(p.association_id) then
    raise exception 'Project not found' using errcode = '42501';
  end if;

  return query
  with links as (
    select distinct link.work_order_id from public.capital_project_work_orders link where link.project_id = p.id
  ),
  bill_costs as (
    select b.gl_account_id as gl,
           coalesce(sum(b.amount) filter (where b.status::text in ('draft', 'pending_approval', 'approved')), 0) as committed,
           coalesce(sum(b.amount) filter (where b.status::text = 'paid'), 0) as spent
      from links lk
      join public.payable_bills b on b.work_order_id = lk.work_order_id
     where b.archived_at is null
       and b.association_id = p.association_id
     group by b.gl_account_id
  ),
  po_lines as (
    select l.gl_account_id as gl, po.po_billed, l.line_total,
           sum(l.line_total) over (partition by po.id order by l.sort_order, l.id) as running
      from links lk
      join public.purchase_orders po on po.work_order_id = lk.work_order_id
      join public.purchase_order_line_items l on l.purchase_order_id = po.id
     where po.archived_at is null
       and po.association_id = p.association_id
       and po.approval_status = 'approved'
       and po.status::text <> 'cancelled'
  ),
  po_costs as (
    select pl.gl, sum(greatest(least(pl.line_total, pl.running - coalesce(pl.po_billed, 0)), 0)) as committed, 0::numeric as spent
      from po_lines pl group by pl.gl
  ),
  spend as (
    select c.gl, sum(c.committed) as committed, sum(c.spent) as spent
      from (select * from bill_costs union all select * from po_costs) c
     group by c.gl
     having sum(c.committed) <> 0 or sum(c.spent) <> 0
  ),
  lines as (
    select l.*, (l.gl_account_id is null or public.can_read_gl(l.gl_account_id)) as readable
      from public.capital_project_budget_lines l where l.project_id = p.id
  ),
  spend_r as (
    select s.*, (s.gl is null or public.can_read_gl(s.gl)) as readable from spend s
  )
  select x.line_id, x.category, x.gl_account_id, x.gl_label, x.budget_amount, x.committed_amount, x.spent_amount
    from (
      select l.id as line_id, l.category, l.gl_account_id, concat_ws(' ', g.number, g.name) as gl_label,
             l.budget_amount,
             coalesce(s.committed, 0)::numeric(14, 2) as committed_amount,
             coalesce(s.spent, 0)::numeric(14, 2) as spent_amount,
             l.sort_order as ord
        from lines l
        left join public.gl_accounts g on g.id = l.gl_account_id
        left join spend s on s.gl = l.gl_account_id
       where l.readable
      union all
      select null::uuid, 'Other'::text, null::uuid, null::text, 0::numeric,
             sum(s.committed)::numeric(14, 2), sum(s.spent)::numeric(14, 2), 2147483646
        from spend_r s
       where s.readable and not exists (select 1 from lines l where l.gl_account_id is not distinct from s.gl)
      having count(*) > 0
      union all
      select null::uuid, 'Restricted accounts'::text, null::uuid, null::text,
             coalesce((select sum(l.budget_amount) from lines l where not l.readable), 0)::numeric(14, 2),
             coalesce((select sum(s.committed) from spend_r s where not s.readable), 0)::numeric(14, 2),
             coalesce((select sum(s.spent) from spend_r s where not s.readable), 0)::numeric(14, 2),
             2147483647
       where exists (select 1 from lines l where not l.readable) or exists (select 1 from spend_r s where not s.readable)
    ) x
   order by x.ord, x.category;
end $function$;

revoke all on function public.project_cost_by_category(uuid) from public, anon;
grant execute on function public.project_cost_by_category(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. PO numbers: filled when blank, unique within the company.
create table if not exists public.purchase_order_number_counters (
  portfolio_id uuid primary key references public.portfolios(id) on delete cascade,
  last_value   integer not null default 0
);
alter table public.purchase_order_number_counters enable row level security;
-- No policies: only purchase_orders_assign_number (definer) touches it.
revoke all on table public.purchase_order_number_counters from public, anon, authenticated;

create or replace function public.purchase_orders_assign_number()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_n integer;
  v_number text;
begin
  new.number := nullif(btrim(coalesce(new.number, '')), '');
  -- Clearing the number on an edit keeps the one it has.
  if tg_op = 'UPDATE' and new.number is null then
    new.number := old.number;
  end if;
  if tg_op = 'UPDATE' and new.number is not distinct from old.number and new.portfolio_id is not distinct from old.portfolio_id then
    return new;
  end if;
  -- One numbering at a time per company, so two new POs can't take the same number.
  perform pg_advisory_xact_lock(hashtextextended('purchase-order-number:' || new.portfolio_id::text, 0));
  if new.number is null then
    loop
      insert into public.purchase_order_number_counters as c (portfolio_id, last_value)
      values (new.portfolio_id, 1)
      on conflict (portfolio_id) do update set last_value = c.last_value + 1
      returning c.last_value into v_n;
      v_number := 'PO-' || lpad(v_n::text, 5, '0');
      -- Skip a number someone typed in by hand.
      exit when not exists (select 1 from public.purchase_orders po
                             where po.portfolio_id = new.portfolio_id and lower(po.number) = lower(v_number));
    end loop;
    new.number := v_number;
  elsif exists (select 1 from public.purchase_orders po
                 where po.portfolio_id = new.portfolio_id and lower(po.number) = lower(new.number) and po.id <> new.id) then
    raise exception 'PO number % is already used. Choose another number or leave it blank to number it automatically.', new.number
      using errcode = '23505';
  end if;
  return new;
end $function$;

revoke all on function public.purchase_orders_assign_number() from public, anon, authenticated;

create or replace trigger trg_purchase_orders_assign_number
  before insert or update of number, portfolio_id on public.purchase_orders
  for each row execute function public.purchase_orders_assign_number();

create unique index if not exists purchase_orders_number_per_company_uq
  on public.purchase_orders (portfolio_id, lower(number))
  where number is not null;

-- ---------------------------------------------------------------------------
-- 7. Purchase orders: finance staff only (helpers once per query).
alter policy purchase_orders_staff_all on public.purchase_orders
  using (COALESCE((portfolio_id = ( SELECT public.my_finance_portfolio() AS my_finance_portfolio)), false)
         OR (( SELECT public.is_platform_operator() AS is_platform_operator) AND (portfolio_id IS NOT NULL)))
  with check (COALESCE((portfolio_id = ( SELECT public.my_finance_portfolio() AS my_finance_portfolio)), false)
         OR (( SELECT public.is_platform_operator() AS is_platform_operator) AND (portfolio_id IS NOT NULL)));

alter policy po_line_items_staff_all on public.purchase_order_line_items
  using (EXISTS ( SELECT 1
                    FROM public.purchase_orders p
                   WHERE p.id = purchase_order_line_items.purchase_order_id
                     AND (COALESCE((p.portfolio_id = ( SELECT public.my_finance_portfolio() AS my_finance_portfolio)), false)
                          OR (( SELECT public.is_platform_operator() AS is_platform_operator) AND (p.portfolio_id IS NOT NULL)))))
  with check (EXISTS ( SELECT 1
                    FROM public.purchase_orders p
                   WHERE p.id = purchase_order_line_items.purchase_order_id
                     AND (COALESCE((p.portfolio_id = ( SELECT public.my_finance_portfolio() AS my_finance_portfolio)), false)
                          OR (( SELECT public.is_platform_operator() AS is_platform_operator) AND (p.portfolio_id IS NOT NULL)))));

-- Purchase order reports follow the table: finance staff only.
create or replace function public.report_params_access_error(p_portfolio_id uuid, p_slug text, p_params jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_assoc uuid;
  v_unit uuid;
  v_unit_assoc uuid;
  v_slug text := coalesce(p_slug, '');
begin
  begin
    v_assoc := nullif(p_params ->> 'association_id', '')::uuid;
    v_unit := nullif(p_params ->> 'unit_id', '')::uuid;
  exception when invalid_text_representation then
    return 'The selected association or unit is not valid.';
  end;

  if not public.can_access_portfolio(p_portfolio_id) then
    return 'You no longer have access to this company.';
  end if;
  if v_slug ~ '(1099|_tax_|^corporate_|^customer_ledger$)' and not public.can_manage_finance(p_portfolio_id) then
    return 'Tax and corporate accounting reports are limited to finance staff.';
  end if;
  -- po_decisions: purchase orders are readable by finance staff only.
  if v_slug ~ '^purchase_order' and not public.can_manage_finance(p_portfolio_id) then
    return 'Purchase order reports are limited to finance staff.';
  end if;
  -- People data: who works here, their roles and every sign-in attempt.
  if v_slug in ('users', 'users_and_permissions', 'user_roles_permissions', 'login_audit')
     and not (public.is_full_access_staff() or public.is_company_admin() or public.is_platform_operator()) then
    return 'User and sign-in reports are limited to company admins and full-access staff.';
  end if;
  if v_slug in ('association_log', 'email_delivery_errors', 'survey_results', 'users', 'users_and_permissions', 'data_diagnostics_summary', 'login_audit',
                'user_roles_permissions', 'vendor_directory', 'inventory_status', 'property_group_directory')
     and public.manager_is_scoped() then
    return 'This company-wide report is limited to staff with access to every association.';
  end if;
  if v_assoc is not null and not exists (
       select 1 from public.associations a
        where a.id = v_assoc and a.portfolio_id = p_portfolio_id and public.can_view_association_row(a.id)) then
    return 'You cannot access the selected association.';
  end if;
  if v_assoc is null and public.manager_is_scoped() then
    return 'Choose one of your associations for this report.';
  end if;
  if nullif(p_params ->> 'owner_id', '') is not null then
    return 'This report cannot be filtered by homeowner. Choose an association instead.';
  end if;
  if v_unit is not null then
    if v_slug not in ('owner_ledger', 'homeowner_ledger', 'homeowner_resale') then
      return 'This report cannot be filtered by unit. Choose an association instead.';
    end if;
    select b.association_id into v_unit_assoc
      from public.units u join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id
     where u.id = v_unit and a.portfolio_id = p_portfolio_id;
    if v_unit_assoc is null or not public.can_view_association_row(v_unit_assoc) then
      return 'You cannot access the selected unit.';
    end if;
    if v_assoc is not null and v_unit_assoc <> v_assoc then
      return 'The selected unit is not in the selected association.';
    end if;
  end if;
  return null;
end $function$;
