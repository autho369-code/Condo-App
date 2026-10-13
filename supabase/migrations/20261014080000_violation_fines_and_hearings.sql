-- Violations deep check (2026-10-13), rolled back on production.
--
-- 1. Fines posted to the wrong income account. charge_gl_accounts had
--    branches for late fees and NSF fees but none for fines, so a fine whose
--    step and charge category have no GL account was credited to the
--    company's default (or first) income account: a $100 fine went to
--    4000 ASSESSMENTS while 4600 Violation Fees existed. A fine now falls
--    back to an active income account named like "violation", then "fine".
-- 2. Fine journal entries were dated 30 days late. advance_violation sets a
--    fine's due date to today + 30 and post_charge_to_gl dated the entry on
--    the due date, so an October fine was missing from October's income and
--    receivables. Fines, late fees and NSF fees (assessed now, payable later)
--    now post on the day they were assessed in the association's time zone
--    (or the due date if that is earlier); dues still post on their due date.
--    A reversal uses the same date as the entry it reverses. Production had
--    no fine, late fee or NSF fee charges, so nothing is re-dated.
-- 3. Owners could request a hearing at any time, which blocked every later
--    fine and moved a fined case back to hearing_pending. A request is now
--    accepted only within the association's hearing request window
--    (hearing_request_days, default 14) after the first notice, counted in
--    the association's local date: the same clock advance_violation uses
--    before it allows a fine (migration-reviewer), so a fine can't post
--    while the owner's window is still open.
-- 4. record_violation_hearing set the next follow-up from the UTC date; it
--    now uses the association's local date. Its reminder to credit fines
--    after a dismissal went to the owner-visible timeline; it is now a
--    staff-only entry (the owner sees the decision and the board's notes).

create or replace function public.charge_gl_accounts(p_charge charges, out portfolio_id uuid, out association_id uuid, out ar uuid, out income uuid)
returns record
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare v_assoc uuid; v_portfolio uuid; v_cat_gl uuid;
begin
  v_assoc := public.unit_association_id(p_charge.unit_id);
  select a.portfolio_id into v_portfolio from public.associations a where a.id = v_assoc;
  select cc.gl_account_id into v_cat_gl from public.charge_categories cc where cc.id = p_charge.charge_category_id;
  portfolio_id := v_portfolio;
  association_id := v_assoc;
  ar := coalesce(public.app_gl_map(v_portfolio, v_assoc, 'accounts_receivable'), public.gl_pick(v_portfolio, v_assoc, array['accounts_receivable'], null, '%allowance%'));
  income := coalesce(
    case when public.budget_gl_account_scope_valid(v_assoc, p_charge.gl_account_id) then p_charge.gl_account_id end,
    case when public.budget_gl_account_scope_valid(v_assoc, v_cat_gl) then v_cat_gl end,
    case when p_charge.charge_type::text = 'late_fee' then coalesce(public.app_gl_map(v_portfolio, v_assoc, 'late_fee_income'), public.gl_pick(v_portfolio, v_assoc, array['income'], '%late fee%')) end,
    case when p_charge.charge_type::text = 'nsf_fee' then public.gl_pick(v_portfolio, v_assoc, array['income', 'other_income'], '%nsf fee%', '%transfer%') end,
    case when p_charge.charge_type::text = 'fine' then coalesce(
      public.gl_pick(v_portfolio, v_assoc, array['income', 'other_income'], '%violation%'),
      public.gl_pick(v_portfolio, v_assoc, array['income', 'other_income'], '%fine%', '%refin%')) end,
    public.app_gl_map(v_portfolio, v_assoc, 'default_income'),
    public.gl_pick(v_portfolio, v_assoc, array['income']));
end $function$;

-- The ledger date of a charge: fees assessed now and payable later post on
-- the day they were assessed (association time); everything else on its due date.
create or replace function public.charge_ledger_date(p_charge charges)
returns date
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare v_date date := coalesce(p_charge.due_date, current_date);
begin
  if p_charge.charge_type::text in ('fine', 'late_fee', 'nsf_fee') then
    v_date := least(v_date, public.association_local_date(public.unit_association_id(p_charge.unit_id), coalesce(p_charge.created_at, now())));
  end if;
  return v_date;
end $function$;

revoke all on function public.charge_ledger_date(charges) from public, anon, authenticated;

create or replace function public.post_charge_to_gl()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare g record; v_memo text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if tg_op = 'UPDATE' and new.amount is not distinct from old.amount and new.gl_account_id is not distinct from old.gl_account_id
       and new.unit_id is not distinct from old.unit_id and new.due_date is not distinct from old.due_date
       and new.charge_category_id is not distinct from old.charge_category_id then
      return new;
    end if;
    perform public.reverse_subledger_source('charge', old.id, public.charge_ledger_date(old),
      format('Reversal: %s', coalesce(old.description, 'charge')));
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select * into g from public.charge_gl_accounts(new);
    if g.portfolio_id is null then return new; end if;
    v_memo := coalesce(new.description, new.charge_type::text);
    perform public.post_subledger_entry(g.portfolio_id, g.association_id, public.charge_ledger_date(new),
      'charge', new.id, v_memo, g.ar, g.income, new.amount);
    return new;
  end if;
  return old;
end $function$;

create or replace function public.request_owner_violation_hearing(p_violation_id uuid, p_reason text)
returns timestamp with time zone
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_violation public.violations%rowtype;
  v_reason text := trim(p_reason);
  v_days integer;
  v_notice date;
  v_today date;
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

  -- The window runs from the first notice, as advance_violation's fine gate does.
  if v_violation.notice_sent_at is not null then
    select coalesce(s.hearing_request_days, 14) into v_days
      from (select 1) x left join public.association_violation_settings s on s.association_id = v_violation.association_id;
    v_notice := public.association_local_date(v_violation.association_id, v_violation.notice_sent_at);
    v_today := public.association_local_date(v_violation.association_id, now());
    if v_today > v_notice + coalesce(v_days, 14) then
      raise exception 'The time to request a hearing ended on %. Contact your association manager.',
        to_char(v_notice + coalesce(v_days, 14), 'Mon DD, YYYY');
    end if;
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

create or replace function public.record_violation_hearing(p_violation_id uuid, p_decision text, p_hearing_at timestamp with time zone, p_notes text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare v public.violations; v_today date;
begin
  select * into v from public.violations where id = p_violation_id for update;
  if not found or not public.can_manage_violations(v.association_id) then raise exception 'Permission denied' using errcode = '42501'; end if;
  if p_decision not in ('upheld', 'dismissed') then raise exception 'Decision must be upheld or dismissed' using errcode = '22023'; end if;
  if v.status in ('cured', 'closed') then raise exception 'This violation is already resolved' using errcode = '22023'; end if;
  v_today := public.association_local_date(v.association_id, now());
  update public.violations
     set board_decision = p_decision, hearing_at = coalesce(p_hearing_at, now()), hearing_required = true,
         status = case when p_decision = 'dismissed' then 'closed'::public.violation_status when status = 'hearing_pending' then (case when coalesce(fines_total, 0) > 0 then 'fined' else 'notice_sent' end)::public.violation_status else status end,
         closed_at = case when p_decision = 'dismissed' then now() else closed_at end,
         next_followup_on = case when p_decision = 'dismissed' then null when next_followup_on is null or next_followup_on < v_today then v_today else next_followup_on end
   where id = v.id;
  -- The owner sees the decision and the board's notes ...
  perform public.log_violation_event(v.id, 'Hearing held — violation ' || p_decision
      || case when nullif(btrim(coalesce(p_notes, '')), '') is not null then '. ' || btrim(p_notes) else '' end,
    case when p_decision = 'dismissed' then 'closed'::public.violation_status else null end, true);
  -- ... and the reminder to credit fines stays with staff.
  if p_decision = 'dismissed' and coalesce(v.fines_total, 0) > 0 then
    perform public.log_violation_event(v.id, 'Fines already posted ($' || to_char(v.fines_total, 'FM999,999,990.00')
        || ') remain on the owner ledger: credit them if the dismissal reverses them.', null, false);
  end if;
end;
$function$;

-- migration-reviewer: backfill_receivables_to_gl posts charges that have no
-- journal entry yet; it dates them the same way as post_charge_to_gl now
-- (charge_ledger_date), so a later edit reverses on the same date.
do $$
declare
  v_def text := pg_get_functiondef('public.backfill_receivables_to_gl(uuid)'::regprocedure);
  v_old text := 'perform public.post_subledger_entry(g.portfolio_id, g.association_id, coalesce(r.due_date, r.created_at::date),';
  v_new text := 'perform public.post_subledger_entry(g.portfolio_id, g.association_id, public.charge_ledger_date(r),';
begin
  if position(v_new in v_def) > 0 then
    return;
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'backfill_receivables_to_gl: charge posting not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;
