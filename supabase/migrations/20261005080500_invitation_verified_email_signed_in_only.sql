-- 20261005080000 broke first-time invite signup: /invite creates the
-- (still unverified) account through the service role, and
-- trg_apply_pending_invitation marks the invitation accepted inside that same
-- auth.users insert, so the verified-email check rolled back the signup.
-- That path already proves possession of the invitation token, and the
-- account still has to confirm its email before it can sign in. Apply the
-- check only to signed-in acceptance (accept_invitation(), auth.uid() set).
create or replace function public.guard_invitation_accept_verified_email()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is not null
     and new.status::text = 'accepted' and old.status::text is distinct from 'accepted' and new.used_by is not null then
    if not exists (select 1 from auth.users u where u.id = new.used_by and u.email_confirmed_at is not null) then
      raise exception 'Confirm your email address before accepting this invitation'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_invitation_accept_verified_email() from public, anon, authenticated;
