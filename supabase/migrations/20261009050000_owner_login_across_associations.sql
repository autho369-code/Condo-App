-- One owner login across a person's owner records (one per association).
--
-- Since 20261009010000 each owner record belongs to one association, so a
-- person who owns in two associations of a company has two records.
-- owners.auth_user_id stays unique (one login per record), so until now a
-- portal login reached only one of them, and current_owner_id() also matched
-- unlinked records by email.
--
-- Same rule as vendors (20261009040000, Mirsad 2026-10-09): a login reaches
-- the record it was first linked to (owners.auth_user_id) plus every record
-- whose own invitation it accepted (owner_portal_logins). Nothing is reached
-- because an email matches: the email fallback of current_owner_id() is
-- removed (no owner record is linked through it today: 0 owner records).
--
-- 1. owner_portal_logins (owner_id -> auth_user_id): records added to a login
--    by accepting their invitations. RLS on; written only by triggers.
--    A link is revoked (revoked_at), never deleted.
-- 2. current_owner_ids(): every active record of the signed-in owner login;
--    current_owner_id() is its first (the linked record).
-- 3. Every policy comparing a row with current_owner_id() accepts any of
--    current_owner_ids() (ALTER POLICY, no drop). Policies that only check
--    "current_owner_id() IS NOT NULL" are unchanged.
-- 4. The resident helpers and every function that checked "the" owner now
--    cover all of the login's records; functions that act for an owner take
--    the exact record from what they act on (the unit, the violation, the
--    meeting's association, the tenant).
--    A row an owner writes must belong to the association of the owner
--    record it names (owner_record_matches), so one person's records cannot
--    be mixed (e.g. voting twice on one ballot as two records).
-- 5. Owner invitations name their record (metadata.owner_id) and its
--    association; accepting one links that exact record (first record, or
--    added to the login), only for the invited email. Scoped managers can
--    invite only into owner records of their own associations.
-- 6. Owner records are no longer linked by email at sign-up or by the bulk
--    relink: only through their own invitation.
-- 7. An auth email change unlinks and revokes records whose email no longer
--    matches and links nothing new. The old code called the trigger function
--    auto_link_portal_user() directly, which Postgres refuses ("trigger
--    functions can only be called as triggers"), so every email change
--    failed.
--
-- Additive: nothing is dropped or deleted.

-- 1) Records added to a login -------------------------------------------------

create table if not exists public.owner_portal_logins (
  owner_id uuid primary key references public.owners(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  invitation_id uuid references public.user_invitations(id) on delete set null,
  linked_at timestamptz not null default now(),
  -- Set when the login's email no longer matches the record; a later accepted
  -- invitation for the record replaces the link.
  revoked_at timestamptz
);

alter table public.owner_portal_logins add column if not exists revoked_at timestamptz;

create index if not exists idx_owner_portal_logins_auth_user on public.owner_portal_logins(auth_user_id);
create index if not exists idx_owner_portal_logins_portfolio on public.owner_portal_logins(portfolio_id);
create index if not exists idx_owner_portal_logins_invitation on public.owner_portal_logins(invitation_id);

comment on table public.owner_portal_logins is
  'Owner records added to a portal login by accepting their invitations (one login across a person''s associations). The first record stays on owners.auth_user_id.';

alter table public.owner_portal_logins enable row level security;
revoke all on public.owner_portal_logins from public, anon, authenticated;
grant select on public.owner_portal_logins to authenticated;
grant all on public.owner_portal_logins to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'owner_portal_logins'
                  and policyname = 'owner_portal_logins_self_read') then
    create policy owner_portal_logins_self_read on public.owner_portal_logins for select to authenticated
      using (auth_user_id = (select auth.uid()) and revoked_at is null);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'owner_portal_logins'
                  and policyname = 'owner_portal_logins_staff_read') then
    -- Staff of the owner record's own company and association.
    create policy owner_portal_logins_staff_read on public.owner_portal_logins for select to authenticated
      using (exists (select 1 from public.owners own
                      where own.id = owner_portal_logins.owner_id
                        and public.can_access_portfolio(own.portfolio_id)
                        and public.can_view_association_row(own.association_id)));
  end if;
end $$;

-- 2) The signed-in owner login's records ------------------------------------

create or replace function public.current_owner_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  if not public.is_current_identity_enabled() then
    return;
  end if;
  return query
  select o.id
    from public.owners o
    join public.profiles p on p.id = auth.uid() and p.disabled_at is null and p.hoa_role in ('owner', 'board')
   where o.portfolio_id = p.portfolio_id
     and o.portal_activated
     and o.archived_at is null
     and (o.auth_user_id = auth.uid()
          or exists (select 1 from public.owner_portal_logins l
                      where l.owner_id = o.id and l.auth_user_id = auth.uid() and l.revoked_at is null))
   order by (o.auth_user_id is not distinct from auth.uid()) desc, o.created_at, o.id;
end
$function$;

revoke all on function public.current_owner_ids() from public, anon;
grant execute on function public.current_owner_ids() to authenticated, service_role;

-- The first of them (the linked record). No email fallback any more.
create or replace function public.current_owner_id()
returns uuid
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return (select x from public.current_owner_ids() x limit 1);
end
$function$;

revoke all on function public.current_owner_id() from public, anon;
grant execute on function public.current_owner_id() to authenticated, service_role;

comment on function public.current_owner_id() is
  'The signed-in owner login''s first record (the one linked through owners.auth_user_id). Use current_owner_ids() for every record of the login.';

-- 3) Policies accept any of the login's records ------------------------------

do $$
declare
  r record;
  v_sql text;
  v_pattern constant text := '= (public\.)?current_owner_id\(\)';
  v_count int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where coalesce(qual, '') ~ v_pattern or coalesce(with_check, '') ~ v_pattern
  loop
    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if r.qual is not null then
      v_sql := v_sql || format(' using (%s)',
        regexp_replace(r.qual, v_pattern, 'IN ( SELECT public.current_owner_ids())', 'g'));
    end if;
    if r.with_check is not null then
      v_sql := v_sql || format(' with check (%s)',
        regexp_replace(r.with_check, v_pattern, 'IN ( SELECT public.current_owner_ids())', 'g'));
    end if;
    execute v_sql;
    v_count := v_count + 1;
  end loop;

  if exists (select 1 from pg_policies
              where coalesce(qual, '') ~ v_pattern or coalesce(with_check, '') ~ v_pattern) then
    raise exception 'A policy still compares with current_owner_id(). Check it, then run this migration again.';
  end if;
  raise notice 'Owner policies now covering every record of a login: %', v_count;
end $$;

-- A row written for an owner record must be in that record's association (and
-- the unit, when there is one, too). Each owner record belongs to exactly one
-- association (20261009010000), so this ties the row to the right record.
create or replace function public.owner_record_matches(p_owner_id uuid, p_association_id uuid, p_unit_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  return exists (
    select 1 from public.owners o
     where o.id = p_owner_id
       and (p_association_id is null or o.association_id = p_association_id)
       and (p_unit_id is null or public.unit_association_id(p_unit_id) = o.association_id));
end
$function$;

revoke all on function public.owner_record_matches(uuid, uuid, uuid) from public, anon;
grant execute on function public.owner_record_matches(uuid, uuid, uuid) to authenticated, service_role;

-- Every write policy (INSERT, UPDATE, ALL) accepting any of the login's
-- records also checks that record against the row's association and unit.
-- Read policies keep the union. owners (the record itself), messages on an
-- architectural request (tied through the request) and survey responses
-- (below) are handled separately.
do $$
declare
  r record;
  v_new text;
  v_assoc text;
  v_unit text;
  v_count int := 0;
  v_token constant text := '([A-Za-z_][A-Za-z_0-9.]*) IN \( SELECT (public\.)?current_owner_ids\(\)( AS current_owner_ids)?\)';
begin
  for r in
    select p.schemaname, p.tablename, p.policyname, coalesce(p.with_check, p.qual) as chk
      from pg_policies p
     where p.schemaname = 'public'
       and p.cmd in ('INSERT', 'UPDATE', 'ALL')
       and coalesce(p.with_check, p.qual, '') ~ 'current_owner_ids\(\)'
       and coalesce(p.with_check, p.qual, '') !~ 'owner_record_matches'
       and p.tablename not in ('owners', 'architectural_request_messages', 'survey_responses', 'owner_portal_logins')
  loop
    select case when exists (select 1 from information_schema.columns c where c.table_schema = 'public'
                              and c.table_name = r.tablename and c.column_name = 'association_id')
                then format('%I.association_id', r.tablename) else 'NULL::uuid' end,
           case when exists (select 1 from information_schema.columns c where c.table_schema = 'public'
                              and c.table_name = r.tablename and c.column_name = 'unit_id')
                then format('%I.unit_id', r.tablename) else 'NULL::uuid' end
      into v_assoc, v_unit;
    v_new := regexp_replace(r.chk, v_token,
      '(\1 IN ( SELECT public.current_owner_ids()) AND public.owner_record_matches(\1, ' || v_assoc || ', ' || v_unit || '))', 'g');
    execute format('alter policy %I on %I.%I with check (%s)', r.policyname, r.schemaname, r.tablename, v_new);
    v_count := v_count + 1;
  end loop;
  raise notice 'Owner write policies tied to the record''s association: %', v_count;
end $$;

-- A survey answer is given by the record in the survey's association; a
-- company-wide survey is answered once per login (by its first record).
alter policy survey_responses_resident_insert on public.survey_responses
  with check (
    public.is_portal_resident()
    and submitted_by_owner_id in (select public.current_owner_ids())
    and work_order_id is null
    and exists (
      select 1 from public.surveys s
       where s.id = survey_responses.survey_id
         and s.active
         and s.archived_at is null
         and case when s.association_id is null
                  then survey_responses.submitted_by_owner_id = public.current_owner_id()
                  else public.owner_record_matches(survey_responses.submitted_by_owner_id, s.association_id, null)
             end));

-- Owner form templates and submissions: any record of the login, not only
-- the one linked through owners.auth_user_id.
alter policy form_templates_owner_read on public.form_templates
  using (
    active and archived_at is null and audience = 'homeowner'
    and exists (select 1 from public.owners o
                 where o.id in (select public.current_owner_ids())
                   and o.portfolio_id = form_templates.portfolio_id));

alter policy form_submissions_owner_insert on public.form_submissions
  with check (
    created_by = (select auth.uid())
    and kind = any (array['portal_service_request'::text, 'portal_concern_report'::text])
    and exists (select 1 from public.current_owner_ids()));

-- Nothing compares with current_owner_id() any more except "is not null"
-- checks and the company-wide survey rule above.
do $$
begin
  if exists (select 1 from pg_policies
              where regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
                                   '(public\.)?current_owner_id\(\) IS NOT NULL|submitted_by_owner_id = (public\.)?current_owner_id\(\)', '', 'g')
                    ~ 'current_owner_id\(\)') then
    raise exception 'A policy still uses current_owner_id() beyond an IS NOT NULL check. Check it, then run this migration again.';
  end if;
  if exists (select 1 from pg_policies p
              where p.schemaname = 'public' and p.cmd in ('INSERT', 'UPDATE', 'ALL')
                and coalesce(p.with_check, p.qual, '') ~ 'current_owner_ids\(\)'
                and coalesce(p.with_check, p.qual, '') !~ 'owner_record_matches'
                and p.tablename not in ('owners', 'architectural_request_messages', 'owner_portal_logins', 'form_submissions')) then
    raise exception 'An owner write policy is not tied to its record''s association.';
  end if;
end $$;

-- 4) Helpers and functions over every record of the login ---------------------
-- Bodies are the live definitions with only the owner check changed.

create or replace function public.current_resident_unit_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return query
  select o.unit_id from public.occupancies o
   where o.owner_id in (select public.current_owner_ids())
     and o.status = 'current'
     and (o.move_out_date is null or o.move_out_date > current_date);
end
$function$;

create or replace function public.current_resident_association_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return query
  select distinct b.association_id
    from public.occupancies o
    join public.units un on un.id = o.unit_id
    join public.buildings b on b.id = un.building_id
   where o.owner_id in (select public.current_owner_ids())
     and o.status = 'current'
     and (o.move_out_date is null or o.move_out_date > current_date);
end
$function$;

create or replace function public.current_resident_unit_since(p_unit uuid)
returns date
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return (select s.x from (
  select case when bool_or(o.move_in_date is null) then null else min(o.move_in_date) end
    from public.occupancies o
   where o.owner_id in (select public.current_owner_ids())
     and o.status = 'current'
     and (o.move_out_date is null or o.move_out_date > current_date)
     and o.unit_id = p_unit
  ) s(x) limit 1);
end
$function$;

create or replace function public.is_notice_recipient(p_notice_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return (select s.x from (
  select exists (
    select 1 from public.notice_recipients nr
    where nr.notice_id = p_notice_id
      and nr.owner_id in (select public.current_owner_ids())
  )
  ) s(x) limit 1);
end
$function$;

create or replace function public.amenity_reservations_owner_guard()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare n public.amenity_reservations;
begin
  if pg_trigger_depth() > 1 or not public.is_self_service_caller()
     or old.owner_id is null or old.owner_id not in (select public.current_owner_ids()) then
    return new;
  end if;
  if new.status is distinct from old.status and new.status <> 'cancelled' then
    raise exception 'You can only cancel your own reservation' using errcode = '42501';
  end if;
  n := new;
  new := old;
  new.status := n.status;
  new.updated_at := now();
  return new;
end $function$;

create or replace function public.architectural_requests_owner_guard()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare n public.architectural_requests;
begin
  if pg_trigger_depth() > 1 or not public.is_self_service_caller()
     or old.owner_id is null or old.owner_id not in (select public.current_owner_ids()) then
    return new;
  end if;
  if new.status is distinct from old.status and new.status <> 'withdrawn' then
    raise exception 'You can only withdraw your own request' using errcode = '42501';
  end if;
  n := new;
  new := old;
  new.status := n.status;
  new.updated_at := now();
  return new;
end $function$;

create or replace function public.board_decide_architectural_request(p_request_id uuid, p_decision text, p_notes text default null::text)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_req public.architectural_requests;
  v_status text;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_name text;
  v_label text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to record a decision' using errcode = '42501';
  end if;

  v_status := case p_decision
    when 'approve' then 'approved'
    when 'deny' then 'denied'
    when 'more_info' then 'more_info'
    when 'review' then 'under_review'
    else null end;
  if v_status is null then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  if v_status = 'denied' and v_notes is null then
    raise exception 'Give the homeowner a reason when denying a request' using errcode = '22023';
  end if;
  if v_status = 'more_info' and v_notes is null then
    raise exception 'Say what additional information is needed' using errcode = '22023';
  end if;

  select * into v_req from public.architectural_requests where id = p_request_id for update;
  if not found or v_req.association_id not in (select public.current_board_association_ids()) then
    raise exception 'Request not found' using errcode = '42501';
  end if;
  if v_req.owner_id is not null and v_req.owner_id in (select public.current_owner_ids()) then
    raise exception 'You cannot decide your own request; another board member or management must' using errcode = '42501';
  end if;
  if v_req.status not in ('submitted', 'under_review', 'more_info') then
    raise exception 'This request is already %', replace(v_req.status, '_', ' ') using errcode = '55000';
  end if;

  update public.architectural_requests
     set status = v_status,
         decided_by = case when v_status in ('approved', 'denied') then auth.uid() else decided_by end,
         decided_at = case when v_status in ('approved', 'denied') then now() else decided_at end,
         decision_notes = case when v_status in ('approved', 'denied') then v_notes
                               else coalesce(v_notes, decision_notes) end
   where id = p_request_id;

  select coalesce(nullif(p.full_name, ''), u.email) into v_name
    from auth.users u left join public.profiles p on p.id = u.id
   where u.id = auth.uid();
  v_label := case v_status
    when 'approved' then 'Approved by the board'
    when 'denied' then 'Denied by the board'
    when 'more_info' then 'The board requested more information'
    else 'The board marked this under review' end;

  insert into public.architectural_request_messages (request_id, author_id, author_name, author_role, body)
  values (p_request_id, auth.uid(), v_name, 'board', v_label || coalesce(E'\n\n' || v_notes, ''));

  return v_status;
end;
$function$;

create or replace function public.cancel_autopay(p_mandate_id uuid, p_reason text default null::text)
returns public.autopay_mandates
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare m public.autopay_mandates;
begin
  select * into m from public.autopay_mandates where id = p_mandate_id;
  if not found then raise exception 'autopay mandate not found'; end if;
  if m.owner_id not in (select public.current_owner_ids()) and not public.can_manage_finance(m.portfolio_id) then
    raise exception 'permission denied';
  end if;
  update public.autopay_mandates
     set status = 'canceled', canceled_at = now(), canceled_by = auth.uid(),
         paused_reason = p_reason, updated_at = now()
   where id = p_mandate_id
   returning * into m;
  return m;
end;
$function$;

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
  if r.association_id is null or r.association_id not in (select public.current_board_association_ids()) then
    raise exception 'Not a board member for this request';
  end if;
  if r.owner_id is not null and r.owner_id in (select public.current_owner_ids()) then
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
    if v_against >= 1 or v_abstain >= 1 then v_new_status := 'rejected';
    elsif v_eligible > 0 and v_for >= v_eligible then v_new_status := 'approved';
    end if;
  elsif r.voting_scheme = 'percentage_required' then
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

create or replace function public.message_thread_access(p_thread uuid, p_as text, out role text, out thread public.message_threads)
returns record
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare v_staff boolean; v_resident boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into thread from public.message_threads where id = p_thread for update;
  if not found then raise exception 'Conversation not found' using errcode = 'P0002'; end if;
  v_staff := public.is_messaging_staff() and public.can_access_portfolio(thread.portfolio_id)
             and public.can_manage_association(thread.association_id);
  v_resident := (thread.owner_id is not null and thread.owner_id in (select public.current_owner_ids()))
             or (thread.tenant_id is not null and thread.tenant_id in (select public.current_tenant_ids()));
  if p_as = 'resident' and v_resident then role := 'resident';
  elsif p_as = 'staff' and v_staff then role := 'staff';
  else raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
end $function$;

-- Tenants on the units each of the login's records owns.
create or replace function public.owner_unit_tenants()
returns table(id uuid, unit_id uuid, unit_number text, first_name text, last_name text, email text, phone text,
              lease_start date, lease_end date, status text, insurance_expiration date)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select t.id, t.unit_id, u.unit_number, t.first_name, t.last_name, t.email, t.phone,
         t.lease_start, t.lease_end, t.status, t.insurance_expiration
    from public.tenants t
    join public.units u on u.id = t.unit_id
   where t.archived_at is null
     and t.owner_id in (select public.current_owner_ids())
     and exists (
       select 1 from public.occupancies occ
        where occ.owner_id = t.owner_id
          and occ.unit_id = t.unit_id
          and occ.status = 'current'
          and occ.occupancy_type = 'owner')
   order by u.unit_number, t.lease_start desc nulls last, t.last_name;
$function$;

create or replace function public.rate_work_order(p_work_order_id uuid, p_score integer, p_quality integer, p_timeliness integer,
                                                  p_communication integer, p_would_hire_again boolean, p_comment text)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare wo record; v_role text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to rate this job' using errcode = '42501'; end if;
  select w.id, w.status::text as status, w.vendor_id, w.unit_id, w.association_id,
         coalesce(w.portfolio_id, a.portfolio_id) as portfolio_id
    into wo
    from public.work_orders w left join public.associations a on a.id = w.association_id
   where w.id = p_work_order_id and w.archived_at is null;
  if not found then raise exception 'Work order not found' using errcode = 'P0002'; end if;

  if public.can_access_portfolio(wo.portfolio_id) then
    v_role := 'staff';
  elsif false then
    v_role := 'board';
  elsif wo.unit_id is not null and exists (
          select 1 from public.occupancies o
           where o.unit_id = wo.unit_id and o.owner_id in (select public.current_owner_ids())
             and o.status = 'current'::public.occupancy_status) then
    v_role := 'owner';
  else
    raise exception 'Work order not found' using errcode = 'P0002';
  end if;

  if wo.status not in ('done', 'completed', 'billed', 'closed') then
    raise exception 'You can rate the job once it is completed' using errcode = '55000';
  end if;
  if wo.vendor_id is null then
    raise exception 'This job had no vendor to rate' using errcode = '55000';
  end if;
  if p_score is null or p_score not between 1 and 5
     or (p_quality is not null and p_quality not between 1 and 5)
     or (p_timeliness is not null and p_timeliness not between 1 and 5)
     or (p_communication is not null and p_communication not between 1 and 5) then
    raise exception 'Ratings are from 1 to 5 stars' using errcode = '22023';
  end if;
  if length(coalesce(p_comment, '')) > 2000 then
    raise exception 'Comments are limited to 2,000 characters' using errcode = '22023';
  end if;

  insert into public.work_order_ratings as r
    (portfolio_id, work_order_id, vendor_id, rated_by, rater_role, score, quality, timeliness, communication, would_hire_again, comment)
  values (wo.portfolio_id, wo.id, wo.vendor_id, auth.uid(), v_role, p_score, p_quality, p_timeliness, p_communication,
          p_would_hire_again, nullif(btrim(p_comment), ''))
  on conflict (work_order_id, rated_by) do update set
    score = excluded.score, quality = excluded.quality, timeliness = excluded.timeliness,
    communication = excluded.communication, would_hire_again = excluded.would_hire_again,
    comment = excluded.comment, rater_role = excluded.rater_role, updated_at = now()
  returning id into v_id;
  return v_id;
end $function$;

-- Functions that act for an owner take the exact record from what they act on.

-- Autopay: the record that currently occupies the unit; the payment method
-- must belong to that same record.
create or replace function public.enroll_autopay(p_unit_id uuid, p_payment_method_id uuid, p_authorized_max_cents integer,
                                                 p_frequency public.autopay_frequency default 'on_charge_posted'::public.autopay_frequency)
returns public.autopay_mandates
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  m public.autopay_mandates;
  v_owner uuid;
  v_portfolio uuid;
  v_assoc uuid;
begin
  if not exists (select 1 from public.current_owner_ids()) then
    raise exception 'must be logged in as a homeowner to enroll';
  end if;

  select a.portfolio_id, a.id into v_portfolio, v_assoc
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = p_unit_id;

  select o.owner_id into v_owner
    from public.occupancies o
   where o.unit_id = p_unit_id and o.owner_id in (select public.current_owner_ids()) and o.status = 'current'
   order by o.created_at, o.id
   limit 1;
  if v_owner is null then
    raise exception 'you are not a current occupant of this unit';
  end if;

  if not exists (
    select 1 from public.payment_methods pm
     where pm.id = p_payment_method_id and pm.owner_id = v_owner and pm.archived_at is null
  ) then
    raise exception 'payment method not found or not owned by you';
  end if;

  insert into public.autopay_mandates (
    portfolio_id, association_id, owner_id, unit_id, payment_method_id,
    authorized_amount_max_cents, frequency, status,
    mandate_signed_at
  ) values (
    v_portfolio, v_assoc, v_owner, p_unit_id, p_payment_method_id,
    p_authorized_max_cents, p_frequency, 'active',
    now()
  ) returning * into m;
  return m;
end;
$function$;

-- Lease dates: the tenant's own owner record, which must be one of the login's
-- and own the tenant's unit.
create or replace function public.owner_update_tenant_lease(p_tenant_id uuid, p_lease_start date, p_lease_end date)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if not exists (select 1 from public.current_owner_ids()) then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_lease_start is null then
    raise exception 'Enter the lease start date' using errcode = '22023';
  end if;
  if p_lease_end is not null and p_lease_end < p_lease_start then
    raise exception 'The lease end date must be on or after the start date' using errcode = '22023';
  end if;
  update public.tenants t
     set lease_start = p_lease_start, lease_end = p_lease_end, updated_at = now()
   where t.id = p_tenant_id
     and t.archived_at is null
     and t.owner_id in (select public.current_owner_ids())
     and exists (
       select 1 from public.occupancies occ
        where occ.owner_id = t.owner_id and occ.unit_id = t.unit_id
          and occ.status = 'current' and occ.occupancy_type = 'owner');
  if not found then
    raise exception 'That tenant is not on a unit you own' using errcode = '42501';
  end if;
end;
$function$;

-- Hearing request: the violation's own owner record, one of the login's.
create or replace function public.request_owner_violation_hearing(p_violation_id uuid, p_reason text)
returns timestamp with time zone
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_violation public.violations%rowtype;
  v_reason text := trim(p_reason);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.current_owner_ids()) then
    raise exception 'Active owner portal access is required';
  end if;
  if char_length(v_reason) < 10 or char_length(v_reason) > 1000 then
    raise exception 'Hearing request reason must be 10 to 1,000 characters';
  end if;

  select * into v_violation
  from public.violations v
  where v.id = p_violation_id
    and v.owner_id in (select public.current_owner_ids())
    and v.archived_at is null
  for update;

  if not found then
    raise exception 'Violation not found';
  end if;
  if v_violation.status in ('cured', 'closed') then
    raise exception 'A hearing cannot be requested for a closed violation';
  end if;
  if v_violation.hearing_requested_at is not null then
    return v_violation.hearing_requested_at;
  end if;

  update public.violations
  set hearing_required = true,
      hearing_requested_at = now(),
      hearing_request_note = v_reason,
      status = 'hearing_pending'
  where id = p_violation_id
  returning hearing_requested_at into v_violation.hearing_requested_at;

  return v_violation.hearing_requested_at;
end;
$function$;

-- New conversation: the login's record that currently occupies the unit.
create or replace function public.start_resident_message_thread(p_unit uuid, p_subject text, p_body text)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_owner uuid; v_tenant uuid; v_assoc uuid; v_portfolio uuid; v_name text; v_id uuid; v_open int;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select b.association_id, a.portfolio_id into v_assoc, v_portfolio
    from public.units u join public.buildings b on b.id = u.building_id join public.associations a on a.id = b.association_id
   where u.id = p_unit;
  if v_assoc is null then raise exception 'Unit not found' using errcode = 'P0002'; end if;
  select o.owner_id into v_owner
    from public.occupancies o
   where o.unit_id = p_unit
     and o.owner_id in (select public.current_owner_ids())
     and o.status = 'current'
     and (o.move_out_date is null or o.move_out_date > current_date)
   order by o.created_at, o.id
   limit 1;
  if v_owner is not null then
    select full_name into v_name from public.owners where id = v_owner;
  else
    select t.id, btrim(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, '')) into v_tenant, v_name
      from public.tenants t
     where t.unit_id = p_unit and t.id in (select public.current_tenant_ids()) and t.archived_at is null
     limit 1;
    if v_tenant is null then raise exception 'Unit not found' using errcode = 'P0002'; end if;
  end if;
  select count(*) into v_open from public.message_threads
   where status = 'open' and (owner_id = v_owner or tenant_id = v_tenant);
  if v_open >= 25 then
    raise exception 'You have 25 open conversations — reply in one of those instead' using errcode = '22023';
  end if;
  insert into public.message_threads (portfolio_id, association_id, unit_id, owner_id, tenant_id, subject, started_by_role,
                                      created_by, staff_unread, first_response_due_at, last_message_preview, last_message_role)
  values (v_portfolio, v_assoc, p_unit, v_owner, v_tenant, btrim(p_subject), 'resident', auth.uid(), true, now() + interval '48 hours',
          left(btrim(p_body), 140), 'resident')
  returning id into v_id;
  insert into public.message_thread_messages (thread_id, author_id, author_role, author_name, body)
  values (v_id, auth.uid(), 'resident', nullif(v_name, ''), btrim(p_body));
  return v_id;
end $function$;

-- Meeting sign-in: the login's record with a current occupancy in the
-- meeting's association.
create or replace function public.record_meeting_attendance_tenant_checked_impl(p_meeting_id uuid, p_attendee_name text,
    p_owner_id uuid default null::uuid, p_attendee_role text default 'owner'::text, p_signature_data text default null::text,
    p_voting_eligible boolean default true, p_notes text default null::text)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_meeting public.meetings%rowtype;
  v_attendee_id uuid;
  v_is_staff boolean;
  v_is_board boolean;
  v_is_resident boolean;
  v_current_owner_id uuid;
  v_effective_owner_id uuid;
  v_effective_name text;
  v_effective_role text;
  v_effective_voting boolean;
begin
  if auth.uid() is null or p_meeting_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if length(coalesce(p_attendee_name, '')) > 200
     or length(coalesce(p_notes, '')) > 2000
     or octet_length(coalesce(p_signature_data, '')) > 1048576
     or p_attendee_role is null
     or p_attendee_role not in ('board_member', 'owner', 'manager', 'guest') then
    raise exception 'Invalid meeting attendance input' using errcode = '22023';
  end if;

  select * into v_meeting
  from public.meetings m
  where m.id = p_meeting_id;
  if not found then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;

  v_is_staff := public.is_platform_operator()
    or (
      (public.is_any_staff() or public.is_company_admin())
      and public.can_access_portfolio(v_meeting.portfolio_id)
    );
  v_is_board := public.is_board_user()
    and v_meeting.association_id in (select public.current_board_association_ids());
  v_is_resident := public.is_portal_resident()
    and v_meeting.association_id in (select public.current_resident_association_ids());

  if not (v_is_staff or v_is_resident) then
    raise exception 'Not authorized for this meeting' using errcode = '42501';
  end if;

  if v_is_staff then
    v_effective_owner_id := p_owner_id;
    v_effective_name := trim(p_attendee_name);
    v_effective_role := p_attendee_role;
    v_effective_voting := coalesce(p_voting_eligible, false);

    if length(v_effective_name) not between 1 and 200 then
      raise exception 'Attendee name is required' using errcode = '22023';
    end if;
    if v_effective_owner_id is not null
       and not exists (
         select 1
         from public.occupancies o
         where o.owner_id = v_effective_owner_id
           and o.association_id = v_meeting.association_id
           and o.status = 'current'
       ) then
      raise exception 'Owner is outside the meeting association' using errcode = '23514';
    end if;
  else
    select o.owner_id into v_current_owner_id
      from public.occupancies o
     where o.owner_id in (select public.current_owner_ids())
       and o.association_id = v_meeting.association_id
       and o.status = 'current'
     order by o.created_at, o.id
     limit 1;

    if v_current_owner_id is not null then
      if p_owner_id is not null and p_owner_id <> v_current_owner_id then
        raise exception 'Residents may only sign in themselves' using errcode = '42501';
      end if;
      select o.id, o.full_name
      into v_effective_owner_id, v_effective_name
      from public.owners o
      where o.id = v_current_owner_id;
      v_effective_role := case when v_is_board then 'board_member' else 'owner' end;
      v_effective_voting := true;
    elsif v_is_board then
      if p_owner_id is not null then
        raise exception 'Board user owner identity does not match' using errcode = '42501';
      end if;
      select coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'Board member')
      into v_effective_name
      from public.profiles p
      where p.id = auth.uid();
      v_effective_owner_id := null;
      v_effective_role := 'board_member';
      v_effective_voting := true;
    else
      raise exception 'Current owner record is required' using errcode = '42501';
    end if;
  end if;

  if v_effective_owner_id is not null then
    select ma.id into v_attendee_id
    from public.meeting_attendees ma
    where ma.meeting_id = p_meeting_id
      and ma.owner_id = v_effective_owner_id
    order by ma.created_at
    limit 1
    for update;
  end if;

  if v_attendee_id is not null then
    update public.meeting_attendees ma
    set signature_data = coalesce(p_signature_data, ma.signature_data),
        present = true,
        attendee_name = v_effective_name,
        attendee_role = v_effective_role,
        voting_eligible = v_effective_voting,
        notes = coalesce(nullif(trim(p_notes), ''), ma.notes),
        check_in_time = pg_catalog.now()
    where ma.id = v_attendee_id;
  else
    insert into public.meeting_attendees (
      meeting_id, owner_id, attendee_name, attendee_role,
      check_in_time, signature_data, present, voting_eligible, notes
    ) values (
      p_meeting_id, v_effective_owner_id, v_effective_name, v_effective_role,
      pg_catalog.now(), p_signature_data, true, v_effective_voting, nullif(trim(p_notes), '')
    )
    returning meeting_attendees.id into v_attendee_id;
  end if;

  perform public.calculate_meeting_quorum(p_meeting_id);
  return v_attendee_id;
end;
$function$;

-- me() also returns every record of an owner login.
create or replace function public.me()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return (select s.x from (
  select jsonb_build_object(
    'auth_user_id', auth.uid(),
    'email', (select email from auth.users where id = auth.uid()),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'portfolio', (
      select case
        when public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()
          then to_jsonb(po) - 'ai_api_key' - 'ai_api_key_ciphertext' - 'ai_endpoint'
        else jsonb_build_object(
          'id', po.id, 'company_name', po.company_name, 'slug', po.slug,
          'logo_url', po.logo_url, 'favicon_url', po.favicon_url, 'brand_color', po.brand_color,
          'brand_email', po.brand_email, 'website', po.website, 'public_website', po.public_website,
          'phone_number', po.phone_number, 'texting_phone_number', po.texting_phone_number,
          'support_email', po.support_email, 'support_phone', po.support_phone,
          'address_street', po.address_street, 'address_city', po.address_city,
          'address_state', po.address_state, 'address_zip', po.address_zip,
          'archived_at', po.archived_at, 'suspended_at', po.suspended_at)
      end
      from public.portfolios po
      where po.id = public.current_portfolio_id()
    ),
    'role_name', public.current_role_name(),
    'is_platform_operator', public.is_platform_operator(), 'platform_operator_role', (select po.role from public.platform_operators po where po.auth_user_id = auth.uid() and po.active limit 1),
    'is_company_admin', public.is_company_admin(),
    'is_full_access_staff', public.is_full_access_staff(),
    'is_finance_staff', public.is_finance_staff(),
    'is_staff', public.is_staff(),
    'is_board', public.is_board_user(),
    'is_resident', public.is_portal_resident(),
    'is_tenant', public.is_tenant_user(),
    'owner_id', public.current_owner_id(),
    'owner_ids', array(select public.current_owner_ids()),
    'tenant_id', public.current_tenant_id(),
    'vendor_id', public.current_vendor_id(),
    'vendor_ids', array(select public.current_vendor_ids()),
    'board_association_ids', array(select public.current_board_association_ids()),
    'resident_association_ids', array(select public.current_resident_association_ids()),
    'resident_unit_ids', array(select public.current_resident_unit_ids()),
    'tenant_association_ids', array(select public.current_tenant_association_ids()),
    'tenant_unit_ids', array(select public.current_tenant_unit_ids())
  )
  ) s(x) limit 1);
end
$function$;

-- 5) Accepting a record's invitation links that record -----------------------

-- An owner invitation naming one record (metadata.owner_id) links exactly that
-- record when it is accepted: as the login's first record (owners.auth_user_id)
-- when the login has none, otherwise added to the login (owner_portal_logins).
-- The record must be in the invitation's company and association, carry the
-- invited email (which must also be the accepting login's email) and not be
-- on another login. An owner invitation naming no record (made before this
-- change) links the one unlinked owner record of that email in its company;
-- if there is not exactly one, acceptance fails. Anything that cannot be
-- linked rolls the acceptance back.
create or replace function public.link_owner_on_invitation_accept()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_owner uuid;
  v_assoc uuid;
  v_matches int;
begin
  if new.hoa_role::text not in ('owner', 'board')
     or new.status::text <> 'accepted' or old.status::text is not distinct from 'accepted'
     or new.used_by is null then
    return new;
  end if;

  if nullif(new.metadata ->> 'owner_id', '') is not null then
    v_owner := (new.metadata ->> 'owner_id')::uuid;
    v_assoc := new.association_id;
  elsif new.hoa_role::text = 'owner' then
    -- An owner invitation created before invitations named their record (or
    -- by an older app version): the one unlinked owner record of that email
    -- in the invitation's company (and association, when it has one).
    select count(*), min(o.id::text)::uuid into v_matches, v_owner
      from public.owners o
     where o.portfolio_id = new.portfolio_id
       and (new.association_id is null or o.association_id = new.association_id)
       and o.archived_at is null
       and o.auth_user_id is null
       and not exists (select 1 from public.owner_portal_logins l where l.owner_id = o.id and l.revoked_at is null)
       and lower(btrim(o.email)) = lower(btrim(new.email));
    if v_matches <> 1 then
      raise exception 'This owner invitation does not identify one owner record. Ask the management office for a new invitation.'
        using errcode = 'P0001';
    end if;
    select o.association_id into v_assoc from public.owners o where o.id = v_owner;
  else
    -- A board invitation naming no owner record links no owner record.
    return new;
  end if;

  -- Only the person the invitation was sent to (accept_invitation checks this
  -- too; a direct status change by an admin must not bypass it).
  if v_assoc is null
     or not exists (select 1 from auth.users u
                     where u.id = new.used_by and lower(btrim(u.email)) = lower(btrim(new.email))) then
    raise exception 'This owner invitation cannot be used by this account. Ask the management office for a new invitation.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.owners x where x.auth_user_id = new.used_by) then
    update public.owners o
       set auth_user_id = new.used_by, portal_activated = true
     where o.id = v_owner
       and o.portfolio_id = new.portfolio_id
       and o.association_id = v_assoc
       and o.archived_at is null
       and o.auth_user_id is null
       and not exists (select 1 from public.owner_portal_logins l where l.owner_id = o.id and l.revoked_at is null)
       and lower(btrim(o.email)) = lower(btrim(new.email));
  else
    insert into public.owner_portal_logins (owner_id, auth_user_id, portfolio_id, invitation_id)
    select o.id, new.used_by, o.portfolio_id, new.id
      from public.owners o
     where o.id = v_owner
       and o.portfolio_id = new.portfolio_id
       and o.association_id = v_assoc
       and o.archived_at is null
       and o.auth_user_id is null
       and lower(btrim(o.email)) = lower(btrim(new.email))
    on conflict (owner_id) do update
      set auth_user_id = excluded.auth_user_id, portfolio_id = excluded.portfolio_id,
          invitation_id = excluded.invitation_id, linked_at = now(), revoked_at = null
      where public.owner_portal_logins.revoked_at is not null;

    -- Activate it for this login (also the login's own first record that
    -- staff had turned off and invited again).
    update public.owners o
       set portal_activated = true
     where o.id = v_owner
       and o.portfolio_id = new.portfolio_id
       and o.association_id = v_assoc
       -- The record still carries the invited email (a stale invitation for an
       -- old address must not switch an old account back on).
       and lower(btrim(o.email)) = lower(btrim(new.email))
       and not o.portal_activated
       and o.archived_at is null
       and (o.auth_user_id = new.used_by
            or exists (select 1 from public.owner_portal_logins l
                        where l.owner_id = o.id and l.auth_user_id = new.used_by and l.revoked_at is null));
  end if;

  -- Fail loudly: if the exact record could not be linked (archived, its email
  -- changed, or it is on another login), the whole acceptance rolls back, so
  -- the invitation stays usable and the profile is not changed.
  if not exists (
    select 1 from public.owners o
     where o.id = v_owner
       and o.portfolio_id = new.portfolio_id
       and o.association_id = v_assoc
       and o.archived_at is null
       and lower(btrim(o.email)) = lower(btrim(new.email))
       and (o.auth_user_id = new.used_by
            or exists (select 1 from public.owner_portal_logins l
                        where l.owner_id = o.id and l.auth_user_id = new.used_by and l.revoked_at is null))) then
    raise exception 'The invited owner record could not be linked to this account. Ask the management office for a new invitation.'
      using errcode = 'P0001';
  end if;
  return new;
end
$function$;

revoke all on function public.link_owner_on_invitation_accept() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'user_invitations_link_owner'
                  and tgrelid = 'public.user_invitations'::regclass) then
    create trigger user_invitations_link_owner
      after update of status on public.user_invitations
      for each row execute function public.link_owner_on_invitation_accept();
  end if;
end $$;

-- A manager limited to some associations invites only into owner records of
-- those associations (as vendor_invite_scope does for vendors).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_invitations'
                  and policyname = 'owner_invite_scope') then
    create policy owner_invite_scope on public.user_invitations as restrictive for insert to authenticated
      with check (
        hoa_role::text is distinct from 'owner'
        or not public.manager_is_scoped()
        or public.is_company_admin()
        or exists (select 1 from public.owners own
                    where own.id::text = user_invitations.metadata ->> 'owner_id'
                      and own.association_id = user_invitations.association_id
                      and public.can_view_association_row(own.association_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_invitations'
                  and policyname = 'owner_invite_scope_update') then
    create policy owner_invite_scope_update on public.user_invitations as restrictive for update to authenticated
      using (true)
      with check (
        hoa_role::text is distinct from 'owner'
        or not public.manager_is_scoped()
        or public.is_company_admin()
        or exists (select 1 from public.owners own
                    where own.id::text = user_invitations.metadata ->> 'owner_id'
                      and own.association_id = user_invitations.association_id
                      and public.can_view_association_row(own.association_id)));
  end if;
end $$;

-- A board member who accepts an owner invitation keeps board access:
-- accept_invitation sets the profile role to the invitation's ('owner'), and
-- the board portal needs 'board'. A change from board to owner is kept at
-- board while the person holds an active board seat in that company (the same
-- rule link_portal_user uses to promote an owner to board).
create or replace function public.profiles_keep_board_role()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if exists (
    select 1 from public.board_members bm
      join public.associations a on a.id = bm.association_id
     where bm.auth_user_id = new.id
       and bm.active
       and a.portfolio_id = new.portfolio_id) then
    new.hoa_role := 'board';
  end if;
  return new;
end
$function$;

revoke all on function public.profiles_keep_board_role() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_profiles_keep_board_role'
                  and tgrelid = 'public.profiles'::regclass) then
    create trigger trg_profiles_keep_board_role
      before update of hoa_role on public.profiles
      for each row when (old.hoa_role::text = 'board' and new.hoa_role::text = 'owner')
      execute function public.profiles_keep_board_role();
  end if;
end $$;

-- 6) Sign-up auto-link and bulk relink ----------------------------------------

-- The sign-up linking body as a plain function (a trigger function cannot be
-- called directly). Owner records are linked only by their invitations;
-- vendor, board and tenant linking is unchanged.
create or replace function public.link_portal_user(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_portfolio_id uuid;
begin
  select p.portfolio_id into v_portfolio_id
  from public.profiles p
  where p.id = p_user_id and p.disabled_at is null;

  if v_portfolio_id is null or p_email is null then
    return;
  end if;

  -- Owner records are not linked here: only their own invitation links them
  -- (link_owner_on_invitation_accept), never a matching email.

  -- One vendor record per sign-in (vendors.auth_user_id is unique). With one
  -- record per association, the same email can be on several records: link
  -- the oldest instead of failing the whole sign-up on the second.
  update public.vendors v
     set auth_user_id = p_user_id, portal_activated = true
   where v.id = (
     select candidate.id
       from public.vendors candidate
      where candidate.portfolio_id = v_portfolio_id
        and candidate.auth_user_id is null
        and candidate.archived_at is null
        -- Never a record already added to another login.
        and not exists (select 1 from public.vendor_portal_logins l where l.vendor_id = candidate.id and l.revoked_at is null)
        and exists (
          select 1 from jsonb_array_elements_text(candidate.emails) as e(email)
          where lower(e.email) = lower(p_email)
        )
      order by candidate.created_at, candidate.id
      limit 1
   )
     and not exists (select 1 from public.vendors linked where linked.auth_user_id = p_user_id)
     -- An invited vendor is linked to the exact record of the invitation when it
     -- is accepted (link_vendor_on_invitation_accept), not to the oldest match.
     and not exists (
       select 1 from public.user_invitations i
       where i.portfolio_id = v_portfolio_id and i.hoa_role::text = 'vendor' and i.status::text = 'pending'
         -- An expired invitation (still 'pending') no longer holds the link.
         and (i.expires_at is null or i.expires_at > now())
         and lower(btrim(i.email)) = lower(btrim(p_email))
     )
     and exists (
       select 1 from public.profiles p
       where p.id = p_user_id and p.hoa_role = 'vendor' and p.disabled_at is null
     );

  update public.board_members bm
     set auth_user_id = p_user_id
   where bm.auth_user_id is null
     and bm.active
     and lower(bm.email) = lower(p_email)
     and exists (
       select 1 from public.profiles p
       where p.id = p_user_id and p.hoa_role = 'board' and p.disabled_at is null
     )
     and exists (
       select 1 from public.associations a
       where a.id = bm.association_id and a.portfolio_id = v_portfolio_id
     );

  update public.tenants t
     set auth_user_id = p_user_id,
         portal_activated = true,
         updated_at = now()
   where t.id = (
     select candidate.id
     from public.tenants candidate
     where candidate.portfolio_id = v_portfolio_id
       and candidate.auth_user_id is null
       and candidate.status = 'active'
       and candidate.archived_at is null
       and lower(candidate.email) = lower(p_email)
       and exists (
         select 1 from public.profiles p
         where p.id = p_user_id and p.hoa_role = 'tenant' and p.disabled_at is null
       )
     order by candidate.created_at desc, candidate.id
     limit 1
   );

  update public.profiles p
     set hoa_role = 'board'
   where p.id = p_user_id
     and p.hoa_role = 'owner'
     and exists (
       select 1 from public.board_members bm
       where bm.auth_user_id = p_user_id and bm.active
     );
end;
$function$;

revoke all on function public.link_portal_user(uuid, text) from public, anon, authenticated;
grant execute on function public.link_portal_user(uuid, text) to service_role;

create or replace function public.auto_link_portal_user()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  perform public.link_portal_user(new.id, new.email);
  return new;
end;
$function$;

create or replace function public.relink_all_portal_users()
returns table(target_table text, rows_linked integer)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  n_owners integer;
  n_board integer;
  n_vendors integer;
  n_tenants integer;
begin
  -- Owner records are linked only by their own invitations, never by email.
  n_owners := 0;

  with upd as (
    update public.board_members bm
       set auth_user_id = u.id
      from auth.users u
      join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role = 'board'
     where bm.auth_user_id is null
       and bm.active
       and lower(u.email) = lower(bm.email)
       and exists (
         select 1 from public.associations a
         where a.id = bm.association_id and a.portfolio_id = p.portfolio_id
       )
    returning 1
  ) select count(*) into n_board from upd;

  -- At most one vendor record per sign-in: the oldest unlinked match, and
  -- only for sign-ins not linked to a vendor record yet.
  with pick as (
    select distinct on (u.id) u.id as user_id, v.id as vendor_id
      from auth.users u
      join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role = 'vendor'
      join public.vendors v on v.portfolio_id = p.portfolio_id
     where v.auth_user_id is null
       and v.archived_at is null
       and not exists (select 1 from public.vendor_portal_logins l where l.vendor_id = v.id and l.revoked_at is null)
       and exists (
         select 1 from jsonb_array_elements_text(v.emails) as e(email)
         where lower(e.email) = lower(u.email)
       )
       and not exists (select 1 from public.vendors linked where linked.auth_user_id = u.id)
       -- A pending vendor invitation links its exact record when accepted
       -- (link_vendor_on_invitation_accept), as in auto_link_portal_user.
       and not exists (
         select 1 from public.user_invitations i
         where i.portfolio_id = p.portfolio_id and i.hoa_role::text = 'vendor' and i.status::text = 'pending'
           and (i.expires_at is null or i.expires_at > now())
           and lower(btrim(i.email)) = lower(btrim(u.email))
       )
     order by u.id, v.created_at, v.id
  ), upd as (
    update public.vendors v
       set auth_user_id = pick.user_id
      from pick
     where v.id = pick.vendor_id
    returning 1
  ) select count(*) into n_vendors from upd;

  with candidates as (
    select distinct on (u.id) t.id as tenant_id, u.id as auth_user_id
    from auth.users u
    join public.profiles p
      on p.id = u.id
     and p.disabled_at is null
     and p.hoa_role = 'tenant'
    join public.tenants t
      on t.portfolio_id = p.portfolio_id
     and t.auth_user_id is null
     and t.status = 'active'
     and t.archived_at is null
     and lower(u.email) = lower(t.email)
    order by u.id, t.created_at desc, t.id
  ), upd as (
    update public.tenants t
       set auth_user_id = candidates.auth_user_id,
           portal_activated = true,
           updated_at = now()
      from candidates
     where t.id = candidates.tenant_id
    returning 1
  ) select count(*) into n_tenants from upd;

  return query values
    ('owners', n_owners),
    ('board_members', n_board),
    ('vendors', n_vendors),
    ('tenants', n_tenants);
end;
$function$;

-- 7) An email change revokes added records and re-links -----------------------

create or replace function public.relink_portal_user_on_email_change()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.email is distinct from old.email then
    update public.owners set auth_user_id = null
      where auth_user_id = new.id and lower(email) <> lower(new.email);
    update public.owner_portal_logins l set revoked_at = now()
      where l.auth_user_id = new.id
        and l.revoked_at is null
        and not exists (select 1 from public.owners o
                         where o.id = l.owner_id and lower(btrim(o.email)) = lower(btrim(new.email)));
    update public.board_members set auth_user_id = null
      where auth_user_id = new.id and lower(email) <> lower(new.email);
    update public.vendors v set auth_user_id = null
      where v.auth_user_id = new.id
        and not exists (
          select 1 from jsonb_array_elements_text(v.emails) as e(email)
          where lower(e.email) = lower(new.email)
        );
    update public.vendor_portal_logins l set revoked_at = now()
      where l.auth_user_id = new.id
        and l.revoked_at is null
        and not exists (
          select 1 from public.vendors v, jsonb_array_elements(case when jsonb_typeof(v.emails) = 'array' then v.emails else '[]'::jsonb end) as e(val)
           where v.id = l.vendor_id
             and lower(btrim(case jsonb_typeof(e.val)
                                when 'string' then e.val #>> '{}'
                                when 'object' then e.val ->> 'email'
                              end)) = lower(btrim(new.email)));
    update public.tenants set auth_user_id = null, portal_activated = false, updated_at = now()
      where auth_user_id = new.id and lower(email) <> lower(new.email);
    -- Nothing new is linked by the changed email.
  end if;
  return new;
end;
$function$;

revoke all on function public.relink_portal_user_on_email_change() from public, anon, authenticated;
