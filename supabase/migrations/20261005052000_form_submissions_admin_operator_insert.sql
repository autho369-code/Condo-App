-- Double-submit tokens: company admins and platform operators also use the
-- manager workspace forms, but form_submissions_own_insert requires
-- is_any_staff() (hoa_role = 'manager' only), so every token-guarded staff
-- form failed for them with an RLS error. Let them claim their own tokens.
-- Additive: the existing policies are unchanged.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'form_submissions' and policyname = 'form_submissions_admin_operator_insert'
  ) then
    create policy form_submissions_admin_operator_insert on public.form_submissions
      for insert to authenticated
      with check (
        created_by = (select auth.uid())
        and (public.is_company_admin() or public.is_platform_operator())
      );
  end if;
end $$;
