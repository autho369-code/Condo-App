# Elephant-Goldfish code review, 2026-10-31

Five goldfish reviewers from Google's Elephant-Goldfish plugin (four
`egm:egm-codebase-details`, one `egm:egm-zoom-out`) reviewed the live code with
no conversation history: receivables and payments, payables and accounting,
access control, operations and communications, and a management company's
first month. Every finding was checked against the live database before
fixing; several were already fixed live (reviewers read older migrations).
Two more goldfish (`egm:egm-codebase-details`, `egm:egm-design`) then reviewed
the fix itself; their findings were fixed before it went live.

## Fixed (migration 20261031132200_egm_code_review_fixes + app code)
- MFA enforced in the database for platform operators (aal2), identity kept
  for the /mfa redirect; three policies, platform_set_profile_role and the
  report access checks moved onto the MFA-checked helpers. Tested both
  session states on production before applying.
- Daily dues posting isolates each row (one company's setup gap no longer
  stops every company's dues); failures recorded on the schedule and a check
  job five minutes later fails visibly (daily health alert).
- payment_intents tied to their own company, association and unit.
- A payment against one charge applies only up to its open balance.
- Texts Twilio reported failed are not re-sent; texts and letters to held
  residents wait like their email.
- Emails whose attempts ran out are marked failed, not left pending.
- Drafts posted from Journal Entries record posted_at.
- Stripe: per-refund records keyed by refund id; a declined card inside a
  Checkout session no longer leaves an ACH payment "failed" (only a later
  completion revives it); payment_failed only from pending/processing;
  payout reconciliation excludes the payout's own transaction.
- AutoPay: next run counts from the scheduled date but no earlier than a
  month ago (at most one catch-up); a retried run doesn't count its own
  intent as in flight.
- Company admins can't disable or reset MFA for a platform operator.
- Calendar reminders retry on a read error instead of being skipped.
- CSV owner import: units matched across all buildings with normalized
  numbers, one lock with the previous-system import, one primary owner and
  dues once per unit, percentages from an old-template file (adding up past
  100%) ignored, template example fixed.
- Starting check number must be a whole number; a violation letter can't be
  emailed twice by a double click; a journal entry with no returned id fails
  loudly.

## Checked and not a defect (already fixed live)
- Check printing ignored vendor credits; voided bank transfer drafts could be
  posted; money functions open to support operators (table guards apply);
  rate_work_order scope.

## Open (Mirsad / larger work)
- Opening books at go-live (cash, reserves, prepaid, A/P, prior-system
  outstanding checks) and the onboarding checklist steps for them; delinquency
  ages reset at go-live; owners get no automatic dues notice; Stripe fees and
  the settlement bank account in the GL; board seats still linked by email;
  MFA for company staff when the company requires it (database side).
