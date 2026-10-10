-- Codex review on #281: my_accessible_association_ids() and
-- my_accessible_unit_ids() return every association / unit id in the
-- caller's company. That is right for the policies (manager scope is a
-- separate restrictive policy), but a scoped manager could call them as an
-- API RPC and list ids the tables hide from them.
--
-- Move both into rls_private, a schema the API does not expose and nobody
-- but the owner can use. Policies refer to functions by id, not by name, so
-- they keep working unchanged (checked: same row counts for company admin,
-- manager, operator, vendor, owner and board; a direct call as
-- authenticated gets "permission denied for schema rls_private").
-- Execution inside a policy needs only EXECUTE on the function, which
-- authenticated keeps.

create schema if not exists rls_private;
revoke all on schema rls_private from public;

alter function public.my_accessible_association_ids() set schema rls_private;
alter function public.my_accessible_unit_ids() set schema rls_private;

-- The unit helper calls the association helper by name.
create or replace function rls_private.my_accessible_unit_ids()
returns setof uuid
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  -- Every unit can_access_unit() lets the caller see.
  return query
  select u.id
    from public.units u
    join public.buildings b on b.id = u.building_id
   where b.association_id in (select rls_private.my_accessible_association_ids());
end
$$;

comment on function public.can_access_association(uuid) is
  'Policies use the twin: x IN (select rls_private.my_accessible_association_ids()). Change both together (20261011010000, 20261011030000, 20261011050000).';
comment on function public.can_access_unit(uuid) is
  'Policies use the twin: x IN (select rls_private.my_accessible_unit_ids()). Change both together (20261011020000, 20261011050000).';
