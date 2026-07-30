
-- When a new auth user is linked to an active board_members row, elevate their
-- profile to hoa_role='board' so is_board_user() passes and the board portal
-- opens. Only elevates from 'owner' so staff roles are never downgraded.
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
;
