-- Codex review of #191: the association settings form saves description,
-- management_end_reason and maintenance_notes straight to their side tables,
-- so update_association_settings' audit entry no longer covers them. Log
-- each change to those side tables as its own association audit entry
-- (audit_logs is readable by the company's staff only, so values are kept).
create or replace function public.audit_association_private_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_new jsonb := to_jsonb(new) - 'association_id' - 'updated_at';
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) - 'association_id' - 'updated_at' else '{}'::jsonb end;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  k text;
begin
  for k in select jsonb_object_keys(v_new) loop
    if (v_new -> k) is distinct from coalesce(v_old -> k, 'null'::jsonb) then
      v_before := v_before || jsonb_build_object(k, v_old -> k);
      v_after := v_after || jsonb_build_object(k, v_new -> k);
    end if;
  end loop;
  if v_after = '{}'::jsonb then return null; end if;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  select a.portfolio_id, 'association', a.id, 'association_private_settings_updated', auth.uid(),
         (select u.email from auth.users u where u.id = auth.uid()),
         jsonb_build_object('before', v_before, 'after', v_after)
    from public.associations a where a.id = new.association_id;
  return null;
end $$;

revoke all on function public.audit_association_private_change() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'association_private_audit' and tgrelid = 'public.association_private'::regclass) then
    create trigger association_private_audit after insert or update on public.association_private
      for each row execute function public.audit_association_private_change();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'association_vendor_private_audit' and tgrelid = 'public.association_vendor_private'::regclass) then
    create trigger association_vendor_private_audit after insert or update on public.association_vendor_private
      for each row execute function public.audit_association_private_change();
  end if;
end $$;
