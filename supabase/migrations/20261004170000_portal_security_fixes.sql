-- Board and owner portal audit (2026-10-04): database-side fixes.
-- Additive only: restrictive policies narrow what existing permissive
-- policies allow; functions are replaced with the same signatures.

-- ── 1. approval_requests: no forged requests ─────────────────────────────────
-- approval_requests_resident_insert only checked owner_id, so any owner could
-- insert a request into any association (another company's included), with
-- any status, voters and requester name. The app never inserts as an owner.
-- Staff keep inserting as before; an owner may only file a fresh, pending,
-- unvoted request in an association they live in.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'approval_requests' and policyname = 'approval_requests_insert_guard') then
    create policy approval_requests_insert_guard on public.approval_requests
      as restrictive for insert to authenticated
      with check (
        public.can_access_portfolio(portfolio_id)
        or (
          owner_id is not null
          and owner_id = public.current_owner_id()
          and association_id in (select public.current_resident_association_ids())
          and portfolio_id = (select a.portfolio_id from public.associations a where a.id = association_id)
          and status = 'pending'
          and coalesce(votes_for, 0) = 0 and coalesce(votes_against, 0) = 0 and coalesce(votes_abstain, 0) = 0
          and coalesce(cardinality(board_member_ids), 0) = 0
          and decision_by is null and decision_at is null
        )
      );
  end if;
end $$;

-- ── 2. cast_board_approval: current board seat, live request, no self-approval
create or replace function public.cast_board_approval(p_request_id uuid, p_decision text, p_signature text, p_comment text)
 returns void
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  r public.approval_requests%rowtype;
  v_member_id uuid;
  v_for integer;
  v_against integer;
  v_abstain integer;
  v_eligible integer;
  v_new_status public.approval_request_status;
  v_email text;
  v_pct numeric;
begin
  select * into r from public.approval_requests where id = p_request_id for update;
  if not found then raise exception 'Approval request not found'; end if;
  if r.archived_at is not null then raise exception 'Approval request not found'; end if;
  if r.status is distinct from 'pending'::public.approval_request_status then
    raise exception 'This approval request is already finalized';
  end if;
  -- The same eligibility the rest of the board portal uses (enabled profile,
  -- board role, live association), not just a board_members row.
  if r.association_id is null or r.association_id not in (select public.current_board_association_ids()) then
    raise exception 'Not a board member for this request';
  end if;
  if r.owner_id is not null and r.owner_id = public.current_owner_id() then
    raise exception 'You cannot vote on your own request';
  end if;

  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is not null then
    update public.board_members bm
       set auth_user_id = auth.uid()
     where bm.auth_user_id is null
       and bm.active
       and bm.association_id = r.association_id
       and lower(bm.email) = v_email;
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
    select count(*) into v_eligible from public.board_members where association_id = r.association_id and active;
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
    -- Unanimous means every eligible member approves. A rejection or an
    -- abstention makes that impossible, so the request fails right away.
    if v_against >= 1 or v_abstain >= 1 then v_new_status := 'rejected';
    elsif v_eligible > 0 and v_for >= v_eligible then v_new_status := 'approved';
    end if;
  elsif r.voting_scheme = 'percentage_required' then
    -- One threshold for both outcomes. Without a percentage, require more than
    -- half (required_votes is a vote count, never a percentage).
    v_pct := coalesce(r.percentage_required::numeric, 50.0001);
    if v_for * 100.0 / greatest(v_eligible, 1) >= v_pct then
      v_new_status := 'approved';
    elsif (v_eligible - v_against - v_abstain) * 100.0 / greatest(v_eligible, 1) < v_pct then
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
$function$;

-- ── 3. board_comments: stay in your association, keep your name ──────────────
-- board_update_own_comments had no WITH CHECK, so a board member could move a
-- comment into another association's violation and change author_name; the
-- insert check never tied violation_id to association_id.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'board_comments' and policyname = 'board_comments_write_guard') then
    create policy board_comments_write_guard on public.board_comments
      as restrictive for insert to authenticated
      with check (
        (violation_id is null or exists (
          select 1 from public.violations v where v.id = violation_id and v.association_id = board_comments.association_id))
        and (
          public.is_platform_operator()
          or (public.is_full_access_staff() and exists (
            select 1 from public.associations a where a.id = board_comments.association_id and a.portfolio_id = public.current_portfolio_id()))
          or association_id in (select public.current_board_association_ids())
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'board_comments' and policyname = 'board_comments_update_guard') then
    create policy board_comments_update_guard on public.board_comments
      as restrictive for update to authenticated
      using (true)
      with check (
        (violation_id is null or exists (
          select 1 from public.violations v where v.id = violation_id and v.association_id = board_comments.association_id))
        and (
          public.is_platform_operator()
          or (public.is_full_access_staff() and exists (
            select 1 from public.associations a where a.id = board_comments.association_id and a.portfolio_id = public.current_portfolio_id()))
          or association_id in (select public.current_board_association_ids())
        )
      );
  end if;
  -- Board members linked to their seat by email (no auth_user_id yet) can see
  -- their association's comments too.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'board_comments' and policyname = 'board_comments_board_read') then
    create policy board_comments_board_read on public.board_comments
      for select to authenticated
      using (association_id in (select public.current_board_association_ids()));
  end if;
end $$;

-- Where a comment lives and who wrote it never change after it is posted, and
-- a board member's comment carries their own profile name.
create or replace function public.board_comments_guard_identity()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' then
    new.association_id := old.association_id;
    new.violation_id := old.violation_id;
    new.author_id := old.author_id;
    new.author_name := old.author_name;
  elsif auth.uid() is not null and not public.is_any_staff() and not public.is_platform_operator() then
    new.author_name := coalesce(
      (select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.display_name), ''), p.email) from public.profiles p where p.id = auth.uid()),
      new.author_name);
  end if;
  return new;
end $$;
revoke all on function public.board_comments_guard_identity() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'board_comments_guard_identity' and tgrelid = 'public.board_comments'::regclass) then
    create trigger board_comments_guard_identity before insert or update on public.board_comments
      for each row execute function public.board_comments_guard_identity();
  end if;
end $$;

-- ── 4. autopay_mandates: owners read, never write directly ───────────────────
-- autopay_owner_self is FOR ALL, so an owner could raise their own cap,
-- reactivate a canceled mandate or delete the ACH authorization through the
-- API. The portal writes mandates with the service role after its own checks
-- (and Stripe webhooks / the runner use the service role), so signed-in
-- writes are limited to finance staff.
do $$
declare v_cmd text;
begin
  foreach v_cmd in array array['insert', 'update', 'delete'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'autopay_mandates' and policyname = 'autopay_write_finance_only_' || v_cmd) then
      if v_cmd = 'insert' then
        execute 'create policy autopay_write_finance_only_insert on public.autopay_mandates as restrictive for insert to authenticated with check (public.can_manage_finance(portfolio_id) or public.is_platform_operator())';
      elsif v_cmd = 'update' then
        execute 'create policy autopay_write_finance_only_update on public.autopay_mandates as restrictive for update to authenticated using (public.can_manage_finance(portfolio_id) or public.is_platform_operator()) with check (public.can_manage_finance(portfolio_id) or public.is_platform_operator())';
      else
        execute 'create policy autopay_write_finance_only_delete on public.autopay_mandates as restrictive for delete to authenticated using (public.can_manage_finance(portfolio_id) or public.is_platform_operator())';
      end if;
    end if;
  end loop;
end $$;

-- ── 5. survey_responses: only your own company's surveys ─────────────────────
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'survey_responses' and policyname = 'survey_responses_resident_scope') then
    create policy survey_responses_resident_scope on public.survey_responses
      as restrictive for insert to authenticated
      with check (
        submitted_by_owner_id is null
        or exists (
          select 1 from public.surveys s
           where s.id = survey_responses.survey_id
             and (public.can_access_portfolio(s.portfolio_id)
                  or (s.portfolio_id = public.current_portfolio_id()
                      and (s.association_id is null or s.association_id in (select public.current_resident_association_ids()))))
        )
      );
  end if;
end $$;

-- ── 6. owner_open_emergencies: no other units' details, current company only
-- Work-order titles can name another owner and unit ("Unit 4B flooding –
-- Mrs. Jones"); owners see only that an emergency is open.
create or replace function public.owner_open_emergencies()
 returns table(title text, created_at timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select case
           when wo.unit_id is not null and wo.unit_id in (select public.current_resident_unit_ids()) then wo.title
           else 'Emergency maintenance in progress in your community'
         end,
         wo.created_at
  from public.work_orders wo
  where wo.priority = 'emergency'
    and wo.archived_at is null
    and wo.status not in ('done', 'completed', 'billed', 'closed', 'cancelled')
    and wo.association_id in (select public.current_resident_association_ids())
  order by wo.created_at desc
  limit 5
$function$;

-- ── 7. get_meeting_financial_snapshot: this association's cash only ──────────
-- Bank GL accounts are portfolio-wide, so summing every posted line on them
-- counted other associations' cash in this board's snapshot. Payables count
-- approved bills only (drafts and bills awaiting approval are not owed yet).
create or replace function public.get_meeting_financial_snapshot(p_association_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_total_receivables numeric := 0;
  v_total_payables numeric := 0;
  v_delinquency_count integer := 0;
  v_bank_balance numeric := 0;
  v_current_month_income numeric := 0;
  v_current_month_expenses numeric := 0;
begin
  if auth.uid() is null or p_association_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.can_read_association_budget(p_association_id) then
    raise exception 'Not authorized for this association' using errcode = '42501';
  end if;

  select coalesce(sum(greatest(coalesce(ub.balance, 0), 0)), 0)
  into v_total_receivables
  from public.unit_balances ub
  where ub.association_id = p_association_id;

  select coalesce(sum(pb.amount - pb.credit_applied), 0)
  into v_total_payables
  from public.payable_bills pb
  where pb.association_id = p_association_id
    and pb.archived_at is null
    and pb.status = 'approved';

  select count(distinct o.unit_id)::integer
  into v_delinquency_count
  from public.occupancies o
  join public.units u on u.id = o.unit_id
  join public.buildings b on b.id = u.building_id
  where b.association_id = p_association_id
    and o.status = 'current'
    and o.dues_paid_through < date_trunc('month', pg_catalog.now())::date;

  select coalesce(sum(jl.debit_amount - jl.credit_amount), 0)
  into v_bank_balance
  from public.journal_lines jl
  join public.journal_entries je on je.id = jl.entry_id
  where je.posted
    and jl.association_id = p_association_id
    and exists (
      select 1
      from public.bank_accounts ba
      join public.associations a
        on a.id = ba.association_id
       and a.portfolio_id = ba.portfolio_id
      where ba.association_id = p_association_id
        and ba.archived_at is null
        and ba.gl_account_id = jl.gl_account_id
        and je.portfolio_id = a.portfolio_id
    );

  select coalesce(sum(c.amount), 0)
  into v_current_month_income
  from public.charges c
  join public.units u on u.id = c.unit_id
  join public.buildings b on b.id = u.building_id
  where b.association_id = p_association_id
    and c.created_at >= date_trunc('month', pg_catalog.now());

  select coalesce(sum(pb.amount), 0)
  into v_current_month_expenses
  from public.payable_bills pb
  where pb.association_id = p_association_id
    and pb.archived_at is null
    and pb.occurred_on >= date_trunc('month', pg_catalog.now())::date
    and pb.status in ('paid', 'approved');

  return jsonb_build_object(
    'total_receivables', v_total_receivables,
    'total_payables', v_total_payables,
    'delinquency_count', v_delinquency_count,
    'bank_balance', v_bank_balance,
    'current_month_income', v_current_month_income,
    'current_month_expenses', v_current_month_expenses,
    'net_income', v_current_month_income - v_current_month_expenses,
    'generated_at', pg_catalog.now()
  );
end;
$function$;
