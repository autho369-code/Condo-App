alter table public.profiles add column if not exists disabled_at timestamptz;
comment on column public.profiles.disabled_at is 'When set, the user account is soft-disabled (login should be blocked). Cleared to re-enable. Managed by platform-operator users admin.';;
