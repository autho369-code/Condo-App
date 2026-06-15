-- Platform-operator users admin relies on profiles.disabled_at for soft-disable.
-- The column did not exist, breaking the Users page status badge, status filter,
-- and the disable/enable + delete actions. Add it as a nullable timestamp:
-- when set, the account is soft-disabled; cleared = active.
alter table public.profiles add column if not exists disabled_at timestamptz;
comment on column public.profiles.disabled_at is 'When set, the user account is soft-disabled (login should be blocked). Cleared to re-enable. Managed by platform-operator users admin.';
