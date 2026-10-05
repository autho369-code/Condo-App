-- accept_invitation() moves the caller into the invitation's company and role
-- once the signed-in account's email matches the invitation, but never checked
-- that the address was verified: an unverified account registered with the
-- invitee's email could claim a forwarded or leaked invitation link. Refuse
-- marking an invitation accepted unless the accepting account's email is
-- confirmed (every existing account is). Additive: a new trigger, the
-- accept_invitation() function itself is unchanged.
create or replace function public.guard_invitation_accept_verified_email()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.status::text = 'accepted' and old.status::text is distinct from 'accepted' and new.used_by is not null then
    if not exists (select 1 from auth.users u where u.id = new.used_by and u.email_confirmed_at is not null) then
      raise exception 'Confirm your email address before accepting this invitation'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_invitation_accept_verified_email() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'user_invitations_accept_verified_email' and tgrelid = 'public.user_invitations'::regclass) then
    create trigger user_invitations_accept_verified_email
      before update of status on public.user_invitations
      for each row execute function public.guard_invitation_accept_verified_email();
  end if;
end $$;
