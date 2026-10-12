# security-reviewer memory

## Confirmed rules (Mirsad)
- The board portal is read-only. Owners and vendors change only what their portal explicitly offers, on their own records (vendor work-order status, owner profile/payments/reservations/insurance). Nobody outside staff sees manager notes.

## False alarms to skip
- Webhooks and cron routes have no signed-in user: a verified signature or `requireCronSecret` is their auth. (Codex on PR #229.)
- A layout that swaps `children` for a notice (company-admin NoCompanyNotice) hides output only; page.tsx still runs its queries but nothing is serialized. Not a leak; just confirm each page/action still guards itself.

## Recurring mistakes
- `communications_log` RLS only checks `portfolio_id`: writes into another association pass RLS unless `managesAssociation` is checked (see `lib/rpcs/notifications.ts`).
- Service-client undo/cleanup must be pinned to the exact row id plus `portfolio_id`.
- "Shared row" read branches keyed on a staff-writable flag (`is_system` in `mt_read`, `report_defs_authenticated_read`) let one company publish rows to every signed-in user; the write policy must forbid the flag for non-operators (2026-10-12). Fixed in 20261012010000 on the read side: mt_read needs is_system and group_id is null; report_defs read drops is_system (shared = no company); writes still allow the flag, harmlessly.
- Restrictive mgr_assoc_scope treats a NULL association as visible (units: coalesce(..., true) when the building is hidden by buildings RLS). Safe only because the permissive policy (units_staff_all EXISTS buildings) also needs a visible parent; recheck if a permissive policy stops joining through the parent (20261012020000).

## Topic files
- [Helpers and schema notes](helpers.md) -- tenant headers, portfolios guards, branding writers, bind args, owners/units RLS, AppFolio import
- [Missed checks](missed-checks.md) -- domain-proof replay/relay, token minting, html_escape, storage cleanup, finance RPC scope triggers, hidden columns copied by DEFINER triggers (soft_delete_log)
- [Tenant scoping, concurrency, Next.js](tenant-concurrency-nextjs.md) -- public pages scope by tenant, CAS guards, inline action captures
- [Owner/vendor logins](owner-vendor-logins.md) -- one association per owner/vendor, multi-record logins, invite linking
- [Finance imports and audits](finance-imports-audits.md) -- INVOKER vs service-only GL helpers, rerun date windows, operator_write_guard
- [Enforced nonce CSP](csp.md) -- blob print docs, prerendered pages, matcher-skipped paths
- [RLS once-per-query rewrite](rls-hoist.md) -- my_* helpers replace can_* in policy text (2026-10-11)

## Policy roles (2026-10-12, 20261012010000)
- Public pages/API routes all use the service client; only `tenant_branding` (DEFINER) is granted to anon; auth.users triggers + password hook are DEFINER. So moving {public}-role policies to authenticated breaks no signed-out path.
