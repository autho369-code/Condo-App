-- Voiding an old incomplete transfer must account for entries the previous
-- multi-step form may have left tied to it: a posted entry that never got
-- linked is reversed; a draft blocks the void until it is discarded (and a
-- draft can never be posted for a void transfer).
create or replace function public.void_bank_transfer(p_id uuid, p_void_date date, p_reason text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  t public.bank_transfers;
  f public.bank_accounts;
  d public.bank_accounts;
  v_rev uuid;
  v_src uuid;
  v_first uuid;
begin
  select * into t from public.bank_transfers where id = p_id for update;
  if not found or not public.can_manage_finance(t.portfolio_id) then raise exception 'Transfer not found' using errcode = 'P0002'; end if;
  select * into f from public.bank_accounts where id = t.from_bank_account_id;
  select * into d from public.bank_accounts where id = t.to_bank_account_id;
  if not public.can_view_association_row(f.association_id) or not public.can_view_association_row(d.association_id) then
    raise exception 'This transfer involves an association you do not manage' using errcode = '42501';
  end if;
  if t.voided_at is not null then raise exception 'This transfer is already void' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason for voiding the transfer' using errcode = '22023'; end if;
  if exists (select 1 from public.journal_entries where source_type = 'bank_transfer' and source_id = t.id and not posted) then
    raise exception 'This transfer has a draft journal entry. Discard it on Journal Entries (Drafts), then void the transfer.' using errcode = '22023';
  end if;

  -- Every posted entry of the transfer: the linked one, plus any the old form
  -- posted without linking.
  for v_src in
    select id from public.journal_entries
     where posted and (id = t.journal_entry_id or (source_type = 'bank_transfer' and source_id = t.id))
     order by created_at
  loop
    insert into public.journal_entries (portfolio_id, entry_date, description, memo, reference_number, source_type, source_id, posted, created_by)
    values (t.portfolio_id, coalesce(p_void_date, current_date), 'Void bank transfer — ' || f.name || ' → ' || d.name,
            btrim(p_reason), t.reference_number, 'bank_transfer_void', t.id, false, auth.uid())
    returning id into v_rev;
    insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
    select v_rev, gl_account_id, association_id, credit_amount, debit_amount, 'Void: ' || btrim(p_reason), sort_order
      from public.journal_lines where entry_id = v_src;
    update public.journal_entries set posted = true, posted_at = now() where id = v_rev;
    v_first := coalesce(v_first, v_rev);
  end loop;

  update public.bank_transfers set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason), void_entry_id = v_first, updated_at = now()
   where id = t.id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (t.portfolio_id, 'bank_transfer', t.id, 'voided', auth.uid(), jsonb_build_object('reason', btrim(p_reason), 'amount', t.amount));
  return v_first;
end $$;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.draft_journal_entry_action(uuid, text)'::regprocedure);
  if position('and journal_entry_id is null;' in def) = 0 then raise exception 'draft_journal_entry_action drifted'; end if;
  def := replace(def, 'and journal_entry_id is null;', 'and journal_entry_id is null' || chr(10) || '         and voided_at is null;');
  def := replace(def, 'was not found or is already posted', 'was not found, is already posted, or is void');
  execute def;
end $$;
