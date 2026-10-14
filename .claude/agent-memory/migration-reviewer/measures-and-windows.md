---
name: measures-and-windows
description: Lessons on windowed measures (payment_plan_paid_amount etc.): same window both sides, future-dated rows, multi-plan ownership, rechecking stored statuses
metadata:
  type: feedback
---

All caught by Codex after I missed them (#342-#345, 2026-10-13).

- A measure that excludes a pair (receipt + its reversal charge) must apply the SAME window to both sides; #342 (20261013150000/170000) skipped every reversal charge, even for pre-plan receipts never counted.
- A measure bounded by `current_date` but rechecked only by event triggers misses future-dated rows: nothing re-fires when the date arrives. #343 skipped bounce charges with a future due date, so the plan stayed completed. Ask "what recheck fires on day X?"
- Bound BOTH sides by the same clock (20261013200000): receipts used created_at but charges used due_date <= completed_at::date, so a charge posted later the same UTC day (or backdated) entered a frozen completed plan; a backdated bounce of a pre-plan receipt was never counted. Use recording time (created_at/reversed_at) for window edges.
- Multi-plan units: ask which plan owns a bounce for EVERY receipt age (inside plan 1, between plans, before both). Exclusions of "another plan's" rows must copy that plan's own filters exactly (created_at bound too), or rows fall between plans.
- A changed measure needs a recheck of stored statuses: rows already completed/flagged under the old measure stay stale until an event re-fires (#345; fix 20261013230000 loops app_recheck_payment_plan per unit). Ask "what re-evaluates existing rows?"
