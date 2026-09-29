-- State-law-aware owner collections.
--
-- Adds jurisdiction profiles (statutory pre-referral protections by state),
-- per-association compliance settings seeded from the profile, recorded
-- payment-plan offers and board referral votes, and a single readiness check
-- enforced by the existing legal-review guard. Profiles are conservative
-- summaries for workflow gating, not legal advice; associations may tighten
-- or adjust them on counsel's direction (audited).

-- ── Jurisdiction reference data ─────────────────────────────────────────────
create table if not exists public.collection_jurisdiction_profiles (
  state_code text primary key check (state_code ~ '^([A-Z]{2}|DEFAULT)$'),
  state_name text not null,
  pre_referral_notice_days integer not null check (pre_referral_notice_days between 0 and 180),
  notice_method text not null check (notice_method in ('first_class', 'certified_mail')),
  payment_plan_offer_required boolean not null default false,
  payment_plan_min_months integer check (payment_plan_min_months is null or payment_plan_min_months between 1 and 60),
  board_vote_required boolean not null default false,
  foreclosure_min_balance numeric(12,2),
  foreclosure_min_months integer,
  summary text not null,
  citations text[] not null default '{}',
  last_reviewed date not null default current_date
);
alter table public.collection_jurisdiction_profiles enable row level security;
drop policy if exists collection_jurisdiction_profiles_read on public.collection_jurisdiction_profiles;
create policy collection_jurisdiction_profiles_read on public.collection_jurisdiction_profiles
  for select to authenticated using (true);
revoke insert, update, delete on public.collection_jurisdiction_profiles from authenticated, anon;
grant select on public.collection_jurisdiction_profiles to authenticated;

insert into public.collection_jurisdiction_profiles
  (state_code, state_name, pre_referral_notice_days, notice_method, payment_plan_offer_required, payment_plan_min_months,
   board_vote_required, foreclosure_min_balance, foreclosure_min_months, summary, citations)
values
  ('DEFAULT', 'Default (no state profile)', 30, 'certified_mail', false, null, true, null, null,
   'Conservative baseline: written notice by certified mail at least 30 days before referral, and a recorded board decision to refer.',
   array['Confirm your state statute and governing documents with association counsel.']),
  ('CA', 'California', 30, 'certified_mail', false, null, true, 1800, 12,
   'Pre-lien notice by certified mail at least 30 days before recording a lien, including the owner''s right to dispute resolution; the board itself must approve recording a lien; judicial or nonjudicial foreclosure is barred below $1,800 in assessments or less than 12 months delinquent.',
   array['Cal. Civ. Code § 5660 (pre-lien notice)', '§ 5665 (payment plan requests)', '§ 5673 (board decision to record lien)', '§ 5720 (foreclosure thresholds)']),
  ('CO', 'Colorado', 30, 'certified_mail', true, 18, true, null, 6,
   'Before referring an account to a collection agency or attorney the association must send notice by certified mail, offer a payment plan of at least 18 months, and the board must formally vote to refer; foreclosure requires at least six months of regular assessments owed.',
   array['C.R.S. § 38-33.3-316.3 (HB22-1137)', 'C.R.S. § 38-33.3-316']),
  ('FL', 'Florida (condominium)', 30, 'certified_mail', false, null, false, null, null,
   'A notice of intent to record a claim of lien must be delivered at least 30 days before recording; a separate 45-day notice of intent to foreclose follows before foreclosure.',
   array['Fla. Stat. § 718.121(4) (notice of intent to lien)', '§ 718.116(6)(b) (notice of intent to foreclose)']),
  ('IL', 'Illinois', 30, 'certified_mail', false, null, false, null, null,
   'An eviction (forcible entry and detainer) action against a unit owner for unpaid assessments requires a written demand giving at least 30 days to pay; many declarations also require board authorization.',
   array['735 ILCS 5/9-104.1, 9-104.2 (demand for possession)', '765 ILCS 605/9.2 (Condominium Property Act remedies)']),
  ('TX', 'Texas', 45, 'certified_mail', true, 3, false, null, null,
   'Before turning an account over to a collection agent the association must give the owner at least 45 days, by certified mail, to cure, and describe how to avoid further fees including a payment plan; foreclosure is barred for fines and attorney fees alone.',
   array['Tex. Prop. Code § 209.0064 (third-party collections)', '§ 209.0062 (payment plans)', '§ 209.009 (foreclosure limits)'])
on conflict (state_code) do update
  set state_name = excluded.state_name,
      pre_referral_notice_days = excluded.pre_referral_notice_days,
      notice_method = excluded.notice_method,
      payment_plan_offer_required = excluded.payment_plan_offer_required,
      payment_plan_min_months = excluded.payment_plan_min_months,
      board_vote_required = excluded.board_vote_required,
      foreclosure_min_balance = excluded.foreclosure_min_balance,
      foreclosure_min_months = excluded.foreclosure_min_months,
      summary = excluded.summary,
      citations = excluded.citations,
      last_reviewed = current_date;

-- ── Per-association compliance settings ─────────────────────────────────────
alter table public.delinquency_policies
  add column if not exists jurisdiction text,
  add column if not exists pre_referral_notice_days integer not null default 30,
  add column if not exists notice_method text not null default 'certified_mail',
  add column if not exists payment_plan_offer_required boolean not null default false,
  add column if not exists payment_plan_min_months integer,
  add column if not exists board_vote_required boolean not null default true,
  add column if not exists foreclosure_min_balance numeric(12,2),
  add column if not exists foreclosure_min_months integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'delinquency_policies_notice_method_check'
                  and conrelid = 'public.delinquency_policies'::regclass) then
    alter table public.delinquency_policies
      add constraint delinquency_policies_notice_method_check check (notice_method in ('first_class', 'certified_mail'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'delinquency_policies_notice_days_check'
                  and conrelid = 'public.delinquency_policies'::regclass) then
    alter table public.delinquency_policies
      add constraint delinquency_policies_notice_days_check check (pre_referral_notice_days between 0 and 180);
  end if;
end $$;

-- Copy a jurisdiction profile onto an association's policy.
create or replace function public.apply_delinquency_jurisdiction(p_association_id uuid, p_state_code text)
returns text
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_portfolio uuid;
  v_profile public.collection_jurisdiction_profiles;
  v_policy uuid;
begin
  select portfolio_id into v_portfolio from public.associations where id = p_association_id;
  if v_portfolio is null then raise exception 'Association not found'; end if;
  if not (public.can_admin_portfolio(v_portfolio) or public.is_platform_operator()) then
    raise exception 'Only a portfolio administrator may change collection compliance settings';
  end if;
  select * into v_profile from public.collection_jurisdiction_profiles where state_code = upper(coalesce(p_state_code, ''));
  if not found then
    select * into v_profile from public.collection_jurisdiction_profiles where state_code = 'DEFAULT';
  end if;
  select id into v_policy from public.delinquency_policies where association_id = p_association_id;
  if v_policy is null then raise exception 'Initialize the association''s collection policy first'; end if;

  update public.delinquency_policies
     set jurisdiction = v_profile.state_code,
         pre_referral_notice_days = v_profile.pre_referral_notice_days,
         notice_method = v_profile.notice_method,
         payment_plan_offer_required = v_profile.payment_plan_offer_required,
         payment_plan_min_months = v_profile.payment_plan_min_months,
         board_vote_required = v_profile.board_vote_required,
         foreclosure_min_balance = v_profile.foreclosure_min_balance,
         foreclosure_min_months = v_profile.foreclosure_min_months,
         updated_at = now()
   where id = v_policy;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (v_portfolio, 'association', p_association_id, 'delinquency_jurisdiction_applied', auth.uid(),
          jsonb_build_object('jurisdiction', v_profile.state_code));
  return v_profile.state_code;
end;
$$;

create or replace function public.save_delinquency_compliance(
  p_association_id uuid,
  p_pre_referral_notice_days integer,
  p_notice_method text,
  p_payment_plan_offer_required boolean,
  p_payment_plan_min_months integer,
  p_board_vote_required boolean,
  p_foreclosure_min_balance numeric,
  p_foreclosure_min_months integer
) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_portfolio uuid;
  v_before jsonb;
begin
  select portfolio_id into v_portfolio from public.associations where id = p_association_id;
  if v_portfolio is null then raise exception 'Association not found'; end if;
  if not (public.can_admin_portfolio(v_portfolio) or public.is_platform_operator()) then
    raise exception 'Only a portfolio administrator may change collection compliance settings';
  end if;
  if p_pre_referral_notice_days is null or p_pre_referral_notice_days not between 0 and 180 then
    raise exception 'Notice period must be 0–180 days';
  end if;
  if p_notice_method not in ('first_class', 'certified_mail') then raise exception 'Invalid notice method'; end if;
  if p_payment_plan_min_months is not null and p_payment_plan_min_months not between 1 and 60 then
    raise exception 'Payment plan length must be 1–60 months';
  end if;

  select to_jsonb(p) into v_before from public.delinquency_policies p where association_id = p_association_id;
  if v_before is null then raise exception 'Initialize the association''s collection policy first'; end if;

  update public.delinquency_policies
     set pre_referral_notice_days = p_pre_referral_notice_days,
         notice_method = p_notice_method,
         payment_plan_offer_required = coalesce(p_payment_plan_offer_required, false),
         payment_plan_min_months = p_payment_plan_min_months,
         board_vote_required = coalesce(p_board_vote_required, true),
         foreclosure_min_balance = p_foreclosure_min_balance,
         foreclosure_min_months = p_foreclosure_min_months,
         updated_at = now()
   where association_id = p_association_id;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (v_portfolio, 'association', p_association_id, 'delinquency_compliance_updated', auth.uid(),
          jsonb_build_object('before', v_before,
                             'after', (select to_jsonb(p) from public.delinquency_policies p where association_id = p_association_id)));
end;
$$;

-- New associations get the profile matching their state automatically.
create or replace function public.initialize_delinquency_policy(p_association_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  portfolio uuid;
  policy uuid;
  v_state text;
begin
  select portfolio_id, upper(coalesce(state, '')) into portfolio, v_state from public.associations where id = p_association_id;
  if portfolio is null then raise exception 'Association not found'; end if;
  if not (public.can_admin_portfolio(portfolio) or public.is_platform_operator()) then
    raise exception 'Not authorized to configure delinquency policy';
  end if;
  insert into public.delinquency_policies (portfolio_id, association_id)
  values (portfolio, p_association_id)
  on conflict (association_id) do update set updated_at = now()
  returning id into policy;

  insert into public.delinquency_steps (policy_id, step_number, name, days_past_due, action_type, requires_human_approval, instructions)
  values
    (policy, 1, 'Courtesy reminder', 10, 'email', false, 'Review account and send a courteous balance reminder.'),
    (policy, 2, 'Formal collection notice', 30, 'letter', true, 'Confirm ledger accuracy and approve the formal notice.'),
    (policy, 3, 'Tracked physical notice', 45, 'physical_mail', true, 'Approve physical-mail fulfillment and retain delivery evidence.'),
    (policy, 4, 'Counsel review gate', 60, 'legal_review', true, 'Human portfolio administrator must approve or reject referral. No filing is automated.')
  on conflict (policy_id, step_number) do nothing;

  if (select jurisdiction from public.delinquency_policies where id = policy) is null then
    perform public.apply_delinquency_jurisdiction(p_association_id, v_state);
  end if;
  return policy;
end;
$$;

-- ── Recorded protections ────────────────────────────────────────────────────
create or replace function public.record_delinquency_payment_plan_offer(
  p_case_id uuid,
  p_offered_on date,
  p_months integer,
  p_terms text
) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  c public.delinquency_cases;
begin
  select * into c from public.delinquency_cases where id = p_case_id for update;
  if not found then raise exception 'Delinquency case not found'; end if;
  if not (public.can_access_portfolio(c.portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())) then
    raise exception 'Not authorized to manage this delinquency case';
  end if;
  if p_offered_on is null or p_offered_on > current_date then raise exception 'Offer date must be today or earlier'; end if;
  if p_months is null or p_months not between 1 and 60 then raise exception 'Plan length must be 1–60 months'; end if;
  if char_length(btrim(coalesce(p_terms, ''))) < 10 then raise exception 'Describe the offered terms (10+ characters)'; end if;

  insert into public.delinquency_case_events (case_id, event_type, step_number, balance_snapshot, note, metadata)
  values (p_case_id, 'payment_plan_offered', c.current_step_number, c.balance_snapshot, left(btrim(p_terms), 2000),
          jsonb_build_object('offered_on', p_offered_on, 'months', p_months));
end;
$$;

create or replace function public.record_delinquency_board_referral_vote(
  p_case_id uuid,
  p_meeting_date date,
  p_votes_for integer,
  p_votes_against integer,
  p_note text
) returns text
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  c public.delinquency_cases;
  v_approved boolean;
begin
  select * into c from public.delinquency_cases where id = p_case_id for update;
  if not found then raise exception 'Delinquency case not found'; end if;
  if not (public.can_access_portfolio(c.portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())) then
    raise exception 'Not authorized to manage this delinquency case';
  end if;
  if p_meeting_date is null or p_meeting_date > current_date then raise exception 'Meeting date must be today or earlier'; end if;
  if p_votes_for is null or p_votes_against is null or p_votes_for < 0 or p_votes_against < 0 or p_votes_for + p_votes_against = 0 then
    raise exception 'Enter the recorded vote count';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 10 then raise exception 'Reference the minutes or motion (10+ characters)'; end if;
  v_approved := p_votes_for > p_votes_against;

  insert into public.delinquency_case_events (case_id, event_type, step_number, balance_snapshot, note, metadata)
  values (p_case_id, case when v_approved then 'board_referral_approved' else 'board_referral_denied' end,
          c.current_step_number, c.balance_snapshot, left(btrim(p_note), 2000),
          jsonb_build_object('meeting_date', p_meeting_date, 'votes_for', p_votes_for, 'votes_against', p_votes_against));

  if not v_approved and c.status in ('open', 'legal_review') then
    update public.delinquency_cases
       set status = 'on_hold', hold_reason = 'Board declined referral: ' || left(btrim(p_note), 400)
     where id = p_case_id;
  end if;
  return case when v_approved then 'approved' else 'denied' end;
end;
$$;

-- ── Readiness: the single source of truth for referral gates ───────────────
create or replace function public.delinquency_referral_blockers(p_case_id uuid)
returns text[]
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare
  c public.delinquency_cases;
  p public.delinquency_policies;
  blockers text[] := '{}';
  v_notice_ok boolean;
  v_latest_board text;
begin
  select * into c from public.delinquency_cases where id = p_case_id;
  if not found then return array['Case not found']; end if;
  select * into p from public.delinquency_policies where id = c.policy_id;
  if not found then return array['No collection policy is configured for this association']; end if;

  select exists (
    select 1 from public.physical_mail_deliveries m
     where m.delinquency_case_id = c.id
       and m.status = 'delivered'
       and m.delivered_at is not null
       and m.delivered_at <= now() - make_interval(days => p.pre_referral_notice_days)
       and (p.notice_method <> 'certified_mail' or m.provider = 'manual_usps' or coalesce(m.mail_class, '') ilike '%certified%')
  ) into v_notice_ok;
  if not v_notice_ok then
    blockers := blockers || format('Delivered %s notice at least %s days before referral',
                                   case when p.notice_method = 'certified_mail' then 'certified-mail' else 'written' end,
                                   p.pre_referral_notice_days);
  end if;

  if p.payment_plan_offer_required and not exists (
    select 1 from public.delinquency_case_events e
     where e.case_id = c.id and e.event_type = 'payment_plan_offered'
       and coalesce((e.metadata ->> 'months')::integer, 0) >= coalesce(p.payment_plan_min_months, 1)
  ) then
    blockers := blockers || format('Recorded payment-plan offer%s',
                                   case when p.payment_plan_min_months is not null then ' of at least ' || p.payment_plan_min_months || ' months' else '' end);
  end if;

  if p.board_vote_required then
    select e.event_type into v_latest_board from public.delinquency_case_events e
     where e.case_id = c.id and e.event_type in ('board_referral_approved', 'board_referral_denied')
     order by e.created_at desc limit 1;
    if v_latest_board is distinct from 'board_referral_approved' then
      blockers := blockers || 'Recorded board vote approving referral'::text;
    end if;
  end if;
  return blockers;
end;
$$;

create or replace function public.delinquency_referral_readiness(p_case_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare
  c public.delinquency_cases;
  p public.delinquency_policies;
  warnings text[] := '{}';
begin
  select * into c from public.delinquency_cases where id = p_case_id;
  if not found then raise exception 'Delinquency case not found'; end if;
  if not (public.can_access_portfolio(c.portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())) then
    raise exception 'Not authorized to view this delinquency case';
  end if;
  select * into p from public.delinquency_policies where id = c.policy_id;
  if p.foreclosure_min_balance is not null and c.balance_snapshot < p.foreclosure_min_balance then
    warnings := warnings || format('Balance is below the $%s foreclosure threshold for %s — lien or other remedies only',
                                   to_char(p.foreclosure_min_balance, 'FM999,990'), coalesce(p.jurisdiction, 'this jurisdiction'));
  end if;
  if p.foreclosure_min_months is not null and c.oldest_due_date is not null
     and c.oldest_due_date > current_date - make_interval(months => p.foreclosure_min_months) then
    warnings := warnings || format('Delinquent less than %s months — below the foreclosure threshold for %s',
                                   p.foreclosure_min_months, coalesce(p.jurisdiction, 'this jurisdiction'));
  end if;
  return jsonb_build_object('blockers', to_jsonb(public.delinquency_referral_blockers(p_case_id)), 'warnings', to_jsonb(warnings),
                            'jurisdiction', p.jurisdiction);
end;
$$;

-- Enforce the gates wherever a case enters legal review.
create or replace function public.guard_delinquency_legal_transition()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  blockers text[];
begin
  if new.status = 'legal_review' and old.status is distinct from 'legal_review' then
    blockers := public.delinquency_referral_blockers(new.id);
    if coalesce(cardinality(blockers), 0) > 0 then
      raise exception 'Not ready for legal review. Still required: %', array_to_string(blockers, '; ');
    end if;
  end if;
  if new.status = 'approved_for_counsel' and old.status is distinct from 'approved_for_counsel' then
    if old.status <> 'legal_review'
       or not (public.can_admin_portfolio(new.portfolio_id) or public.is_platform_operator())
       or new.legal_reviewed_by is distinct from auth.uid()
       or char_length(btrim(coalesce(new.legal_review_note, ''))) < 20 then
      raise exception 'A documented human portfolio-admin legal review is required';
    end if;
    blockers := public.delinquency_referral_blockers(new.id);
    if coalesce(cardinality(blockers), 0) > 0 then
      raise exception 'Referral protections are no longer satisfied: %', array_to_string(blockers, '; ');
    end if;
  end if;
  return new;
end;
$$;

-- Apply profiles to existing policies that have none yet.
update public.delinquency_policies p
   set jurisdiction = coalesce(prof.state_code, 'DEFAULT'),
       pre_referral_notice_days = coalesce(prof.pre_referral_notice_days, d.pre_referral_notice_days),
       notice_method = coalesce(prof.notice_method, d.notice_method),
       payment_plan_offer_required = coalesce(prof.payment_plan_offer_required, d.payment_plan_offer_required),
       payment_plan_min_months = coalesce(prof.payment_plan_min_months, d.payment_plan_min_months),
       board_vote_required = coalesce(prof.board_vote_required, d.board_vote_required),
       foreclosure_min_balance = prof.foreclosure_min_balance,
       foreclosure_min_months = prof.foreclosure_min_months
  from public.associations a
  left join public.collection_jurisdiction_profiles prof on prof.state_code = upper(coalesce(a.state, ''))
  cross join (select * from public.collection_jurisdiction_profiles where state_code = 'DEFAULT') d
 where a.id = p.association_id and p.jurisdiction is null;

do $$
declare f text;
begin
  foreach f in array array[
    'public.apply_delinquency_jurisdiction(uuid, text)',
    'public.save_delinquency_compliance(uuid, integer, text, boolean, integer, boolean, numeric, integer)',
    'public.initialize_delinquency_policy(uuid)',
    'public.record_delinquency_payment_plan_offer(uuid, date, integer, text)',
    'public.record_delinquency_board_referral_vote(uuid, date, integer, integer, text)',
    'public.delinquency_referral_blockers(uuid)',
    'public.delinquency_referral_readiness(uuid)',
    'public.guard_delinquency_legal_transition()'
  ] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
  end loop;
end $$;

revoke all on function public.delinquency_referral_blockers(uuid) from authenticated;
revoke all on function public.guard_delinquency_legal_transition() from authenticated;
grant execute on function public.apply_delinquency_jurisdiction(uuid, text) to authenticated, service_role;
grant execute on function public.save_delinquency_compliance(uuid, integer, text, boolean, integer, boolean, numeric, integer) to authenticated, service_role;
grant execute on function public.initialize_delinquency_policy(uuid) to authenticated, service_role;
grant execute on function public.record_delinquency_payment_plan_offer(uuid, date, integer, text) to authenticated, service_role;
grant execute on function public.record_delinquency_board_referral_vote(uuid, date, integer, integer, text) to authenticated, service_role;
grant execute on function public.delinquency_referral_readiness(uuid) to authenticated, service_role;
grant execute on function public.delinquency_referral_blockers(uuid) to service_role;
