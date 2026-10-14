---
name: schedulers-and-dates
description: Cron/scheduler and association-local-date review lessons: definer date helper cost, suspension pauses and catch-up, recurring catch-up, scheduled-report run_as takeover
metadata:
  type: feedback
---

- Local-date patches: `association_local_date` is a definer SQL fn (never inlined); check each call is once per association/initplan, not per row. Lateral pullup trap in sql-pitfalls.
  A column of a pulled-up LATERAL is substituted at EVERY reference: `ua.local_today` used in 4 CASE arms = up to 4 definer calls per charge (20261015100000 aged_receivables). Ask for the inline `(now() at time zone coalesce(nullif(a.timezone,''),'America/Chicago'))::date` or a per-association CTE.
  A LATERAL with an aggregate (`sum(..)`) is NOT pulled up: it runs once per row however often its column is referenced (v_charge_balances pa.paid). Correlated scalar lookups under invoker RLS return NULL when the caller can't see the parent row; ask for a coalesce fallback (20261015130000 adds `coalesce(.., current_date)`).
- "Auto-pause until someone with access saves it" (20261016100000 enqueue_scheduled_reports): check the save path really changes the run-as column. guard_scheduled_report_change swaps run_as only when one of 6 columns differs, so a no-op Save then Resume pauses the schedule again. Also check whether the definer CTE `assoc(.., association_local_date(a.id))` is pulled up: if so it runs once per row, not once per association.
- "Take over owner/run_as when column tuple changes" guards: grep app writers of EACH tuple column. 20261016100000:297 had next_run_at in the tuple, so "Run now" (lib/rpcs/reports.ts runScheduleNow writes only next_run_at) silently became a takeover + recipient re-check.
- Claim-switch helpers (report_access_error_as: set request.jwt.claims to another user, restore after) are safe only if no helper caches identity in a GUC; grep set_config('app.*') before accepting.
- "Pause while company suspended" claim filters (20261016130000): list every cron in vercel.json + pg_cron and check which still run; a platform-mail exemption by from_name 'portier369%' must copy the sent_by pairing of 20261015010000:394; ask counts of queue rows with NULL portfolio_id; late fees/fees "resume" on reactivation bill the suspended period (product question).
- "Pause while suspended" holds on schedulers (20261016130000): for each job ask whether catch-up actually happens. Jobs keyed on "previous month" (run_scheduled_management_fees) lose every month but the last; "all overdue" jobs (cron_assess_late_fees) back-fine everything the pause was protecting. Queue holds are fine if no sweeper ages rows out (none on email/sms/mail/webhook queues as of 2026-10-14).
- "Catch-up only one period" recurring rewrites (20261016220000 generate_recurring_purchase_orders): `while v_date < today` jumps to the next FUTURE date, so a one-day cron miss silently drops the current period and a past start date creates next period early. Ask whether to create the latest date <= today instead.
