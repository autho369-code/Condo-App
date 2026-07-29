-- Root fix for board designation: board access needs TWO things that were not
-- wired together — current_board_association_ids() reads board_members, but
-- is_board_user() reads profiles.hoa_role='board'. The auto-link trigger linked
-- board_members on login but never flipped the profile, so designating a board
-- member silently failed (the user was bounced to /portal).
-- Now, when a new auth user links to an active board_members row, elevate their
-- profile to 'board' (only from 'owner', so staff roles are never downgraded).
-- Applied to remote DB 2026-06-14.
CREATE OR REPLACE FUNCTION public.auto_link_portal_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update public.owners
     set auth_user_id = new.id, portal_activated = true
   where auth_user_id is null and archived_at is null
     and lower(email) = lower(new.email);

  update public.vendors v
     set auth_user_id = new.id, portal_activated = true
   where v.auth_user_id is null and v.archived_at is null
     and exists (
       select 1 from jsonb_array_elements_text(v.emails) as e(email)
       where lower(e.email) = lower(new.email)
     );

  update public.board_members
     set auth_user_id = new.id
   where auth_user_id is null and active
     and lower(email) = lower(new.email);

  update public.profiles p
     set hoa_role = 'board'
   where p.id = new.id
     and p.hoa_role = 'owner'
     and exists (
       select 1 from public.board_members bm
       where bm.auth_user_id = new.id and bm.active
     );

  return new;
end;
$function$;
