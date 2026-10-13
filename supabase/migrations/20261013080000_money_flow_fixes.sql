-- Money-flow fixes found by exercising every ledger flow as a manager in
-- rolled-back transactions on Randolph Station (2026-10-13).
--
-- 1. NSF fee income. post_nsf_fee creates an 'nsf_fee' charge with no
--    category and no GL account, and charge_gl_accounts had no NSF branch,
--    so the fee was credited to the default income account (4000
--    Assessments) instead of NSF fee income (4410 NSF Fees Collected).
--    charge_gl_accounts now resolves 'nsf_fee' charges like late fees: the
--    'nsf_fee_income' mapping, else the company's active income account
--    named like "NSF fee" (not "%nsf%": "Transfer Fee" contains "nsf").
--    Explicit charge or category accounts still win.
-- 2. Payment plans. app_recheck_payment_plan (payments update trigger)
--    counted reversed payments, so a plan paid off by a check that then
--    bounced stayed "completed" and its collection hold stayed released.
--    Reversed payments no longer count, and the recheck now also runs when
--    a payment is reversed (the trigger watched amount, unit, method and
--    date, not reversed_at).
-- 3. Bank reconciliations. A completed reconciliation (and its items) could
--    be reopened or un-cleared directly through the table, and the database
--    never checked that it balanced. Completed reconciliations and their
--    items are now read-only, and completing one requires the adjusted book
--    balance to match the statement (same rule as the complete route:
--    statement - (book - uncleared book items + cleared bank-only items)
--    within a cent). The app never reopens a completed reconciliation.

-- 1. NSF fee income ---------------------------------------------------------
create or replace function public.charge_gl_accounts(p_charge charges, out portfolio_id uuid, out association_id uuid, out ar uuid, out income uuid)
returns record
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare v_assoc uuid; v_portfolio uuid; v_cat_gl uuid;
begin
  v_assoc := public.unit_association_id(p_charge.unit_id);
  select a.portfolio_id into v_portfolio from public.associations a where a.id = v_assoc;
  select cc.gl_account_id into v_cat_gl from public.charge_categories cc where cc.id = p_charge.charge_category_id;
  portfolio_id := v_portfolio;
  association_id := v_assoc;
  ar := coalesce(public.app_gl_map(v_portfolio, v_assoc, 'accounts_receivable'), public.gl_pick(v_portfolio, v_assoc, array['accounts_receivable'], null, '%allowance%'));
  income := coalesce(
    case when public.budget_gl_account_scope_valid(v_assoc, p_charge.gl_account_id) then p_charge.gl_account_id end,
    case when public.budget_gl_account_scope_valid(v_assoc, v_cat_gl) then v_cat_gl end,
    case when p_charge.charge_type::text = 'late_fee' then coalesce(public.app_gl_map(v_portfolio, v_assoc, 'late_fee_income'), public.gl_pick(v_portfolio, v_assoc, array['income'], '%late fee%')) end,
    case when p_charge.charge_type::text = 'nsf_fee' then coalesce(public.app_gl_map(v_portfolio, v_assoc, 'nsf_fee_income'), public.gl_pick(v_portfolio, v_assoc, array['income'], '%nsf fee%', '%transfer%')) end,
    public.app_gl_map(v_portfolio, v_assoc, 'default_income'),
    public.gl_pick(v_portfolio, v_assoc, array['income']));
end $function$;

-- 2. Payment plans: reversed payments don't count -------------------------
do $$
declare
  def text := pg_get_functiondef('public.app_recheck_payment_plan(uuid)'::regprocedure);
  old_text text := 'and pm.created_at >= pl.created_at and coalesce(pm.method, '''') <> ''credit'';';
  new_text text := 'and pm.created_at >= pl.created_at and coalesce(pm.method, '''') <> ''credit'' and pm.reversed_at is null;';
begin
  if position(new_text in def) > 0 then
    return; -- already applied
  end if;
  if (length(def) - length(replace(def, old_text, ''))) / length(old_text) <> 1 then
    raise exception 'Expected exactly one "%" in app_recheck_payment_plan', old_text;
  end if;
  execute replace(def, old_text, new_text);
end
$$;

create or replace trigger trg_payments_recheck_payment_plan
  after delete or update of amount, unit_id, method, payment_date, reversed_at on public.payments
  for each row execute function public.payments_recheck_payment_plan();

-- 3. Bank reconciliations ---------------------------------------------------
create or replace function public.app_guard_bank_reconciliation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_outstanding numeric;
  v_bank_only numeric;
  v_difference numeric;
begin
  if tg_op = 'DELETE' then
    if old.status = 'completed' then
      raise exception 'A completed reconciliation cannot be deleted' using errcode = '55000';
    end if;
    return old;
  end if;
  if old.status = 'completed' then
    raise exception 'A completed reconciliation cannot be changed' using errcode = '55000';
  end if;
  if new.status = 'completed' then
    select coalesce(sum(i.amount) filter (where not i.is_cleared and i.type is distinct from 'bank_only'), 0),
           coalesce(sum(i.amount) filter (where i.is_cleared and i.type = 'bank_only'), 0)
      into v_outstanding, v_bank_only
      from public.bank_reconciliation_items i
     where i.reconciliation_id = new.id;
    v_difference := coalesce(new.statement_balance, 0)
                  - (coalesce(new.ending_book_balance, 0) - v_outstanding + v_bank_only);
    if abs(v_difference) >= 0.01 then
      raise exception 'The reconciliation is out of balance by %', round(abs(v_difference), 2) using errcode = '23514';
    end if;
  end if;
  return new;
end
$function$;

create or replace function public.app_guard_bank_reconciliation_item()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if exists (
    select 1 from public.bank_reconciliations r
     where r.id in (case when tg_op = 'INSERT' then null else old.reconciliation_id end,
                    case when tg_op = 'DELETE' then null else new.reconciliation_id end)
       and r.status = 'completed'
  ) then
    raise exception 'Items of a completed reconciliation cannot be changed' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$function$;

revoke all on function public.app_guard_bank_reconciliation() from public, anon, authenticated;
revoke all on function public.app_guard_bank_reconciliation_item() from public, anon, authenticated;

create or replace trigger trg_guard_bank_reconciliation
  before update or delete on public.bank_reconciliations
  for each row execute function public.app_guard_bank_reconciliation();

create or replace trigger trg_guard_bank_reconciliation_item
  before insert or update or delete on public.bank_reconciliation_items
  for each row execute function public.app_guard_bank_reconciliation_item();
