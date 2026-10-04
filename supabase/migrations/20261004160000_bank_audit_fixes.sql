-- Bank audit fixes:
-- 1. complete_bank_transfer re-runs the shared transfer-account checks
--    (app_check_transfer_accounts: same portfolio, not archived, same
--    association, both linked to GL, caller may view both associations) and
--    stamps posted_at on the journal entry it posts.
-- 2. bank_transfers gets the restrictive association-scope policy that
--    bank_accounts / bank_deposits / journal_lines already have, so an
--    association-scoped manager cannot see or touch other associations'
--    transfers. A transfer has no association_id of its own, so the policy
--    checks both bank accounts' associations through a SECURITY DEFINER
--    lookup (a plain subquery would be filtered by bank_accounts RLS, return
--    null, and null passes can_view_association_row).
-- 3. void_credit_card_charge dates the reversal on the association's local
--    date instead of the UTC current_date.

-- 1 ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_bank_transfer(p_transfer_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  t public.bank_transfers;
  f public.bank_accounts;
  d public.bank_accounts;
  v_assoc uuid;
  v_entry uuid;
begin
  select * into t from public.bank_transfers where id = p_transfer_id for update;
  if not found or not public.can_manage_finance(t.portfolio_id) then
    raise exception 'Transfer not found';
  end if;
  if t.voided_at is not null then
    raise exception 'This transfer is void';
  end if;
  if t.journal_entry_id is not null then
    raise exception 'This transfer is already completed';
  end if;
  perform public.app_check_transfer_accounts(t.portfolio_id, t.from_bank_account_id, t.to_bank_account_id);
  select * into f from public.bank_accounts where id = t.from_bank_account_id and portfolio_id = t.portfolio_id;
  select * into d from public.bank_accounts where id = t.to_bank_account_id and portfolio_id = t.portfolio_id;
  if f.id is null or d.id is null then
    raise exception 'One of the transfer''s bank accounts was not found';
  end if;
  if not public.can_view_association_row(f.association_id) or not public.can_view_association_row(d.association_id) then
    raise exception 'This transfer involves an association you do not manage';
  end if;
  if f.gl_account_id is null or d.gl_account_id is null then
    raise exception 'Link both bank accounts to GL accounts before completing this transfer';
  end if;
  v_assoc := coalesce(f.association_id, d.association_id);

  select id into v_entry from public.journal_entries
   where source_type = 'bank_transfer' and source_id = t.id and not posted
   order by created_at desc limit 1;
  if v_entry is not null then
    update public.journal_entries set posted = true, posted_at = now() where id = v_entry;
    update public.bank_transfers set journal_entry_id = v_entry, updated_at = now() where id = t.id;
    return v_entry;
  end if;

  insert into public.journal_entries (portfolio_id, entry_date, description, reference_number, memo, source_type, source_id, posted, created_by)
  values (t.portfolio_id, t.transfer_date, 'Bank transfer — ' || f.name || ' → ' || d.name, t.reference_number, t.memo,
          'bank_transfer', t.id, false, auth.uid())
  returning id into v_entry;
  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order) values
    (v_entry, d.gl_account_id, coalesce(d.association_id, v_assoc), t.amount, 0, t.memo, 0),
    (v_entry, f.gl_account_id, coalesce(f.association_id, v_assoc), 0, t.amount, t.memo, 1);
  update public.journal_entries set posted = true, posted_at = now() where id = v_entry;
  update public.bank_transfers set journal_entry_id = v_entry, updated_at = now() where id = t.id;
  return v_entry;
end $function$;

-- 2 ------------------------------------------------------------------------
-- Association of a bank account, read past bank_accounts RLS (policy helper).
CREATE OR REPLACE FUNCTION public.app_bank_account_association_id(p_bank_account_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select ba.association_id from public.bank_accounts ba where ba.id = p_bank_account_id;
$function$;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'bank_transfers' and policyname = 'mgr_assoc_scope'
  ) then
    create policy mgr_assoc_scope on public.bank_transfers as restrictive for all to authenticated
      using (
        public.can_view_association_row(public.app_bank_account_association_id(from_bank_account_id))
        and public.can_view_association_row(public.app_bank_account_association_id(to_bank_account_id))
      );
  end if;
end $$;

-- 3 ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_credit_card_charge(p_charge_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  c public.credit_card_charges;
  v_entry uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into c from public.credit_card_charges where id = p_charge_id for update;
  if c.id is null or not (public.can_manage_finance(c.portfolio_id) and public.can_manage_association(c.association_id)) then
    raise exception 'Charge not found' using errcode = '42501';
  end if;
  if c.voided_at is not null then
    raise exception 'This charge is already void' using errcode = '22023';
  end if;
  if v_reason is null then
    raise exception 'Enter a reason for voiding' using errcode = '22023';
  end if;
  insert into public.journal_entries (portfolio_id, entry_date, reference_number, description, memo, source_type, source_id, posted, created_by)
  values (c.portfolio_id,
          coalesce(case when c.association_id is not null then public.association_local_date(c.association_id, now()) end, current_date),
          'VOID-' || coalesce(c.reference, left(c.id::text, 8)),
          left('Void: card charge ' || c.payee, 250), left(v_reason, 1000), 'credit_card_charge_void', c.id, false, auth.uid())
  returning id into v_entry;
  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
  select v_entry, jl.gl_account_id, jl.association_id, jl.credit_amount, jl.debit_amount, 'Void: ' || coalesce(jl.memo, ''), jl.sort_order
    from public.journal_lines jl where jl.entry_id = c.journal_entry_id;
  update public.journal_entries set posted = true, posted_at = now() where id = v_entry;
  update public.credit_card_charges
     set voided_at = now(), voided_by = auth.uid(), void_reason = left(v_reason, 500), void_journal_entry_id = v_entry
   where id = c.id;
end $function$;
