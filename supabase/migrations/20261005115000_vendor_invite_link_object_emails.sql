-- Vendor invite linking also matches legacy object-shaped emails
-- ({ "email": ..., "type": ... }, supported by lib/vendors/contact.ts), and
-- tolerates a non-array emails value instead of raising.
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
          and jsonb_typeof(c.emails) = 'array'
          and exists (
            select 1 from jsonb_array_elements(c.emails) as e(val)
             where lower(btrim(case jsonb_typeof(e.val)
                                 when 'string' then e.val #>> '{}'
                                 when 'object' then e.val ->> 'email'
                               end)) = lower(btrim(new.email)))
        order by c.created_at desc, c.id
        limit 1);
  end if;
  return new;
end $$;

revoke execute on function public.link_vendor_on_invitation_accept() from public, anon, authenticated;
