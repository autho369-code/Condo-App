-- One-time form tokens. A double-clicked or re-sent form (receipts, lockbox
-- uploads) recorded the same money twice. Each form now carries a token
-- generated when the page renders; the action claims it here (primary key)
-- before writing, so a second submission of the same form finds the first.
create table if not exists public.form_submissions (
  token uuid primary key,
  kind text not null check (kind ~ '^[a-z_]{1,40}$'),
  created_by uuid not null default auth.uid(),
  result_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists form_submissions_created_at_idx on public.form_submissions (created_at);

alter table public.form_submissions enable row level security;

drop policy if exists form_submissions_own_select on public.form_submissions;
create policy form_submissions_own_select on public.form_submissions
  for select to authenticated using (created_by = auth.uid());
drop policy if exists form_submissions_own_insert on public.form_submissions;
create policy form_submissions_own_insert on public.form_submissions
  for insert to authenticated with check (created_by = auth.uid() and public.is_any_staff());
drop policy if exists form_submissions_own_update on public.form_submissions;
create policy form_submissions_own_update on public.form_submissions
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists form_submissions_own_delete on public.form_submissions;
create policy form_submissions_own_delete on public.form_submissions
  for delete to authenticated using (created_by = auth.uid());

revoke all on public.form_submissions from anon;
grant select, insert, update, delete on public.form_submissions to authenticated;
