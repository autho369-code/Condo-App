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
