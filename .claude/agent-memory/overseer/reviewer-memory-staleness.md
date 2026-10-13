---
name: reviewer-memory-staleness
description: Cases where a reviewer memory line (security-reviewer mostly) still described a hole the same PR fixed
metadata:
  type: feedback
---

Rule: when a PR fixes a hole a reviewer recorded, its memory line must say "fixed in <migration/PR>". Seen 5 times.

- When a PR fixes a gap a reviewer had recorded, check that reviewer's memory
  line is updated to "fixed in <migration/PR>", not left saying the hole is
  open (2026-10-08 property-group PR: security-reviewer memory still said "no
  DB trigger backs it" while 20261008030000 adds it).
- Recurring 4th time (middleware-deadlines pre-PR, 2026-10-11): the
  security-reviewer memory line added in the same diff describes the MFA
  skip as current ("only blocks writes and SKIPS the MFA gate") although the
  diff fixed it. Also: a new 503 body string in middleware.ts is user text -
  white-label-checker scope even when "no brand name" was self-checked.
- Recurring 5th time (policies-signed-in-only pre-PR, 2026-10-12):
  security-reviewer memory added in the same diff states the is_system
  sharing hole as open ("write policy must forbid the flag") though the diff
  fixed it read-side. Also Next gaps "DONE ... see Open PR" lines go stale
  when Open PR is replaced: point them at the merged PR number.
- 2026-10-12 (plan-reversal-window, Codex P1 on merged #342): migration-reviewer
  data-writers.md still said payment_plan_paid_amount "already nets" reversals;
  after 150000/180000 a reversal charge is skipped only when its receipt is in
  the plan window. Codex catches on a merged PR = reviewer lesson in the follow-up PR.
- Recurring 6th time (owner-portal-fixes pre-PR, 2026-10-13): FIVE reviewer
  memories added in the same diff describe holes the diff fixed: design
  (pay page red div, resident pages ignore errors, feed lacks executive
  filter), white-label ("Minimum amount" label), schema-checker (RPC "drops"
  company-wide events - it keeps them), security (staff-at-A escapes
  triggers), migration (arch_msg relabels board rows). Reviewers write memory
  at finding time; the fix comes after. Every pre-PR: read each reviewer
  memory diff line against the final diff.
