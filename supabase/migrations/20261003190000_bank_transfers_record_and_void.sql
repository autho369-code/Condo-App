-- Bank transfers (AppFolio parity + audit fixes).
-- 1. A transfer is recorded and posted in one RPC. The form used to insert the
--    transfer, then a draft entry, then lines, then post, as separate API calls;
--    any failure (closed period, a rule) left an "Incomplete" transfer and a
--    stray draft behind.
-- 2. Both accounts must belong to the same association (or both be
--    company-level): a company-level account paired with an association's
--    account tagged the company side with the association.
-- 3. Transfers can be voided: the posting is reversed on the void date and the
--    transfer is kept, marked void.
-- 4. Transfers are written only through these RPCs (amount, accounts or date
--    of a posted transfer could be edited directly through the API).

alter table public.bank_transfers
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists void_reason text,
  add column if not exists void_entry_id uuid references public.journal_entries(id);

revoke all on public.bank_transfers from anon, authenticated;
grant select on public.bank_transfers to authenticated;

-- Shared checks for a pair of bank accounts.
create or replace function public.app_check_transfer_accounts(p_pid uuid, p_from uuid, p_to uuid)
returns void language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare f public.bank_accounts; d public.bank_accounts;
begin
  if p_from is null or p_to is null then raise exception 'Select both a source and destination account' using errcode = '22023'; end if;
  if p_from = p_to then raise exception 'Source and destination must be different accounts' using errcode = '22023'; end if;
  select * into f from public.bank_accounts where id = p_from and portfolio_id = p_pid and archived_at is null;
  select * into d from public.bank_accounts where id = p_to and portfolio_id = p_pid and archived_at is null;
  if f.id is null or d.id is null then raise exception 'One of those bank accounts was not found' using errcode = 'P0002'; end if;
  if not public.can_view_association_row(f.association_id) or not public.can_view_association_row(d.association_id) then
    raise exception 'This transfer involves an association you do not manage' using errcode = '42501';
  end if;
  if f.association_id is distinct from d.association_id then
    raise exception 'Those accounts belong to different associations (or one is company-level). A transfer moves money within one association.' using errcode = '22023';
  end if;
  if f.gl_account_id is null or d.gl_account_id is null then
    raise exception 'Link both bank accounts to GL accounts before recording a transfer' using errcode = '22023';
  end if;
end $$;
revoke all on function public.app_check_transfer_accounts(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.record_bank_transfer(
  p_from uuid, p_to uuid, p_amount numeric, p_transfer_date date, p_reference text, p_memo text,
  p_authorize_cross_fund boolean, p_authorization_note text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.current_portfolio_id();
  f public.bank_accounts;
  d public.bank_accounts;
  v_id uuid;
  v_entry uuid;
  v_amt numeric := round(p_amount, 2);
  v_memo text := nullif(btrim(coalesce(p_memo, '')), '');
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
  v_cross boolean;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if v_amt is null or v_amt <= 0 then raise exception 'Enter an amount greater than zero' using errcode = '22023'; end if;
  if p_transfer_date is null then raise exception 'Choose the transfer date' using errcode = '22023'; end if;
  perform public.app_check_transfer_accounts(v_pid, p_from, p_to);
  select * into f from public.bank_accounts where id = p_from;
  select * into d from public.bank_accounts where id = p_to;
  v_cross := f.fund_type is distinct from d.fund_type;
  if v_cross and (not coalesce(p_authorize_cross_fund, false) or length(btrim(coalesce(p_authorization_note, ''))) = 0) then
    raise exception 'Moving money from a % account to a % account needs authorization: tick the box and note the board approval or reason',
      coalesce(f.fund_type::text, 'unclassified'), coalesce(d.fund_type::text, 'unclassified') using errcode = '22023';
  end if;

  insert into public.bank_transfers (portfolio_id, from_bank_account_id, to_bank_account_id, amount, transfer_date,
    reference_number, memo, created_by, authorized_by, authorization_note)
  values (v_pid, f.id, d.id, v_amt, p_transfer_date, v_ref, v_memo, auth.uid(),
          case when v_cross then auth.uid() end, case when v_cross then left(btrim(p_authorization_note), 1000) end)
  returning id into v_id;

  insert into public.journal_entries (portfolio_id, entry_date, description, reference_number, memo, source_type, source_id, posted, created_by)
  values (v_pid, p_transfer_date, 'Bank transfer — ' || f.name || ' → ' || d.name, v_ref, v_memo, 'bank_transfer', v_id, false, auth.uid())
  returning id into v_entry;
  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order) values
    (v_entry, d.gl_account_id, d.association_id, v_amt, 0, v_memo, 0),
    (v_entry, f.gl_account_id, f.association_id, 0, v_amt, v_memo, 1);
  update public.journal_entries set posted = true, posted_at = now() where id = v_entry;
  update public.bank_transfers set journal_entry_id = v_entry where id = v_id;
  return v_id;
end $$;

create or replace function public.void_bank_transfer(p_id uuid, p_void_date date, p_reason text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  t public.bank_transfers;
  f public.bank_accounts;
  d public.bank_accounts;
  v_rev uuid;
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

  if t.journal_entry_id is not null then
    insert into public.journal_entries (portfolio_id, entry_date, description, memo, reference_number, source_type, source_id, posted, created_by)
    values (t.portfolio_id, coalesce(p_void_date, current_date), 'Void bank transfer — ' || f.name || ' → ' || d.name,
            btrim(p_reason), t.reference_number, 'bank_transfer_void', t.id, false, auth.uid())
    returning id into v_rev;
    insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
    select v_rev, gl_account_id, association_id, credit_amount, debit_amount, 'Void: ' || btrim(p_reason), sort_order
      from public.journal_lines where entry_id = t.journal_entry_id;
    update public.journal_entries set posted = true, posted_at = now() where id = v_rev;
  else
    -- Never posted (an old incomplete transfer): nothing to reverse.
    v_rev := null;
  end if;
  update public.bank_transfers set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason), void_entry_id = v_rev, updated_at = now()
   where id = t.id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (t.portfolio_id, 'bank_transfer', t.id, 'voided', auth.uid(), jsonb_build_object('reason', btrim(p_reason), 'amount', t.amount));
  return v_rev;
end $$;

-- Completing an old incomplete transfer follows the same account rules and
-- never completes a voided one.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.complete_bank_transfer(uuid)'::regprocedure);
  if position('if t.journal_entry_id is not null then' in def) = 0 then raise exception 'complete_bank_transfer drifted'; end if;
  def := replace(def, 'if t.journal_entry_id is not null then',
    'if t.voided_at is not null then' || chr(10) || '    raise exception ''This transfer is void'';' || chr(10) || '  end if;' || chr(10) ||
    '  if t.journal_entry_id is not null then');
  execute def;
end $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.record_bank_transfer(uuid, uuid, numeric, date, text, text, boolean, text)',
    'public.void_bank_transfer(uuid, date, text)'] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- Transfer register: show each transfer's status, so a voided transfer reads Void.
create or replace function public.report_data_transfer_register(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select bt.transfer_date, fa.name as from_account, ta.name as to_account, bt.amount, bt.reference_number, bt.memo,
           case when bt.voided_at is not null then 'Void' when bt.journal_entry_id is null then 'Incomplete' else 'Posted' end as status
      from public.bank_transfers bt cross join prm
      left join public.bank_accounts fa on fa.id = bt.from_bank_account_id
      left join public.bank_accounts ta on ta.id = bt.to_bank_account_id
      where bt.portfolio_id = p_portfolio_id and bt.transfer_date between prm.df and prm.dt
        and (prm.aid is null or fa.association_id = prm.aid or ta.association_id = prm.aid)
      order by bt.transfer_date
  ) r;
$$;
