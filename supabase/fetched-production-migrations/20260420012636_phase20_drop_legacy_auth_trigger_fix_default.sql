-- Remove the pre-multi-tenant handler so only handle_new_auth_user runs.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Change default: new users should be 'owner' (portal-first), not 'manager'.
-- Staff get upgraded via invitation acceptance.
alter table public.profiles alter column hoa_role set default 'owner'::public.hoa_role;

comment on column public.profiles.hoa_role is 'Default is owner. Staff get upgraded to manager when accepting a staff invitation; portal users (owner/tenant/board) stay at their portal role.';;
