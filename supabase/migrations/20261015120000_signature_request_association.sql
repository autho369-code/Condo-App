-- Codex on #381: a signature request linked to an association's record
-- (architectural request, management agreement, year-end package) is filed
-- under that association even when the caller sent no association. Filed as
-- company-wide (association_id null), managers of other associations could
-- read its signers and events. An archived association is refused, as it
-- already is when sent directly. No existing request needed correcting
-- (checked 2026-10-14). Re-runnable: checks a marker, anchors must appear once.
do $$
declare
  d text := replace(pg_get_functiondef('public.create_signature_request(uuid, uuid, text, uuid, text, text, text, text, text, text, jsonb, integer, boolean)'::regprocedure), chr(13), '');
  a1 text := E'      if p_association_id is not null and p_association_id <> v_subject_association then\n';
  a2 text := E'    p_portfolio_id, p_association_id, coalesce(p_subject_type, ''document''), p_subject_id, btrim(p_title),\n';
  x text;
begin
  if position('signature_request_association' in d) > 0 then return; end if;
  foreach x in array array[a1, a2] loop
    if (length(d) - length(replace(d, x, ''))) / length(x) <> 1 then
      raise exception 'create_signature_request: anchor not found exactly once: %', x;
    end if;
  end loop;
  d := replace(d, a1,
    E'      if not exists (select 1 from public.associations a where a.id = v_subject_association and a.archived_at is null) then\n'
    || E'        raise exception ''The linked record belongs to an archived association'' using errcode = ''22023'';\n'
    || E'      end if;\n'
    || a1);
  d := replace(d, a2,
    E'    -- signature_request_association: filed under the linked record''s association.\n'
    || E'    p_portfolio_id, coalesce(p_association_id, v_subject_association), coalesce(p_subject_type, ''document''), p_subject_id, btrim(p_title),\n');
  execute d;
end $$;
