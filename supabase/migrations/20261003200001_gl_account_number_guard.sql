-- GL account numbers: a company-wide number is not reused by an
-- association's account (or the reverse). The unique index only covers the
-- exact (company, association, number) triple, so reports could show two
-- different accounts under one number. Same guard as 20261003200000 plus the
-- number check at the top.

create or replace function public.guard_gl_account_change()
returns trigger language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare
  v_parent public.gl_accounts;
  v_cursor uuid;
  v_hops int := 0;
  v_balance numeric;
begin
  -- A company-wide number is not reused by an association's account (or the
  -- reverse); reports would show two different accounts under one number.
  if (tg_op = 'INSERT' or new.number is distinct from old.number or new.association_id is distinct from old.association_id)
     and exists (select 1 from public.gl_accounts o
                  where o.portfolio_id = new.portfolio_id and o.number = new.number and o.id <> new.id
                    and (o.association_id is null or new.association_id is null or o.association_id = new.association_id)) then
    raise exception 'Account number % is already used in this chart of accounts', new.number using errcode = '23505';
  end if;

  -- Shape checks run when the shape changes, so old rows stay editable.
  if tg_op = 'UPDATE' and new.portfolio_id is not distinct from old.portfolio_id
     and new.association_id is not distinct from old.association_id
     and new.account_type is not distinct from old.account_type
     and new.sub_account_of_id is not distinct from old.sub_account_of_id then
    null;
  elsif new.association_id is not null and not exists (
       select 1 from public.associations a where a.id = new.association_id and a.portfolio_id = new.portfolio_id) then
    raise exception 'That association is not in this company' using errcode = '22023';
  elsif new.sub_account_of_id is not null then
    select * into v_parent from public.gl_accounts where id = new.sub_account_of_id;
    if v_parent.id is null or v_parent.portfolio_id <> new.portfolio_id then
      raise exception 'Parent account not found' using errcode = '22023';
    end if;
    if v_parent.account_type <> new.account_type then
      raise exception 'A sub-account must have the same type as its parent' using errcode = '22023';
    end if;
    if v_parent.association_id is not null and v_parent.association_id is distinct from new.association_id then
      raise exception 'A sub-account must belong to its parent''s association' using errcode = '22023';
    end if;
    v_cursor := new.sub_account_of_id;
    while v_cursor is not null and v_hops < 50 loop
      if v_cursor = new.id then raise exception 'An account cannot be under its own sub-account' using errcode = '22023'; end if;
      select sub_account_of_id into v_cursor from public.gl_accounts where id = v_cursor;
      v_hops := v_hops + 1;
    end loop;
  end if;

  if tg_op = 'UPDATE' then
    if (new.account_type is distinct from old.account_type or new.association_id is distinct from old.association_id)
       and exists (select 1 from public.journal_lines where gl_account_id = old.id) then
      raise exception 'This account has ledger entries; its type and association cannot change. Create a new account instead.' using errcode = '22023';
    end if;
    -- Balance-sheet accounts carry their balance forward; income and expense
    -- accounts only report activity by period, so those may be retired.
    if old.active and not new.active and old.account_type::text in
         ('asset', 'liability', 'equity', 'cash', 'accounts_receivable', 'accounts_payable', 'fixed_asset') then
      select coalesce(sum(jl.debit_amount - jl.credit_amount), 0) into v_balance
        from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id and je.posted
       where jl.gl_account_id = old.id;
      if round(v_balance, 2) <> 0 then
        raise exception 'This account has a balance of %; move it to another account before deactivating', round(v_balance, 2) using errcode = '22023';
      end if;
    end if;
    if old.active and not new.active then
      if exists (select 1 from public.bank_accounts where gl_account_id = old.id and archived_at is null) then
        raise exception 'A bank account posts to this GL account; change the bank account first' using errcode = '22023';
      end if;
      if exists (select 1 from public.gl_account_map where gl_account_id = old.id) then
        raise exception 'This account is a default in the GL account map; choose another default first' using errcode = '22023';
      end if;
      if exists (select 1 from public.gl_accounts where sub_account_of_id = old.id and active) then
        raise exception 'This account has active sub-accounts; deactivate them first' using errcode = '22023';
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_gl_account_change() from public, anon, authenticated;
