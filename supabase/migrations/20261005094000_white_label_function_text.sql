-- White label: text that client companies' boards and staff see must not name
-- the platform. Board approval requests fell back to "Portier369 staff" as the
-- requester; the inbox and emergency-request emails told staff to act "in
-- Portier369". (Sender names are branded per client at delivery time in
-- /api/email/process-queue.)
--
-- Rewrites the live definitions in place (CREATE OR REPLACE keeps grants);
-- re-running is a no-op once the text is gone.
do $$
declare
  v_def text;
  v_fn regprocedure;
begin
  foreach v_fn in array array[
    'public.open_board_approval_request'::regproc::regprocedure,
    'public.request_payable_bill_approval'::regproc::regprocedure
  ] loop
    v_def := pg_get_functiondef(v_fn);
    if position('''Portier369 staff''' in v_def) > 0 then
      execute replace(v_def, '''Portier369 staff''', '''Management staff''');
    end if;
  end loop;

  v_def := pg_get_functiondef('public.message_notify'::regproc::regprocedure);
  if position('Reply from the Inbox in Portier369.' in v_def) > 0 then
    execute replace(v_def, 'Reply from the Inbox in Portier369.', 'Reply from the Inbox.');
  end if;

  v_def := pg_get_functiondef('public.service_request_emergency_alert'::regproc::regprocedure);
  if position('Open the Service Requests queue in Portier369 to dispatch a vendor.' in v_def) > 0 then
    execute replace(v_def, 'Open the Service Requests queue in Portier369 to dispatch a vendor.', 'Open the Service Requests queue to dispatch a vendor.');
  end if;
end $$;
