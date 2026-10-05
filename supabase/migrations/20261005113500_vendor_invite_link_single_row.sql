-- Linking an accepted vendor invitation: when two unarchived vendor rows in
-- the company share the invited email (e.g. a shared accounting address), the
-- update tried to give both the same auth_user_id, hit idx_vendors_auth_user
-- and rolled back the acceptance. Link exactly one row (the most recently
-- created match), and only when this account is not already linked.
create or replace function public.link_vendor_on_invitation_accept()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if new.hoa_role::text = 'vendor'
     and new.status::text = 'accepted' and old.status::text is distinct from 'accepted'
     and new.used_by is not null
     and not exists (select 1 from public.vendors x where x.auth_user_id = new.used_by) then
    update public.vendors v
       set auth_user_id = new.used_by, portal_activated = true
     where v.id = (
       select c.id from public.vendors c
        where c.portfolio_id = new.portfolio_id
          and c.auth_user_id is null
          and c.archived_at is null
          and exists (
            select 1 from jsonb_array_elements_text(c.emails) as e(email)
             where lower(e.email) = lower(new.email))
        order by c.created_at desc, c.id
        limit 1);
  end if;
  return new;
end $$;

revoke execute on function public.link_vendor_on_invitation_accept() from public, anon, authenticated;
