-- Every association is on America/Chicago. Database functions use
-- current_date / now()::date (payments, charges, voids, late fees, reports,
-- payment plans, the nightly generators), which followed the session time
-- zone, UTC: after 7 PM Central they used tomorrow's date. Make Central the
-- database default so every session (PostgREST, pg_cron, SQL editor) gets
-- today in Central. Stored timestamptz values are absolute and do not change;
-- API output carries a -05/-06 offset instead of +00.
-- Approved by Mirsad. Applied to production.
alter database postgres set timezone to 'America/Chicago';
