-- White label: company mail queued by these functions fell back to the sender
-- name 'Portier369' when the company's name was missing, and the mail worker
-- treats a 'Portier369' sender as platform mail (platform name and domain).
-- Leave the name unset instead, so delivery (/api/email/process-queue)
-- applies the company's branding and, once verified, its sending domain.
-- enqueue_communication_message's p_from_name default changes the same way.
--
-- Rewrites the live definitions in place (CREATE OR REPLACE keeps grants);
-- re-running is a no-op once the text is gone. Additive: nothing is dropped.
do $$
declare
  v_def text;
  v_fn text;
begin
  v_def := pg_get_functiondef('public.enqueue_communication_message'::regproc::regprocedure);
  if position('p_from_name text DEFAULT ''Portier369''::text' in v_def) > 0 then
    execute replace(v_def, 'p_from_name text DEFAULT ''Portier369''::text', 'p_from_name text DEFAULT NULL::text');
  end if;

  foreach v_fn in array array['dispatch_calendar_maintenance_notify', 'message_notify', 'service_request_emergency_alert'] loop
    v_def := pg_get_functiondef(('public.' || v_fn)::regproc::regprocedure);
    if position('coalesce(v_company, ''Portier369'')' in v_def) > 0 then
      execute replace(v_def, 'coalesce(v_company, ''Portier369'')', 'v_company');
    end if;
  end loop;
end $$;
