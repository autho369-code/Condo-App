-- Structured identifier for a recurring fee line (e.g. parking space number,
-- locker number) so they can be reported/exported, not just kept in the memo.
alter table public.unit_recurring_charges
  add column if not exists identifier text;

comment on column public.unit_recurring_charges.identifier is
  'Optional asset identifier for this fee, e.g. parking space # or locker #.';;
