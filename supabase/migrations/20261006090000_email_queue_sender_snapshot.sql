-- The sending address chosen for a queued email on its first delivery attempt
-- (the company's own verified domain or the platform address). Retries reuse
-- it, so a retry after the provider accepted the email replays the same
-- request (same idempotency key and payload) even if the company's sender
-- domain was switched on, off or changed in between. Additive only.
alter table public.email_queue add column if not exists sender_address text;
