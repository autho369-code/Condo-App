-- Messages and sales leads captured by the Portier369 AI phone receptionist
-- ("Piper", portier-receptionist on Fly.io). Service-role writes only.
create table if not exists public.phone_messages (
  id uuid primary key default gen_random_uuid(),
  caller_name text,
  callback_number text,
  email text,
  company text,
  doors text,
  current_software text,
  topic text,
  message text,
  urgency text default 'normal',
  provider text,
  call_id text,
  from_number text,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.phone_messages enable row level security;

-- Platform operator reads/manages in-app; the receptionist writes via service role.
drop policy if exists phone_messages_operator_all on public.phone_messages;
create policy phone_messages_operator_all on public.phone_messages
  for all
  using (public.is_platform_operator())
  with check (public.is_platform_operator());
;
