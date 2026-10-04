-- Codex review of #191: the association settings form saves description,
-- management_end_reason and maintenance_notes straight to their side tables,
-- so update_association_settings' audit entry no longer covers them. Log
-- each change to those side tables as its own association audit entry.
-- Only the names of the changed fields are logged, never the values:
-- audit_logs is readable by all of the company's staff, including managers
-- scoped away from this association (Codex review), while the side tables
-- also apply can_view_association_row.
create or replace function public.audit_association_private_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_new jsonb := to_jsonb(new) - 'association_id' - 'updated_at';
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) - 'association_id' - 'updated_at' else '{}'::jsonb end;
  v_fields text[] := '{}';
  k text;
begin
  for k in select jsonb_object_keys(v_new) loop
    if (v_new -> k) is distinct from coalesce(v_old -> k, 'null'::jsonb) then
      v_fields := v_fields || k;
    end if;
  end loop;
  if cardinality(v_fields) = 0 then return null; end if;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  select a.portfolio_id, 'association', a.id, 'association_private_settings_updated', auth.uid(),
         (select u.email from auth.users u where u.id = auth.uid()),
         jsonb_build_object('fields', to_jsonb(v_fields))
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

-- Same review: set_owner_late_fee_override logged the late-fee reason in
-- audit_logs. Log only whether a reason was given; the reason itself stays in
-- occupancy_private. Otherwise the same as 20261004200000.
create or replace function public.set_owner_late_fee_override(p_occupancy_id uuid, p_exempt boolean, p_amount numeric, p_is_percent boolean, p_until date, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare o record; v_portfolio uuid;
begin
  select occ.*, a.portfolio_id as pid into o
    from public.occupancies occ join public.associations a on a.id = occ.association_id
   where occ.id = p_occupancy_id for update of occ;
  if not found or not public.can_manage_finance(o.pid) or not public.can_access_association(o.association_id) then
    raise exception 'Ownership record not found' using errcode = 'P0002';
  end if;
  if p_amount is not null and (p_amount < 0 or (coalesce(p_is_percent, false) and p_amount > 100)) then
    raise exception 'Enter a fee of $0 or more, or a percentage up to 100' using errcode = '22023';
  end if;
  if (coalesce(p_exempt, false) or p_amount is not null) and length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Give a reason for the late-fee exception' using errcode = '22023';
  end if;
  if p_until is not null and p_until < current_date then
    raise exception 'The end date must be today or later' using errcode = '22023';
  end if;
  update public.occupancies set
    late_fee_exempt = coalesce(p_exempt, false),
    late_fee_override_amount = case when coalesce(p_exempt, false) then null else p_amount end,
    late_fee_override_is_percent = case when coalesce(p_exempt, false) or p_amount is null then false else coalesce(p_is_percent, false) end,
    late_fee_override_until = case when coalesce(p_exempt, false) or p_amount is not null then p_until end,
    updated_at = now()
  where id = p_occupancy_id;
  -- Staff-only: the reason never sits on the occupancy row owners and board read,
  -- nor in audit_logs (readable by managers scoped away from this association).
  insert into public.occupancy_private (occupancy_id, late_fee_override_reason, updated_at)
  values (p_occupancy_id,
          case when coalesce(p_exempt, false) or p_amount is not null then nullif(btrim(p_reason), '') end,
          now())
  on conflict (occupancy_id) do update
    set late_fee_override_reason = excluded.late_fee_override_reason, updated_at = now();
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (o.pid, 'owner', o.owner_id, 'late_fee_override_updated', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('occupancy_id', p_occupancy_id, 'unit_id', o.unit_id,
            'before', jsonb_build_object('exempt', o.late_fee_exempt, 'amount', o.late_fee_override_amount, 'is_percent', o.late_fee_override_is_percent, 'until', o.late_fee_override_until),
            'after', jsonb_build_object('exempt', coalesce(p_exempt, false), 'amount', p_amount, 'is_percent', p_is_percent, 'until', p_until, 'reason_given', p_reason is not null and btrim(p_reason) <> '')));
end $function$;
