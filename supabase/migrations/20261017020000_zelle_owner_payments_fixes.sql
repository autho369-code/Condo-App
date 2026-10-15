-- Zelle owner payments: review fixes.
--
-- A payment may go to a company-wide bank account (bank_accounts.association_id
-- null) only when the unit's association uses it: names it as its operating,
-- reserve or primary account (public.app_bank_account_association_ids, the same
-- rule the bank feed uses to scope a company-wide account). Before this, the
-- payments check accepted ANY company-wide account of the portfolio, so a
-- payment could post Dr cash to a bank the association doesn't use.
--
-- Receiving a bank-feed credit on a company-wide account the association names
-- keeps working (receive_bank_transaction_as_payment already requires the unit
-- to be in one of the account's associations; payment_gl_accounts takes the
-- cash account from the payment's bank account).
--
-- The new check runs on INSERT and when the unit or bank account changes, so
-- an existing payment stays editable (amount, method) after its association
-- later points its operating account somewhere else. No company-wide bank
-- accounts exist today, so no existing payment is affected.
--
-- CREATE OR REPLACE of validate_payment_accounts only (live body + the change).
-- The charge_id block is live (production migration 20260930035408
-- homeowner_credits_review_fixes_2, which has no file in this repo); it is
-- carried over unchanged, not a new rule.
-- No DELETE, no DROP.

create or replace function public.validate_payment_accounts()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare v_assoc uuid := public.unit_association_id(new.unit_id); v_pid uuid; v_charge record; v_open numeric;
        v_bank_assoc uuid;
begin
  select a.portfolio_id into v_pid from public.associations a where a.id = v_assoc;
  if v_pid is null then raise exception 'Payment unit is not in an association' using errcode = '23514'; end if;

  if new.bank_account_id is not null then
    select b.association_id into v_bank_assoc from public.bank_accounts b
     where b.id = new.bank_account_id and b.portfolio_id = v_pid and b.archived_at is null;
    if not found or (v_bank_assoc is not null and v_bank_assoc <> v_assoc) then
      raise exception 'That bank account does not belong to this unit''s association' using errcode = '23514';
    end if;
    -- A company-wide account: only one the unit's association uses.
    if v_bank_assoc is null
       and (tg_op = 'INSERT'
            or new.bank_account_id is distinct from old.bank_account_id
            or new.unit_id is distinct from old.unit_id)
       and not (v_assoc = any (public.app_bank_account_association_ids(new.bank_account_id))) then
      raise exception 'That bank account does not belong to this unit''s association' using errcode = '23514';
    end if;
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
end $function$;

alter function public.validate_payment_accounts() owner to postgres;
revoke all on function public.validate_payment_accounts() from public, anon, authenticated;
