---
name: messaging-email-sms
description: Lessons from email queue, invitations, SMS routing, unsubscribe, rate limits, webhook undo and transaction-local flag reviews (2026-10-13/14)
metadata:
  type: feedback
---

## Transaction-local flag guards (20261014150000)
- `set_config('app.x','on',true)` bypass flags (app.approval_decision, app.loan_ledger, app.inventory_movement) can't be forged via API (pg_catalog not exposed, no exec/set_config wrapper, no db-pre-request). Real risk: every OTHER function patched to set the flag; check its own auth/state checks (tally_approval_vote ignored status='pending').

## Races and idempotency
- `if exists(...) raise` guards in DEFINER RPCs (apply_assessment_update, adopt_budget, 20261014210000) race under READ COMMITTED; take a parent-row lock first. Form tokens only stop the same form twice.
- Codex on #366: a `claimSubmission` duplicate is success only when `resultId` is set.
- Codex on #367: rate limits count only server-set values (not client created_at) and lock their scope before counting (20261014230000).
- Webhook "undo on terminal status" (AutoPay setup): retries after a partial delivery must also undo; undo helpers must not early-return before later steps (method retire).

## Email queue and invitations (20261014220000)
- "Creator can read" on secret rows (`sent_by = auth.uid()`): staff-triggered resets queue the target's link with sent_by = requester. Grep every writer's sentBy. (Fixed: nobody signed-in reads them.)
- `user_invitations.token` was readable by all company staff; column now ungranted, so user-client reads must name columns (no select('*'), no insert().select() returning token).
- Statement-level AFTER triggers fire once per INSERT inside a plpgsql loop: O(n^2). Use set-based inserts.
- Rate limits counting a client-writable column are bypassed; force it (`new.sent_by := auth.uid()`).
- Definer helpers granted so an INVOKER trigger can call them are public RPCs: check as oracles for other companies' data.

## SMS routing (sms-sender-routing)
- `sms_messages.from_number`, `sms_conversations.our_phone_number` are staff-writable and seeded from company-editable `portfolios.phone_number`: routing proof must be a service-only column. Watch `.limit(n)` truncation on match queries.
- Freeze every column the routing query matches on, not just the proof column; count distinct companies for ambiguity, not row counts.
- Freeze from claim (locked_at) on, not from provider_message_id, or have complete verify sent values.

## Unsubscribe and suppression
- RFC 8058 one-click POSTs come from shared provider IPs: no per-IP rate limit; per-token and fail open.
- A complaint stops optional mail only; auth links (reset, invites) must still go (holds_auth_link).
- Per-recipient failure must not mark the shared parent message failed.
