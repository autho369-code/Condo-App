-- When a newly-created auth user is matched to an owner record by email,
-- also flag the owner as portal-activated so the Owner Portal Activation
-- dashboard shows "Active" instead of "Needs invite" once they accept.
CREATE OR REPLACE FUNCTION public.auto_link_portal_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  -- Owners: one user can only own one owner record (unique constraint)
  update public.owners
     set auth_user_id = new.id,
         portal_activated = true
   where auth_user_id is null
     and archived_at is null
     and lower(email) = lower(new.email);

  -- Vendors: one user = one vendor record (unique constraint)
  update public.vendors v
     set auth_user_id = new.id
   where v.auth_user_id is null
     and v.archived_at is null
     and exists (
       select 1 from jsonb_array_elements_text(v.emails) as e(email)
       where lower(e.email) = lower(new.email)
     );

  -- Board members: one user can serve on multiple boards
  update public.board_members
     set auth_user_id = new.id
   where auth_user_id is null
     and active
     and lower(email) = lower(new.email);

  return new;
end;
$function$;
