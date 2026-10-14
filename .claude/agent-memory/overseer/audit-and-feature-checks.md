---
name: audit-and-feature-checks
description: Overseer checks learned from audits and feature PRs 2026-10-10..13 (settings fields, RLS anon helpers, DROP POLICY, deep-audit role lists, owner portal, email suppression, SMS routing, renamed migrations)
metadata:
  type: feedback
---

- Wrong finding: "no page edits an association's address/state". The profile's
  settings sections (`lib/associations/settings-fields.ts` 'general': address,
  city, state, zip) render through AssociationSettingsSection. Before calling a
  field uneditable, grep the field key in `lib/associations/settings-fields.ts`
  and other generic settings renderers, not only `lib/rpcs/*`.
- RLS rewrites that swap a helper for new my_*() functions (rls-hoist,
  2026-10-10): the old helper (can_access_portfolio) is granted to anon in
  the baseline; new helpers revoke anon. Check pg_policies with roles
  {public}/{anon} that now call a revoked function, and that the
  equivalence test includes an anon caller. Also CLAUDE.md rule 6 names the
  policy helpers - update it when the preferred form changes.
- DROP POLICY is DROP SQL (start check 2026-10-12, signed-in-only policies):
  a migration that removes a policy outright goes to Mirsad. Neutralise with
  `alter policy ... to authenticated using (false)` + TODO the drop, or hand
  him the SQL. drop-then-create of the same policy has precedent (20261010010000).
- Empty build queue (2026-10-12): the 1,000-row cap sweep is thorough (pages,
  app/api crons, lib all use fetchAllRows/limit). Don't re-propose it. Status
  "left per-row: small tables" predates the "judge RLS at scale" rule; those
  tables (budget_lines, meetings, signatures, bank_transfers) are still unmeasured.
- Deep-audit plans by area (violations/WOs/meetings, 2026-10-13): plans list
  owner/board/vendor/scoped mgr/other company but skip resident/tenant
  (app/resident/*), company admin, support operator, disabled account; skip
  public/API/AI/cron/storage routes; and DB-only DO blocks never exercise the
  server actions (auth re-check, emails). Charges with no charge_gl_accounts
  branch (fine, chargeback) fall to the category/default income: check GL.
- Owner-portal deep check (2026-10-13): one owner test user isn't enough -
  need a multi-record login (owner_portal_logins, ?record=), a paused portal,
  an owner with no current unit (sold: no access), a resident/tenant login
  (app/resident uses requireTenant; tenant portal scope is Mirsad's open
  decision - audit holes, don't add features), and app/portal/lease (rental?).
- Email opt-out/suppression (comms follow-ups, 2026-10-13): ~15 SQL
  functions/crons insert straight into email_queue, so a suppression check
  only in the TS mass-email action misses them. Pre-PR: check it is enforced
  at the queue (guard trigger or process-queue dispatcher) with a required-mail
  exemption, and that the unsubscribe route is in public-paths + tenant-filtered.
  owner_notification_prefs is a legacy camelCase table (integer ownerId), unused.
- Email suppression pre-PR (email-unsubscribe start, 2026-10-13): email_queue
  has no mail-category column (required vs optional must be added; who can set
  it - staff must not mark mass mail "required"); status check is only
  pending/sent/failed (new value = drop constraint = DROP SQL -> Mirsad);
  "retry a failed email" and the dispatcher must re-check suppression; Resend
  webhook already exists (record_email_event) - suppress only permanent bounces;
  platform-operator announcements also insert into email_queue.
- Renamed migration (comms-followups, 2026-10-13: 20261014240000 ->
  233000 after applying live): grep the old version in docs/brain and every
  agent memory (Product Rules, Shipped, white-label still said 240000), and
  ask for the live schema_migrations read-back of both versions.
- When a fix changes what a column stores/means (sms-sender-routing start,
  2026-10-13: sms_conversations.our_phone_number), grep every READER too: the
  plan covered lib/sms/inbound-reply.ts but missed the STOP/START consent
  disambiguation in app/api/sms/twilio/inbound/route.ts (~line 64). Also check
  whether a Codex finding is already fixed in the working tree (P2 was).
- Design changed mid-PR (sms-sender-routing pre-PR, 2026-10-13): Product
  Rules kept the superseded "capped lookup that comes back full = ambiguous"
  after the fix moved to uncapped RPCs counting distinct companies. Re-read each
  new vault rule against the FINAL code. Also: one migration file applied live
  as two apply_migration calls (two schema_migrations versions) - ask for the
  read-back and make file(s) match live versions; migration-reviewer re-runs
  when definer RPCs are added after its review.
- Start check 2026-10-13 (banking follow-ups): gap "year-end close does not
  lock months" was half stale - finalize_year_end_package already requires
  all 12 months closed (year_end_readiness periods_closed); the real hole is
  reopening a month inside a finalized package (set_accounting_period_status).
  Periods are company-wide, packages per association. Also "undo
  reconciliation" reverses a Decisions entry (2026-10-13 "final in the app");
  Decisions must be rewritten in the same PR. Cleared items point at
  journal_lines too, not only bank_adjustments - guard both. An undo that
  DELETEs items makes the migration Mirsad's; reopen by status instead.
- Pre-PR 2026-10-13 (banking follow-ups): app-side two-step deletes (items,
  then parent) are not atomic - ask for an RPC or accept in Decisions. A
  "Discard" offered on a reopened (undone) record deletes the once-completed
  row (audit_logs keeps the undo only): Decisions must say if intended.
  Reviewer leftovers ("no FK on X") must land in Next gaps or be marked
  "not needed" - they vanish otherwise.
