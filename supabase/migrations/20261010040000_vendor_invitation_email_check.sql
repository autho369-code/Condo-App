-- link_vendor_on_invitation_accept bound the accepting login to a vendor
-- record without checking that the login's email is the invitation's. The
-- app's accept_invitation checks it, but a company admin can update an
-- invitation row directly (user_invitations_admin_all) and set status and
-- used_by, binding any confirmed login of the company to any vendor record.
-- Same check as link_owner_on_invitation_accept. Body otherwise unchanged
-- (from 20261009040000).

create or replace function public.link_vendor_on_invitation_accept()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  -- Only the person the invitation was sent to (accept_invitation checks this
  -- too; a direct status change by a company admin must not bypass it), as
  -- link_owner_on_invitation_accept does.
  if new.hoa_role::text = 'vendor'
     and new.status::text = 'accepted' and old.status::text is distinct from 'accepted'
     and new.used_by is not null
     and not exists (select 1 from auth.users u
                      where u.id = new.used_by and lower(btrim(u.email)) = lower(btrim(new.email))) then
    raise exception 'This vendor invitation cannot be used by this account. Ask the management office for a new invitation.'
      using errcode = '42501';
  end if;

  if new.hoa_role::text = 'vendor'
     and new.status::text = 'accepted' and old.status::text is distinct from 'accepted'
     and new.used_by is not null
     and not exists (select 1 from public.vendors x where x.auth_user_id = new.used_by) then
    update public.vendors v
       set auth_user_id = new.used_by, portal_activated = true
     -- Re-checked on the row itself, so two accepts at the same moment cannot
     -- both bind it.
     where v.auth_user_id is null
       and not exists (select 1 from public.vendor_portal_logins l2 where l2.vendor_id = v.id and l2.revoked_at is null)
       and v.id = (
       select c.id from public.vendors c
        where c.portfolio_id = new.portfolio_id
          and c.auth_user_id is null
          and c.archived_at is null
          -- Never a record already added to another login.
          and not exists (select 1 from public.vendor_portal_logins l where l.vendor_id = c.id and l.revoked_at is null)
          -- An invitation for one exact vendor record links that record or
          -- nothing (never another association's record with the same email);
          -- older invitations without one fall back to association, then email.
          and (nullif(new.metadata ->> 'vendor_id', '') is null
               or c.id::text = new.metadata ->> 'vendor_id')
          and jsonb_typeof(c.emails) = 'array'
          and exists (
            select 1 from jsonb_array_elements(c.emails) as e(val)
             where lower(btrim(case jsonb_typeof(e.val)
                                 when 'string' then e.val #>> '{}'
                                 when 'object' then e.val ->> 'email'
                               end)) = lower(btrim(new.email)))
        order by (c.id::text = coalesce(new.metadata ->> 'vendor_id', '')) desc,
                 (c.association_id is not distinct from new.association_id and new.association_id is not null) desc,
                 c.created_at desc, c.id
        limit 1);
  elsif new.hoa_role::text = 'vendor'
     and new.status::text = 'accepted' and old.status::text is distinct from 'accepted'
     and new.used_by is not null
     and nullif(new.metadata ->> 'vendor_id', '') is not null
     and exists (select 1 from public.profiles p
                  where p.id = new.used_by and p.portfolio_id = new.portfolio_id
                    and p.hoa_role = 'vendor' and p.disabled_at is null) then
    -- The login already has a vendor record: add the invited record to it.
    insert into public.vendor_portal_logins (vendor_id, auth_user_id, portfolio_id, invitation_id)
    select c.id, new.used_by, c.portfolio_id, new.id
      from public.vendors c
     where c.id::text = new.metadata ->> 'vendor_id'
       and c.portfolio_id = new.portfolio_id
       and c.archived_at is null
       and c.auth_user_id is null
       and jsonb_typeof(c.emails) = 'array'
       and exists (
         select 1 from jsonb_array_elements(c.emails) as e(val)
          where lower(btrim(case jsonb_typeof(e.val)
                              when 'string' then e.val #>> '{}'
                              when 'object' then e.val ->> 'email'
                            end)) = lower(btrim(new.email)))
    -- A link revoked when staff turned the portal off is replaced.
    on conflict (vendor_id) do update
      set auth_user_id = excluded.auth_user_id, portfolio_id = excluded.portfolio_id,
          invitation_id = excluded.invitation_id, linked_at = now(), revoked_at = null
      where public.vendor_portal_logins.revoked_at is not null;

    -- Activate it for this login (also a record of this login that staff had
    -- turned off and invited again).
    update public.vendors v
       set portal_activated = true
     where v.id::text = new.metadata ->> 'vendor_id'
       and not v.portal_activated
       and v.archived_at is null
       and (v.auth_user_id = new.used_by
            or exists (select 1 from public.vendor_portal_logins l
                        where l.vendor_id = v.id and l.auth_user_id = new.used_by and l.revoked_at is null));
  end if;
  return new;
end
$function$;

revoke all on function public.link_vendor_on_invitation_accept() from public, anon, authenticated;
