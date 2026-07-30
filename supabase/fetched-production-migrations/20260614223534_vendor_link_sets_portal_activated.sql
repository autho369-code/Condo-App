CREATE OR REPLACE FUNCTION public.auto_link_portal_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update public.owners
     set auth_user_id = new.id,
         portal_activated = true
   where auth_user_id is null
     and archived_at is null
     and lower(email) = lower(new.email);

  update public.vendors v
     set auth_user_id = new.id,
         portal_activated = true
   where v.auth_user_id is null
     and v.archived_at is null
     and exists (
       select 1 from jsonb_array_elements_text(v.emails) as e(email)
       where lower(e.email) = lower(new.email)
     );

  update public.board_members
     set auth_user_id = new.id
   where auth_user_id is null
     and active
     and lower(email) = lower(new.email);

  return new;
end;
$function$;;
