# white-label-checker memory

## Confirmed rules (Mirsad)
- Every client has its own domain; build for new clients, not the current sample data.
- Keep "Powered by Portier369" and "Generated securely by Portier369".

## Recurring mistakes
- `from_name: 'Portier369'` on company mail makes the worker send it as platform mail. Company mail uses the company name or `null`.
- SQL helpers once used `coalesce(company, 'Portier369')`; the fallback must be the company only (migration 20261007010000).
- Preview images/links built from `NEXT_PUBLIC_SITE_URL` instead of the tenant or custom-domain host.
- `resolvedTenantUrl` / `tenantWorkspaceUrl` drop the custom domain (slug subdomain only). Fine for auth redirects; wrong for ordinary links when the company has a live custom domain. (Codex on PR #229.)

## Helpers (since custom-domain links branch, Oct 2026)
- `companyUrl(portfolio, path)` (lib/tenant/host.ts) = verified custom domain else slug; needs `COMPANY_ADDRESS_COLUMNS` selected. Staff `me.portfolio` is the full row (has the columns); owner/board/vendor `me.portfolio` is a redacted subset WITHOUT custom_domain, so companyUrl(me.portfolio) from portal code silently falls back to slug.
- `sameHostCompanyUrl` (lib/tenant/request-url.ts) for Stripe-style return URLs; Plaid + auth links stay on tenantWorkspaceUrl by design.
- PDF generators audited Oct 2026 (generated-pdf, check-pdf, monthly-package, board-package, reports/output): all head with company/association; only footers credit the platform. Quick check: grep -rln "jspdf|jsPDF" app lib, then grep each for Portier.
- Company name for an association-scoped document: prefer `associations.portfolios(company_name)` over `me.portfolio` (operators pass requireStaff with another/no portfolio). Staff RLS `portfolios_staff_read` allows the embed for their own company.

- Staff guides (Oct 2026): generated per company by app/manuals/[file]/route.ts from lib/guides/content.ts ({company}/{address} placeholders); tests/guides asserts no "portier" in content. Sign-in address in guides = slug subdomain by Mirsad's rule (not a leak). Links to guides: onboard page (relative), company-admin/managers invite (companyUrl), operator welcome mail (tenantWorkspaceUrl). Settings "Invite a staff member" (invite_staff RPC) does NOT link the runbook.
- `tenantFromHeaders`/`mapBranding` (lib/tenant/resolve.ts) and middleware.ts x-portfolio-name fall back to 'Portier369' when company_name is empty; consumers that print companyName inherit it.
- Operator -> company-admin mail (platform-operator/companies/actions.ts, FROM_NAME 'Portier369', "The Portier369 team") is true platform mail: allowed.

- SQL-rendered mail: verified custom domain = `custom_domain is not null and custom_domain_verified_at > now() - interval '3 hours'` (pattern in 20261007020000); slug host via `'https://'||slug||'.portier369.com'` (slug CHECK + reserved list make it safe). Non-auth links in SQL mail (e.g. runbook in render_invitation_email, 20261007030000) need the custom-domain case; accept/invite links stay on slug.
- queue_invitation_email (20260731010000): from 'noreply@portier369.com' + from_name company_name is OK; worker (app/api/email/process-queue/route.ts) swaps a platform-domain from_address to the company's verified sender domain. But a non-platform `email_settings.from_address` makes the worker fall back to the platform address, skipping the verified domain.

## False alarms
- Flagged `add_record_note` from_name 'Portier369' from its original migration, but 20261005094500_client_mail_sender_name_unset.sql had already patched it. Before flagging a SQL function, check later migrations that patch it in place via pg_get_functiondef/replace (grep the function name across all migrations), or the live definition.
