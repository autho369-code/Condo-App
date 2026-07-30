
-- Make sure profiles is readable by the owner
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;

create policy "profiles_select"
  on public.profiles for select
  using (id = auth.uid());

-- Fix associations policy to use direct join instead of subquery
drop policy if exists "associations_select" on public.associations;

create policy "associations_select"
  on public.associations for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.portfolio_id = associations.portfolio_id
    )
  );
;
