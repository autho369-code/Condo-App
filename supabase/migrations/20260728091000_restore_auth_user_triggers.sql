-- Preserve the deployed auth-user lifecycle in reproducible environments.
-- Production catalog evidence on 2026-07-28 showed these four triggers on
-- auth.users, but their CREATE TRIGGER statements were absent from the local
-- migration directory.

do $block$
declare
  v_trigger record;
begin
  for v_trigger in
    select *
    from (values
      ('trg_apply_pending_invitation', 'public.apply_pending_invitation()', 'after insert', null::text),
      ('trg_auto_link_portal_user', 'public.auto_link_portal_user()', 'after insert', null::text),
      ('trg_handle_new_auth_user', 'public.handle_new_auth_user()', 'after insert', null::text),
      ('trg_relink_portal_user_on_email', 'public.relink_portal_user_on_email_change()', 'after update', 'email')
    ) as required(trigger_name, function_identity, timing_event, update_column)
  loop
    if to_regprocedure(v_trigger.function_identity) is null then
      raise exception 'required auth trigger function % is missing', v_trigger.function_identity;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_trigger t
      join pg_catalog.pg_class c on c.oid = t.tgrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'auth'
        and c.relname = 'users'
        and t.tgname = v_trigger.trigger_name
        and not t.tgisinternal
    ) then
      if v_trigger.update_column is null then
        execute pg_catalog.format(
          'create trigger %I %s on auth.users for each row execute function %s',
          v_trigger.trigger_name,
          v_trigger.timing_event,
          v_trigger.function_identity
        );
      else
        execute pg_catalog.format(
          'create trigger %I after update of %I on auth.users for each row execute function %s',
          v_trigger.trigger_name,
          v_trigger.update_column,
          v_trigger.function_identity
        );
      end if;
    end if;
  end loop;
end;
$block$;

