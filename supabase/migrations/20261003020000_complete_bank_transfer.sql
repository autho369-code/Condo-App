-- Complete (post) an incomplete bank transfer: one that has no journal entry
-- because its posting failed when it was recorded. Checks finance access,
-- that the caller manages both accounts' associations and that both accounts
-- are linked to GL accounts, then posts debit destination / credit source and
-- links the entry to the transfer. A leftover draft for the transfer is
-- posted instead of creating a second entry. Used by "Complete" and "Complete selected" on Bank Transfers.
create or replace function public.complete_bank_transfer(p_transfer_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
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
  if t.journal_entry_id is not null then
    raise exception 'This transfer is already completed';
  end if;
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

  -- A draft left by the original (failed) post is posted as is.
  select id into v_entry from public.journal_entries
   where source_type = 'bank_transfer' and source_id = t.id and not posted
   order by created_at desc limit 1;
  if v_entry is not null then
    update public.journal_entries set posted = true where id = v_entry;
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
  update public.journal_entries set posted = true where id = v_entry;
  update public.bank_transfers set journal_entry_id = v_entry, updated_at = now() where id = t.id;
  return v_entry;
end $$;

revoke all on function public.complete_bank_transfer(uuid) from public, anon;
grant execute on function public.complete_bank_transfer(uuid) to authenticated;
