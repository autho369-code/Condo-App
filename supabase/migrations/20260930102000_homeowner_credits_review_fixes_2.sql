-- Second review pass on homeowner credits:
-- 1. Changing a payment's method or credit account re-posts its ledger entry
--    (reverse + repost), so the journal always matches the row.
-- 2. A payment or credit aimed at a specific charge must target a charge on
--    the same unit; a credit may not exceed that charge's open balance.
--    Stops direct API inserts from reducing another homeowner's balance.

do $$
declare v_def text; v_old text; v_new text;
begin
  select pg_get_functiondef('public.post_payment_to_gl()'::regprocedure) into v_def;
  v_old := 'and new.payment_date is not distinct from old.payment_date and new.bank_account_id is not distinct from old.bank_account_id then';
  v_new := 'and new.payment_date is not distinct from old.payment_date and new.bank_account_id is not distinct from old.bank_account_id and new.method is not distinct from old.method and new.gl_account_id is not distinct from old.gl_account_id then';
  if position(v_old in v_def) = 0 then raise exception 'post_payment_to_gl no-op predicate not found'; end if;
  execute replace(v_def, v_old, v_new);
end $$;

create or replace function public.validate_payment_accounts()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_assoc uuid := public.unit_association_id(new.unit_id); v_pid uuid; v_charge record; v_open numeric;
begin
  select a.portfolio_id into v_pid from public.associations a where a.id = v_assoc;
  if v_pid is null then raise exception 'Payment unit is not in an association' using errcode = '23514'; end if;

  if new.bank_account_id is not null and not exists (
       select 1 from public.bank_accounts b
        where b.id = new.bank_account_id and b.portfolio_id = v_pid and b.archived_at is null
          and (b.association_id is null or b.association_id = v_assoc)) then
    raise exception 'That bank account does not belong to this unit''s association' using errcode = '23514';
  end if;

  if new.charge_id is not null then
    select c.id, c.unit_id, c.amount into v_charge from public.charges c where c.id = new.charge_id for update;
    if not found or v_charge.unit_id is distinct from new.unit_id then
      raise exception 'That charge is not on this unit' using errcode = '23514';
    end if;
    if new.method = 'credit' and tg_op = 'INSERT' then
      v_open := v_charge.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = new.charge_id), 0);
      if new.amount > v_open then
        raise exception 'The credit (%) is more than the open balance on that charge (%)', new.amount, v_open using errcode = '23514';
      end if;
    end if;
  end if;

  if new.method = 'credit' then
    if new.bank_account_id is not null then
      raise exception 'A credit does not go to a bank account' using errcode = '23514';
    end if;
    if not exists (
         select 1 from public.gl_accounts g
          where g.id = new.gl_account_id and g.portfolio_id = v_pid and g.active
            and (g.association_id is null or g.association_id = v_assoc)
            and g.account_type::text in ('income', 'other_income', 'expense', 'other_expense')) then
      raise exception 'A credit needs an active income or expense account of this association' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_validate_payment_accounts on public.payments;
create trigger trg_validate_payment_accounts
  before insert or update of unit_id, bank_account_id, gl_account_id, method, charge_id, amount on public.payments
  for each row execute function public.validate_payment_accounts();
