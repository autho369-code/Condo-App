-- Track when an invoice email was last sent to the company billing contact,
-- so the operator UI can show Send vs Resend. Applied to remote DB 2026-06-15.
alter table public.invoices add column if not exists sent_at timestamptz;
comment on column public.invoices.sent_at is 'When the invoice email was last sent to the company billing contact.';
