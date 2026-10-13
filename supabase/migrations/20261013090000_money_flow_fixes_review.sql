-- Follow-ups to 20261013080000 (migration-reviewer on #339).
--
-- 1. NSF fee income: the 'nsf_fee_income' GL mapping cannot be saved
--    (gl_account_map's key check and set_gl_account_map don't know it), so
--    the lookup is dropped; the fee goes to the company's active income or
--    other-income account named like "NSF fee". No NSF fee charges exist on
--    production yet, so nothing needs reclassifying.
-- 2. Bank reconciliations: a reconciliation inserted directly as completed
--    skipped the balance check; inserts must now start in progress (the app
--    always does). The service role (platform maintenance and the staging
--    verification scripts, which seed and clean up completed
--    reconciliations) is not blocked. A completed reconciliation cannot be
--    undone in the app: a mistaken one is fixed by the platform.

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
    case when p_charge.charge_type::text = 'nsf_fee' then public.gl_pick(v_portfolio, v_assoc, array['income', 'other_income'], '%nsf fee%', '%transfer%') end,
    public.app_gl_map(v_portfolio, v_assoc, 'default_income'),
    public.gl_pick(v_portfolio, v_assoc, array['income']));
end $function$;

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
  if current_user = 'service_role' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'INSERT' then
    if new.status = 'completed' then
      raise exception 'A reconciliation starts in progress; complete it after clearing its items' using errcode = '23514';
    end if;
    return new;
  end if;
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
  if current_user <> 'service_role' and exists (
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
  before insert or update or delete on public.bank_reconciliations
  for each row execute function public.app_guard_bank_reconciliation();
