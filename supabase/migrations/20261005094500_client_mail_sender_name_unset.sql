-- White label: client-originated email queued by these functions hard-coded
-- from_name 'Portier369'. Leave it unset instead, so delivery
-- (/api/email/process-queue) sends it under the client company's name.
-- Platform-originated mail keeps an explicit 'Portier369' and is not touched.
--
-- Rewrites the live definitions in place (CREATE OR REPLACE keeps grants);
-- re-running is a no-op once the text is gone.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.add_record_note'::regproc::regprocedure);
  if position('''noreply@portier369.com'', ''Portier369'',' in v_def) > 0 then
    execute replace(v_def, '''noreply@portier369.com'', ''Portier369'',', '''noreply@portier369.com'', null,');
  end if;

  v_def := pg_get_functiondef('public.submit_owner_message'::regproc::regprocedure);
  if position('''hello@portier369.com'', ''Portier369'',' in v_def) > 0 then
    execute replace(v_def, '''hello@portier369.com'', ''Portier369'',', '''hello@portier369.com'', null,');
  end if;

  v_def := pg_get_functiondef('public.submit_tenant_message'::regproc::regprocedure);
  if position('''Portier369'',' in v_def) > 0 then
    execute replace(v_def, '''Portier369'',', 'null,');
  end if;

  v_def := pg_get_functiondef('public.enqueue_communication_message'::regproc::regprocedure);
  if position('left(coalesce(nullif(trim(p_from_name), ''''), ''Portier369''), 200)' in v_def) > 0 then
    execute replace(v_def, 'left(coalesce(nullif(trim(p_from_name), ''''), ''Portier369''), 200)', 'left(nullif(trim(p_from_name), ''''), 200)');
  end if;
end $$;
