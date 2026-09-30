-- #85 review fixes.
-- 1. Resend must use the terms the step was RECORDED with, not the live
--    schedule (save_violation_schedule archives and re-inserts steps, so a
--    later edit could change the template, fee, hearing terms or delivery).
--    advance_violation now snapshots the step's terms on the violation.
-- 2. Email delivery is tracked honestly: a letter is recorded with
--    email_status 'pending' and only becomes 'queued' once the email really
--    is in the queue, so a failed email can be retried on the SAME letter
--    (no duplicate PDF, portal entry or mail-queue item).
-- 3. convert_violation_report honours an explicit "no rule" choice.

alter table public.violations add column if not exists current_step_terms jsonb;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.advance_violation(uuid, text)'::regprocedure);
  -- Match with flexible whitespace: the original definition splits this
  -- assignment list across lines.
  if def !~ 'set current_step = s\.ordinal,\s*status = v_new_status,' then
    raise exception 'violation_letter_review_fixes: advance_violation drifted';
  end if;
  def := regexp_replace(def, 'set current_step = s\.ordinal,(\s*)status = v_new_status,',
    'set current_step = s.ordinal,\1status = v_new_status,' || chr(10) ||
    '         current_step_terms = jsonb_build_object(''step'', s.ordinal, ''step_name'', s.follow_up_name, ''fee'', s.fee,' ||
    ' ''letter_template_id'', s.letter_template_id, ''delivery_methods'', s.delivery_methods, ''offers_hearing'', s.offers_hearing),');
  execute def;

  def := pg_get_functiondef('public.convert_violation_report(uuid, uuid, uuid, text)'::regprocedure);
  if position('coalesce(p_house_rule_id, c.house_rule_id)' in def) = 0 then
    raise exception 'violation_letter_review_fixes: convert_violation_report drifted';
  end if;
  def := replace(def, 'coalesce(p_house_rule_id, c.house_rule_id)', 'p_house_rule_id');
  execute def;
end $$;

create or replace function public.violation_current_step_letter(p_violation_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  v public.violations;
begin
  select * into v from public.violations where id = p_violation_id;
  if v.id is null or not public.can_manage_violations(v.association_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if coalesce(v.current_step, 0) < 1 then
    raise exception 'No follow-up step has been recorded yet' using errcode = '22023';
  end if;
  if v.current_step_terms is null or (v.current_step_terms ->> 'step')::integer <> v.current_step then
    raise exception 'This step was recorded before letter terms were saved — send a notice from Generate notice instead' using errcode = '22023';
  end if;
  return v.current_step_terms;
end $$;

alter table public.violation_letters drop constraint if exists violation_letters_email_status_check;
alter table public.violation_letters add constraint violation_letters_email_status_check
  check (email_status in ('not_requested', 'pending', 'queued', 'no_email_on_file'));

create or replace function public.violation_letters_bind()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v public.violations;
begin
  if tg_op = 'INSERT' then
    select * into v from public.violations where id = new.violation_id;
    if v.id is null then
      raise exception 'Violation not found' using errcode = '23503';
    end if;
    new.association_id := v.association_id;
    new.owner_id := v.owner_id;
    new.created_by := auth.uid();
    new.created_at := now();
    if new.email_status = 'queued' then
      new.email_status := 'pending';  -- becomes queued only once the email is really queued
    end if;
    if new.pdf_path not like 'violations/' || v.id::text || '/letters/%' then
      raise exception 'Letter file must be stored under the violation' using errcode = '22023';
    end if;
    return new;
  end if;
  if new.mail_status is distinct from old.mail_status then
    if not (old.mail_status = 'to_mail' and new.mail_status = 'mailed') then
      raise exception 'A letter can only move from "to mail" to "mailed"' using errcode = '22023';
    end if;
    new.mailed_at := now();
    new.mailed_by := auth.uid();
  end if;
  if new.email_status is distinct from old.email_status
     and not (old.email_status = 'pending' and new.email_status = 'queued') then
    raise exception 'A letter''s email can only move from "pending" to "queued"' using errcode = '22023';
  end if;
  new.id := old.id; new.violation_id := old.violation_id; new.association_id := old.association_id;
  new.owner_id := old.owner_id; new.step_order := old.step_order; new.step_name := old.step_name;
  new.subject := old.subject; new.body := old.body; new.pdf_path := old.pdf_path;
  new.delivery_methods := old.delivery_methods; new.emailed_to := old.emailed_to;
  new.created_by := old.created_by; new.created_at := old.created_at;
  if new.mail_status is not distinct from old.mail_status then
    new.mailed_at := old.mailed_at; new.mailed_by := old.mailed_by;
  end if;
  return new;
end $$;
