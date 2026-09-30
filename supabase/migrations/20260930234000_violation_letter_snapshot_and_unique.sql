-- #86 review fixes.
-- 1. The recorded step terms also capture everything needed to re-render the
--    letter later: the template's subject/body as they were, and the
--    association's hearing-request window. A delayed retry therefore produces
--    the same letter even if the template or policy was edited in between.
-- 2. One letter per violation step, enforced by the database, so overlapping
--    "send missing letter" requests can't create duplicates.

do $$
declare def text;
begin
  def := pg_get_functiondef('public.advance_violation(uuid, text)'::regprocedure);
  if position('''offers_hearing'', s.offers_hearing),' in def) = 0 then
    raise exception 'violation_letter_snapshot_and_unique: advance_violation drifted';
  end if;
  def := replace(def, '''offers_hearing'', s.offers_hearing),',
    '''offers_hearing'', s.offers_hearing, ''hearing_request_days'', v_hearing_days,' ||
    ' ''template_subject'', (select t.subject from public.document_templates t where t.id = s.letter_template_id),' ||
    ' ''template_body'', (select t.body from public.document_templates t where t.id = s.letter_template_id)),');
  execute def;
end $$;

-- Deployments that used the earlier "Resend letter" action can hold several
-- rows for one step. Keep the first letter per step (the one actually sent as
-- the notice) and drop the later copies before the index is created.
delete from public.violation_letters l
 using public.violation_letters keep
 where keep.violation_id = l.violation_id
   and keep.step_order = l.step_order
   and (keep.created_at, keep.id) < (l.created_at, l.id);

create unique index if not exists violation_letters_one_per_step on public.violation_letters (violation_id, step_order);
