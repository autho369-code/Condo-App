-- Platform operators can open the Reports page (requireStaff admits them), so
-- they can star reports too.
alter policy report_favorites_own on public.report_favorites
  with check (user_id = (select auth.uid()) and (public.is_any_staff() or public.is_platform_operator()));
