---
name: rls-hoist
description: How to review the 2026-10-11 RLS "once per query" rewrite (my_* helpers) and new policies that use it
metadata:
  type: project
---

Migrations 20261011010000 + 20261011020000 (applied 2026-10-10) rewrote every public policy:
can_access_portfolio/can_manage_finance/can_admin_portfolio(x) -> `COALESCE(x = (SELECT my_*_portfolio()), false) OR (operator AND x IS NOT NULL)`;
can_access_association/can_access_unit/can_manage_association/can_edit_association_mvp(x) -> `x IN (SELECT my_*_ids())`;
can_view_association_row(x) and can_write_vendor_row(x) are INLINED (manager_is_scoped / my_managed_association_ids).
Reviewed 2026-10-10: algebraically equivalent to the helper definitions (including null and non-existent ids), no widening.

**How to apply:**
- Policies no longer contain `can_access_association(` etc. as text: a migration that finds policies by
  grepping `pg_policies.qual` for the old helper names will miss them; and changing a helper body
  (e.g. adding `ended_at is null` to can_view_association_row) no longer changes policies. Change the
  matching my_* helper or inlined text too.
- `my_accessible_association_ids()` / `my_accessible_unit_ids()` are portfolio-wide (ignore manager
  scope); a scoped manager calling them via /rest/v1/rpc enumerates every company association/unit id
  (UUIDs only; low). Never use them alone for scoped-manager decisions in app code.
- Storage policies (storage.objects) were not rewritten; they still call the originals.
