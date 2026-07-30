
drop policy if exists "associations_auth" on public.associations;
drop policy if exists "Users can view their associations" on public.associations;
drop policy if exists "Anon cannot access associations" on public.associations;

create policy "associations_select"
  on public.associations for select
  using (
    portfolio_id = (select portfolio_id from public.profiles where id = auth.uid())
    or exists (select 1 from public.platform_operators where auth_user_id = auth.uid())
  );
;
