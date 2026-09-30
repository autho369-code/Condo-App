-- Review fixes for homeowner credits:
-- 1. Every payments insert/update is validated in the database: a chosen bank
--    account must belong to the unit's company and association, and a credit
--    must use an active income/expense account of that association (and no
--    bank account). Forged forms or direct API inserts can no longer post to
--    another association's cash or bypass the credit rules.
-- 2. Credits no longer fire the "payment.received" webhook (no money moved).
-- 3. Unused credit is not listed as an unapplied receipt.

create or replace function public.validate_payment_accounts()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_assoc uuid := public.unit_association_id(new.unit_id); v_pid uuid;
begin
  select a.portfolio_id into v_pid from public.associations a where a.id = v_assoc;
  if v_pid is null then raise exception 'Payment unit is not in an association' using errcode = '23514'; end if;

  if new.bank_account_id is not null and not exists (
       select 1 from public.bank_accounts b
        where b.id = new.bank_account_id and b.portfolio_id = v_pid and b.archived_at is null
          and (b.association_id is null or b.association_id = v_assoc)) then
    raise exception 'That bank account does not belong to this unit''s association' using errcode = '23514';
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
revoke all on function public.validate_payment_accounts() from public, anon, authenticated;

drop trigger if exists trg_validate_payment_accounts on public.payments;
create trigger trg_validate_payment_accounts
  before insert or update of unit_id, bank_account_id, gl_account_id, method on public.payments
  for each row execute function public.validate_payment_accounts();

create or replace function public.dispatch_payment_webhook()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare pid uuid;
begin
  -- A credit is a non-cash adjustment, not money received.
  if new.method = 'credit' then return new; end if;
  select a.portfolio_id into pid
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = new.unit_id;
  if pid is not null then
    perform public.dispatch_webhook(pid, 'payment.received'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end $$;

do $$
declare v_def text;
begin
  select pg_get_functiondef('public.report_data_unapplied_receipts(uuid, jsonb)'::regprocedure) into v_def;
  if position('join public.payments p on p.unit_id = u.id' in v_def) = 0 then raise exception 'unapplied receipts join not found'; end if;
  v_def := replace(v_def, 'join public.payments p on p.unit_id = u.id', 'join public.payments p on p.unit_id = u.id and p.method <> ''credit''');
  execute v_def;
end $$;
