-- Keep immutable check rows non-writable to clients. The void function already
-- performs explicit can_manage_finance checks and is the only mutation boundary.
alter function public.void_payable_check(uuid, text, boolean) security definer;
alter function public.void_payable_check(uuid, text, boolean) owner to postgres;
revoke all on function public.void_payable_check(uuid, text, boolean) from public, anon;
grant execute on function public.void_payable_check(uuid, text, boolean) to authenticated, service_role;
