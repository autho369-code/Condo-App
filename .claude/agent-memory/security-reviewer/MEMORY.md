# security-reviewer memory

## Confirmed rules (Mirsad)
- The board portal is read-only. Owners and vendors change only what their portal explicitly offers, on their own records (vendor work-order status, owner profile/payments/reservations/insurance). Nobody outside staff sees manager notes.

## False alarms to skip
- Webhooks and cron routes have no signed-in user: a verified signature or `requireCronSecret` is their auth. (Codex on PR #229.)

## Recurring mistakes
- `communications_log` RLS only checks `portfolio_id`: writes into another association pass RLS unless `managesAssociation` is checked (see `lib/rpcs/notifications.ts`).
- Service-client undo/cleanup must be pinned to the exact row id plus `portfolio_id`.

## Helpers / files worth checking
- Tenant headers (`x-tenant-host`, `x-portfolio-id`, ...) are trusted only because `middleware.ts` `INTERNAL_TENANT_HEADERS` strips client copies first; any new internal header must be added there.
- `portfolios` column guards are triggers: `portfolios_guard_platform_columns` (tier, slug, custom_domain...; passes when `auth.uid() is null` or platform admin) and `portfolios_guard_domain_verification` (custom_domain_verified_at; blocks `current_user in ('authenticated','anon')`, so only service role/SQL editor write it). Prefer the `current_user` check for new guards: `auth.uid() is null` also passes anon. New platform-owned columns must join one.
- Auth/Supabase redirect links (reset, invite callback) must stay on `tenantWorkspaceUrl`/`resolvedTenantUrl`; `companyUrl` (verified custom domain) is for plain links only.

- `portfolios` SELECT: staff/company admin only for `current_portfolio_id()` (`portfolios_staff_read`), operators all (`portfolios_platform_read`); owners/board/vendors none. A non-`!inner` `portfolios(company_name)` embed hidden by RLS returns null, not an error. `associations.portfolio_id` is the only FK to portfolios (no ambiguity; precedent `app/(app)/payments/[id]/receipt/page.tsx:24`).
- `me.portfolio` is the caller's profile company, not the record's: operators pass `requireStaff` and see every company, so branding/scoping by `me.portfolio` can mismatch the association (e.g. `lib/rpcs/documents.ts:92`). Prefer the record's own `portfolio_id`.

## Missed checks (caught later)
- A public "prove you are us" endpoint (e.g. `/api/tenant/domain-check`) must bind its HMAC to a fresh verifier-chosen challenge; a deterministic proof can be recorded and replayed after a domain takeover. I suggested only HMAC-keying it; Codex caught the replay (PR #232).
- A fresh challenge stops replay but not a live relay: a domain holder can forward each check to us with the right Host and pass our answer back. Domain ownership checks must also confirm public DNS points at our hosting (`lookupDomain` + `pointsAtVercel`). Codex, PR #232.
- A "verified at" timestamp written by a cron must expire (trust only recent checks), or a stopped job/archived company leaves it trusted forever. Codex, PR #232.
- `next.config.mjs` `redirects()` run before `middleware.ts` (no auth/tenant checks on the hop) and pass the query string through; safe only with a fixed internal destination whose own route is guarded. A `:param` in `destination` host/path would be an open-redirect risk.
- SQL email renderers (`render_invitation_email`, dues reminders): `html_escape` covers text nodes only; values in `href="..."` (URLs, `user_invitations.token`) need escaping/format checks too. `token` is plain text with no CHECK, and `user_invitations_staff_insert` lets any company staff insert their own token (20260930203000), so it is attacker input. Found in 20261007030000.
- `portfolios.slug` is CHECK-constrained (`portfolios_slug_format`, 2-32 chars) + `reserved_portfolio_slug`; a looser SQL slug regex is not a host-injection risk, just inconsistent with `lib/tenant/host.ts` PORTFOLIO_SLUG.
- `create or replace function` keeps the existing ACL; service-only list lives in 20260726050000 (`render_invitation_email`, `queue_*`).
