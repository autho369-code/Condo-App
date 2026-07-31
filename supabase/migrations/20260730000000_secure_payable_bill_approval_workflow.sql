-- Make bill creation and workflow transitions explicit, tenant-safe, and
-- compatible with the existing board approval settings.
alter table public.payable_bills
  add column if not exists approval_request_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'payable_bills_approval_request_id_fkey'
       and conrelid = 'public.payable_bills'::regclass
  ) then
    alter table public.payable_bills
      add constraint payable_bills_approval_request_id_fkey
      foreign key (approval_request_id) references public.approval_requests(id) on delete set null;
  end if;
end $$;

create unique index if not exists payable_bills_approval_request_unique
  on public.payable_bills (approval_request_id)
  where approval_request_id is not null;

create or replace function public.validate_payable_bill_integrity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.amount is null or new.amount <= 0 then
    raise exception 'Bill amount must be positive';
  end if;
  if not exists (
    select 1 from public.vendors v
     where v.id = new.vendor_id and v.portfolio_id = new.portfolio_id and v.archived_at is null
  ) then
    raise exception 'Vendor is outside the bill portfolio or archived';
  end if;
  if new.association_id is not null and not exists (
    select 1 from public.associations a
     where a.id = new.association_id and a.portfolio_id = new.portfolio_id and a.archived_at is null
  ) then
    raise exception 'Association is outside the bill portfolio or archived';
  end if;
  if new.gl_account_id is not null and not exists (
    select 1 from public.gl_accounts g
     where g.id = new.gl_account_id
       and g.portfolio_id = new.portfolio_id
       and g.active
       and (g.association_id is null or g.association_id = new.association_id)
  ) then
    raise exception 'Expense GL account is outside the bill portfolio/association or inactive';
  end if;
  if new.bank_account_id is not null and not exists (
    select 1 from public.bank_accounts b
     where b.id = new.bank_account_id
       and b.portfolio_id = new.portfolio_id
       and b.archived_at is null
       and (b.association_id is null or b.association_id = new.association_id)
  ) then
    raise exception 'Bank account is outside the bill portfolio/association or archived';
  end if;
  if new.approval_request_id is not null and not exists (
    select 1 from public.approval_requests r
     where r.id = new.approval_request_id
       and r.portfolio_id = new.portfolio_id
       and r.association_id = new.association_id
       and r.vendor_id is not distinct from new.vendor_id
       and r.amount is not distinct from new.amount
  ) then
    raise exception 'Approval request does not match the bill';
  end if;

  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if tg_op = 'INSERT' and (
      new.status not in ('draft'::public.payable_bill_status, 'pending_approval'::public.payable_bill_status)
      or new.approved_by is not null or new.approved_at is not null
      or new.paid_at is not null or new.check_number is not null
    ) then
      raise exception 'Bill workflow state must be changed through an authorized workflow';
    end if;
    if tg_op = 'UPDATE' and (
      new.status is distinct from old.status
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at
      or new.paid_at is distinct from old.paid_at
      or new.check_number is distinct from old.check_number
      or new.approval_request_id is distinct from old.approval_request_id
    ) then
      raise exception 'Bill workflow state must be changed through an authorized workflow';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_payable_bill_integrity on public.payable_bills;
create trigger trg_validate_payable_bill_integrity
before insert or update on public.payable_bills
for each row execute function public.validate_payable_bill_integrity();

create or replace function public.request_payable_bill_approval(p_bill_id uuid)
returns uuid
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  bill_row public.payable_bills;
  settings_row public.board_approval_settings;
  member_ids uuid[];
  member_count integer;
  required_count integer;
  request_id uuid;
  vendor_name text;
begin
  select * into bill_row from public.payable_bills where id = p_bill_id for update;
  if not found then raise exception 'Bill not found'; end if;
  if not public.can_manage_finance(bill_row.portfolio_id) then raise exception 'Permission denied'; end if;
  if bill_row.status not in ('draft'::public.payable_bill_status, 'pending_approval'::public.payable_bill_status) then
    raise exception 'Only draft or pending bills can be submitted for approval';
  end if;
  if bill_row.approval_request_id is not null then return bill_row.approval_request_id; end if;

  if not bill_row.approval_required then
    update public.payable_bills
       set status = 'pending_approval'::public.payable_bill_status, updated_at = now()
     where id = p_bill_id;
    return null;
  end if;
  if bill_row.association_id is null then
    raise exception 'Board-approved bills require an association';
  end if;

  select * into settings_row from public.board_approval_settings
   where association_id = bill_row.association_id;
  select coalesce(array_agg(bm.id order by bm.id), '{}'::uuid[])
    into member_ids
    from public.board_members bm
   where bm.association_id = bill_row.association_id
     and bm.active
     and (
       coalesce(cardinality(settings_row.default_board_member_ids), 0) = 0
       or bm.id = any(settings_row.default_board_member_ids)
     );
  member_count := coalesce(cardinality(member_ids), 0);
  if member_count = 0 then raise exception 'No active board approvers are configured'; end if;

  settings_row.default_voting_scheme := coalesce(settings_row.default_voting_scheme, 'majority_approval_required'::public.voting_scheme);
  settings_row.signatures_required := coalesce(settings_row.signatures_required, true);
  required_count := case settings_row.default_voting_scheme
    when 'any_one_approver'::public.voting_scheme then 1
    when 'unanimous_approval_required'::public.voting_scheme then member_count
    when 'percentage_required'::public.voting_scheme then greatest(1, ceil(member_count * coalesce(settings_row.default_percentage_required, 100) / 100.0)::integer)
    else floor(member_count / 2.0)::integer + 1
  end;
  select name into vendor_name from public.vendors where id = bill_row.vendor_id;

  insert into public.approval_requests (
    portfolio_id, association_id, vendor_id, request_type, title, description,
    requested_by_name, requested_by_email, amount, due_date, status,
    voting_scheme, required_votes, signatures_required, board_member_ids,
    percentage_required, requested_at
  ) values (
    bill_row.portfolio_id, bill_row.association_id, bill_row.vendor_id, 'expense',
    'Bill ' || coalesce(nullif(trim(bill_row.bill_number), ''), left(bill_row.id::text, 8)) || ' — ' || coalesce(vendor_name, 'Vendor'),
    bill_row.memo, coalesce((select full_name from public.profiles where id = auth.uid()), 'Portier369 staff'),
    (select email from auth.users where id = auth.uid()), bill_row.amount, bill_row.due_date, 'pending',
    settings_row.default_voting_scheme, required_count, settings_row.signatures_required,
    member_ids, settings_row.default_percentage_required, now()
  ) returning id into request_id;

  update public.payable_bills
     set status = 'pending_approval'::public.payable_bill_status,
         approval_request_id = request_id,
         updated_at = now()
   where id = p_bill_id;
  return request_id;
end;
$$;

create or replace function public.create_payable_bill(
  p_portfolio_id uuid,
  p_vendor_id uuid,
  p_association_id uuid,
  p_gl_account_id uuid,
  p_bank_account_id uuid,
  p_bill_number text,
  p_bill_date date,
  p_due_date date,
  p_amount numeric,
  p_memo text,
  p_submit_for_approval boolean,
  p_board_approval boolean
) returns uuid
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  bill_id uuid;
  board_mode text := 'never';
  board_threshold numeric;
  requires_board boolean;
begin
  if p_portfolio_id is null or not public.can_manage_finance(p_portfolio_id) then raise exception 'Permission denied'; end if;
  if p_vendor_id is null or p_bill_date is null or p_amount is null or p_amount <= 0 then
    raise exception 'Vendor, bill date, and a positive amount are required';
  end if;
  if p_association_id is not null then
    select coalesce(s.sends_bills_to_board, 'never'), s.bills_threshold
      into board_mode, board_threshold
      from public.board_approval_settings s
     where s.association_id = p_association_id;
  end if;
  requires_board := coalesce(p_board_approval, false)
    or board_mode = 'always'
    or (board_mode = 'over_threshold' and p_amount >= coalesce(board_threshold, 0));
  if requires_board and p_association_id is null then
    raise exception 'Board-approved bills require an association';
  end if;

  insert into public.payable_bills (
    portfolio_id, vendor_id, association_id, gl_account_id, bank_account_id,
    bill_number, bill_date, due_date, amount, memo, status,
    approval_required, created_by
  ) values (
    p_portfolio_id, p_vendor_id, p_association_id, p_gl_account_id, p_bank_account_id,
    nullif(trim(coalesce(p_bill_number, '')), ''), p_bill_date, p_due_date, p_amount,
    nullif(trim(coalesce(p_memo, '')), ''), 'draft'::public.payable_bill_status,
    requires_board, auth.uid()
  ) returning id into bill_id;

  if coalesce(p_submit_for_approval, false) then
    perform public.request_payable_bill_approval(bill_id);
  end if;
  return bill_id;
end;
$$;

create or replace function public.approve_payable_bill(p_bill_id uuid)
returns uuid
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  entry_id uuid;
  bill_row public.payable_bills;
  request_status public.approval_request_status;
begin
  select * into bill_row from public.payable_bills where id = p_bill_id for update;
  if not found then raise exception 'Bill not found'; end if;
  if not public.can_manage_finance(bill_row.portfolio_id) then raise exception 'Permission denied'; end if;
  if bill_row.status not in ('draft'::public.payable_bill_status, 'pending_approval'::public.payable_bill_status, 'approved'::public.payable_bill_status) then
    raise exception 'Paid or void bills cannot be approved';
  end if;
  if bill_row.approval_required then
    if bill_row.approval_request_id is null then raise exception 'Board approval has not been requested'; end if;
    select status into request_status from public.approval_requests
     where id = bill_row.approval_request_id
       and portfolio_id = bill_row.portfolio_id
       and association_id = bill_row.association_id;
    if request_status is distinct from 'approved'::public.approval_request_status then
      raise exception 'Board approval is not complete';
    end if;
  end if;
  update public.payable_bills
     set status = 'approved'::public.payable_bill_status,
         approved_at = coalesce(approved_at, now()),
         approved_by = coalesce(approved_by, auth.uid()),
         updated_at = now()
   where id = p_bill_id;
  entry_id := public.ensure_payable_bill_accrual(p_bill_id);
  return entry_id;
end;
$$;

-- Board votes must go through this RPC so the configured voter list, request
-- state, and signature requirement cannot be bypassed with a direct table write.
create or replace function public.cast_board_approval(
  p_request_id uuid,
  p_decision text,
  p_signature text,
  p_comment text
) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  r public.approval_requests%rowtype;
  v_member_id uuid;
  v_for integer;
  v_against integer;
  v_abstain integer;
  v_eligible integer;
  v_new_status public.approval_request_status;
begin
  select * into r from public.approval_requests where id = p_request_id for update;
  if not found then raise exception 'Approval request not found'; end if;
  if r.status is distinct from 'pending'::public.approval_request_status then
    raise exception 'This approval request is already finalized';
  end if;

  select bm.id into v_member_id
    from public.board_members bm
   where bm.auth_user_id = auth.uid()
     and bm.active
     and bm.association_id = r.association_id
   limit 1;
  if v_member_id is null then raise exception 'Not a board member for this request'; end if;
  if coalesce(cardinality(r.board_member_ids), 0) > 0
     and not (v_member_id = any(r.board_member_ids)) then
    raise exception 'Not an eligible voter for this approval request';
  end if;
  if p_decision not in ('approve', 'reject', 'abstain') then
    raise exception 'Invalid decision: %', p_decision;
  end if;
  if coalesce(r.signatures_required, false)
     and nullif(btrim(coalesce(p_signature, '')), '') is null then
    raise exception 'Signature required';
  end if;

  insert into public.approval_decisions (
    approval_request_id, board_member_id, decided_by, decision,
    signature_name, comment, decided_at
  ) values (
    p_request_id, v_member_id, auth.uid(), p_decision,
    nullif(btrim(coalesce(p_signature, '')), ''),
    nullif(btrim(coalesce(p_comment, '')), ''), now()
  )
  on conflict (approval_request_id, decided_by) do update
     set decision = excluded.decision,
         signature_name = excluded.signature_name,
         comment = excluded.comment,
         board_member_id = excluded.board_member_id,
         decided_at = now();

  select count(*) filter (where decision = 'approve'),
         count(*) filter (where decision = 'reject'),
         count(*) filter (where decision = 'abstain')
    into v_for, v_against, v_abstain
    from public.approval_decisions
   where approval_request_id = p_request_id;

  if coalesce(cardinality(r.board_member_ids), 0) > 0 then
    v_eligible := cardinality(r.board_member_ids);
  else
    select count(*) into v_eligible from public.board_members
     where association_id = r.association_id and active;
  end if;
  v_eligible := greatest(coalesce(v_eligible, 0), 0);

  v_new_status := null;
  if r.voting_scheme = 'any_one_approver' then
    if v_for >= 1 then v_new_status := 'approved';
    elsif v_for + v_against + v_abstain >= v_eligible and v_for = 0 then v_new_status := 'rejected';
    end if;
  elsif r.voting_scheme = 'majority_approval_required' then
    if v_for > v_eligible / 2.0 then v_new_status := 'approved';
    elsif v_against >= ceil(v_eligible / 2.0) then v_new_status := 'rejected';
    end if;
  elsif r.voting_scheme = 'unanimous_approval_required' then
    if v_eligible > 0 and v_for = v_eligible then v_new_status := 'approved';
    elsif v_against >= 1 then v_new_status := 'rejected';
    end if;
  elsif r.voting_scheme = 'percentage_required' then
    if v_for * 100.0 / greatest(v_eligible, 1)
       >= coalesce(r.percentage_required, r.required_votes, 100) then
      v_new_status := 'approved';
    elsif (v_eligible - v_against - v_abstain) * 100.0 / greatest(v_eligible, 1)
          < coalesce(r.percentage_required, 100) then
      v_new_status := 'rejected';
    end if;
  end if;

  update public.approval_requests
     set votes_for = v_for,
         votes_against = v_against,
         votes_abstain = v_abstain,
         status = coalesce(v_new_status, status),
         decision_by = case when v_new_status is null then decision_by else auth.uid() end,
         decision_at = case when v_new_status is null then decision_at else now() end
   where id = p_request_id;
end;
$$;

alter function public.ensure_payable_bill_accrual(uuid) security definer;
alter function public.ensure_payable_bill_accrual(uuid) owner to postgres;
alter function public.approve_payable_bill(uuid) owner to postgres;
alter function public.void_payable_bill(uuid) security definer;
alter function public.void_payable_bill(uuid) owner to postgres;
alter function public.request_payable_bill_approval(uuid) owner to postgres;
alter function public.create_payable_bill(uuid, uuid, uuid, uuid, uuid, text, date, date, numeric, text, boolean, boolean) owner to postgres;
alter function public.cast_board_approval(uuid, text, text, text) owner to postgres;

revoke insert, update, delete on public.payable_bills from authenticated;
revoke insert, update, delete on public.approval_decisions from authenticated;
revoke all on function public.request_payable_bill_approval(uuid) from public, anon;
revoke all on function public.create_payable_bill(uuid, uuid, uuid, uuid, uuid, text, date, date, numeric, text, boolean, boolean) from public, anon;
revoke all on function public.approve_payable_bill(uuid) from public, anon;
revoke all on function public.void_payable_bill(uuid) from public, anon;
revoke all on function public.cast_board_approval(uuid, text, text, text) from public, anon;
grant execute on function public.request_payable_bill_approval(uuid) to authenticated, service_role;
grant execute on function public.create_payable_bill(uuid, uuid, uuid, uuid, uuid, text, date, date, numeric, text, boolean, boolean) to authenticated, service_role;
grant execute on function public.approve_payable_bill(uuid) to authenticated, service_role;
grant execute on function public.void_payable_bill(uuid) to authenticated, service_role;
grant execute on function public.cast_board_approval(uuid, text, text, text) to authenticated, service_role;
