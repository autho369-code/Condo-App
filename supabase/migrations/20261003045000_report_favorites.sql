-- Each user's favorite (starred) reports on the Reports page.
create table if not exists public.report_favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  definition_id uuid not null references public.report_definitions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, definition_id)
);

create index if not exists report_favorites_definition_idx on public.report_favorites (definition_id);

alter table public.report_favorites enable row level security;

drop policy if exists report_favorites_own on public.report_favorites;
create policy report_favorites_own on public.report_favorites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_any_staff());

revoke all on public.report_favorites from anon;
grant select, insert, delete on public.report_favorites to authenticated;
