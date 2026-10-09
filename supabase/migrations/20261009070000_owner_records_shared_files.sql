-- Owner login leftovers: two checks still matched an owner to the sign-in by
-- owners.auth_user_id only, so a record added to a login (owner_portal_logins,
-- one record per association) was left out. Both now use current_owner_ids(),
-- like every other owner policy since 20261009050000. Additive: nothing is
-- dropped (the policy is altered in place).

-- Shared association files: an owner reads them for every association the
-- login holds a current unit in.
alter policy "owners can read shared association attachments" on public.association_attachments
  using (
    shared_with_owner
    and archived_at is null
    and exists (
      select 1
        from public.occupancies occ
       where occ.owner_id in (select public.current_owner_ids())
         and occ.association_id = association_attachments.association_id
         and occ.status = 'current'::public.occupancy_status
    )
  );

-- Association access check: the owner branch counts every record of the login.
create or replace function public.can_access_association_mvp(a_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return (
    a_id is not null
    and (
      public.is_platform_operator()
      or exists (
        select 1
          from public.profiles p
          join public.associations a on a.portfolio_id = p.portfolio_id
         where p.id = auth.uid()
           and (p.mvp_role in ('company_admin', 'accountant') or p.hoa_role = 'company_admin')
           and a.id = a_id
      )
      or exists (
        select 1
          from public.profiles p
          join public.association_managers am
            on am.user_id = p.id
           and am.ended_at is null
          join public.associations a
            on a.id = am.association_id
           and a.portfolio_id = p.portfolio_id
         where p.id = auth.uid()
           and (
             p.mvp_role in ('manager', 'assistant_manager')
             or (p.mvp_role is null and p.hoa_role = 'manager')
           )
           and a.id = a_id
      )
      or exists (
        select 1
          from public.board_members bm
         where bm.auth_user_id = auth.uid()
           and bm.association_id = a_id
           and bm.active = true
      )
      or exists (
        select 1
          from public.occupancies oc
          join public.units u on u.id = oc.unit_id
          join public.buildings b on b.id = u.building_id
         where b.association_id = a_id
           and oc.owner_id in (select public.current_owner_ids())
           and oc.status = 'current'
      )
    )
  );
end
$function$;

alter function public.can_access_association_mvp(uuid) owner to postgres;
revoke all on function public.can_access_association_mvp(uuid) from public, anon;
grant execute on function public.can_access_association_mvp(uuid) to authenticated, service_role;
