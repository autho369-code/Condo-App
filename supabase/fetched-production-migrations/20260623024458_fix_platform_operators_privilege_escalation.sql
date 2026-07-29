
-- CRITICAL: platform_operators had an ALL policy for role `public` with
-- USING/WITH CHECK = true, letting ANYONE (even anonymous) read every operator
-- and INSERT themselves as a platform operator (full god-mode). Replace it with
-- an operator-only policy. is_platform_operator() is SECURITY DEFINER so it
-- bypasses RLS internally (no recursion) and login/`me` are unaffected.
-- Applied to remote DB 2026-06-22.
drop policy if exists platform_operators_admin_all on public.platform_operators;

create policy platform_operators_operator_all on public.platform_operators
  for all to authenticated
  using (public.is_platform_operator())
  with check (public.is_platform_operator());
;
