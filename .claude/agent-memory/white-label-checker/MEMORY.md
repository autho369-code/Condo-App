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
- Association profile violation-report link (Oct 2026, app/(app)/associations/[id]/profile ~:291): companyUrl(assoc.portfolio) with embed of COMPANY_ADDRESS_COLUMNS: clean. Staff read own portfolio via portfolios_staff_read, operators via portfolios_platform_all, so the embed is present. Off-production companyUrl returns the preview/local origin, where the public page shows its "use your company's link" notice (expected).
- `sameHostCompanyUrl` (lib/tenant/request-url.ts) for Stripe-style return URLs; Plaid + auth links stay on tenantWorkspaceUrl by design.
- PDF generators audited Oct 2026 (generated-pdf, check-pdf, monthly-package, board-package, reports/output): all head with company/association; only footers credit the platform. Quick check: grep -rln "jspdf|jsPDF" app lib, then grep each for Portier.
- Company name for an association-scoped document: prefer `associations.portfolios(company_name)` over `me.portfolio` (operators pass requireStaff with another/no portfolio). Staff RLS `portfolios_staff_read` allows the embed for their own company.

- Staff guides (Oct 2026): generated per company by app/manuals/[file]/route.ts from lib/guides/content.ts ({company}/{address} placeholders); tests/guides asserts no "portier" in content. Sign-in address in guides = slug subdomain by Mirsad's rule (not a leak). Links to guides: onboard page (relative), company-admin/managers invite (companyUrl), operator welcome mail (tenantWorkspaceUrl). Settings "Invite a staff member" (invite_staff RPC) does NOT link the runbook.
- `tenantFromHeaders`/`mapBranding` (lib/tenant/resolve.ts) fall back to `NEUTRAL_COMPANY_NAME` ('Your management company'), not 'Portier369' (Oct 2026); middleware no longer fakes x-portfolio-name. Consumers that `.trim()` then `|| 'Portier369'` (app/manifest.ts:9-12) still leak on a whitespace-only name; the fallback does not trim. Middleware strips incoming x-portfolio-* (INTERNAL_TENANT_HEADERS), so header checks are trustworthy.
- Operator -> company-admin mail (platform-operator/companies/actions.ts, FROM_NAME 'Portier369', "The Portier369 team") is true platform mail: allowed.

- SQL-rendered mail: verified custom domain = `custom_domain is not null and custom_domain_verified_at > now() - interval '3 hours'` (pattern in 20261007020000); slug host via `'https://'||slug||'.portier369.com'` (slug CHECK + reserved list make it safe). Non-auth links in SQL mail (e.g. runbook in render_invitation_email, 20261007030000) need the custom-domain case; accept/invite links stay on slug.
- queue_invitation_email (20260731010000): from 'noreply@portier369.com' + from_name company_name is OK; worker (app/api/email/process-queue/route.ts) swaps a platform-domain from_address to the company's verified sender domain. But a non-platform `email_settings.from_address` makes the worker fall back to the platform address, skipping the verified domain.

## False alarms
- Flagged `add_record_note` from_name 'Portier369' from its original migration, but 20261005094500_client_mail_sender_name_unset.sql had already patched it. Before flagging a SQL function, check later migrations that patch it in place via pg_get_functiondef/replace (grep the function name across all migrations), or the live definition.

## Company-name blank guard (Oct 2026, 20261007050000)
- Final form: CHECK `company_name ~ '[^[:space:]\u00a0]'` (literal NBSP; verify bytes with `od -c`, look for 302 240). Postgres `btrim(x)` strips only spaces, so never accept a btrim-based blank check. All app writers now JS-`.trim()` + require the name (branding page, lib/rpcs/portfolio.ts, company-admin settings, operator create/update). Residual, accepted: zero-width space (U+200B) passes both JS trim and DB; exotic Unicode spaces (U+2003, U+3000) depend on DB ctype but app trim catches them.
- Writers of company_name to check when it changes: settings/branding/page.tsx, lib/rpcs/portfolio.ts, company-admin/settings (RPC update_company_profile), platform-operator/companies/actions.ts (createCompanyWithAdmin -> provision_portfolio, updateCompanyDetails).
- Branding page copy must not contrast with the platform ("not ours" removed Oct 2026); avatar fallback is '?' not 'P'.
- Layout `?? 'Portier369'` chains (app/(app)/layout.tsx:26, portal/vendor/resident/company-admin layouts, components/nav/sidebar.tsx:130) only fire when me.portfolio is missing; `??` does not catch '' or whitespace.

## Next 15 metadata merge (node_modules/next/dist/lib/metadata/resolve-metadata.js mergeMetadata)
- Child openGraph/twitter/appleWebApp/robots replace the parent's wholesale; a child openGraph without `images` drops the root app/opengraph-image (static files attach only to their own segment). Twitter fills title/description/images from openGraph, then from top-level title/description.
- Root app/layout.tsx `authors`, `creator` ('Portier369'), `keywords`, `description` (platform pitch), `verification` are NOT set by brandedMetadata, so they leak into every tenant page (and twitter/og description falls back to the root description). Check any branded metadata helper sets authors/creator/keywords/description.
- accept-invitation page + acceptInvitation action (Oct 2026): clean. Company name via user_invitations->portfolios(company_name) + hasVisibleText/NEUTRAL_COMPANY_NAME; tokenMatchesAddress gate; links relative (/login). Residual: (auth)/layout.tsx `tenant?.companyName ?? 'Portier369'` brand panel shows on the platform host, where this page is still allowed.

## Company-address surface (wip-next 3355c8f0, Oct 2026)
- Fixed in 9e37c3d2 (verified): matcher now includes .html; /report-card.html is PLATFORM_ONLY (404 on company hosts) + PUBLIC_ASSETS on platform. Any new public/*.html must be added to both lists. Matcher still skips svg/png/jpg/gif/webp in public/.
- Fixed in 9e37c3d2: error page, help page (support_email or no button), palette aria-label, MFA issuer/friendlyName (company; 'Portier369' only for operators), send-email From fallback, invite Shell (brand -> tenant -> 'Portier369').
- Unknown hosts (x-tenant-state=not-found) only reach /login?error=workspace_not_found; every other path redirects there, so page-level `tenant ?? 'Portier369'` fallbacks (e.g. invite Shell) cannot fire on an unknown host. Only (auth)/layout's brand panel on that one login page matters.

## submit_owner_message lineage (checked Oct 2026)
- 20260730002000 (from 'hello@portier369.com', 'Portier369') -> 20261004180000 redefines with same -> 20261005094500 patches live body to from_name null -> 20261009060000 (owner-per-record 4-arg overload) copies hello@ + null. hello@ on a platform-domain address is the intended input: worker moves it to the company's verified sender domain (usesPlatformSender) and fills company_name. Not a leak; keep it. Watch: a future copy from an OLD migration file would bring back 'Portier369'.
- Owner multi-record branch (RecordSwitcher, OwnerSelect, lib/portal/owner-records.ts): labels = association names, hrefs relative; portal errors point to "your management company". Clean.
- Receivables import credits (Oct 2026, previous-system/receivables-*, 20261009080000): clean. Stored memo prefix is 'Prior system:' (MEMO_PREFIX); 'AppFolio:' is LEGACY_MEMO_PREFIX used only to match/rename old rows, never written. Keep prefixes neutral anyway (staff exports, audit log). Alert supports tone info (components/ui/shell.tsx:244).
- GL tie-out prior-years subtitle (Oct 2026, previous-system/gl-section.tsx ~:453-459): clean of platform/competitor names; account names come from the company's own chart. Dates there (incomeFrom) render raw ISO across the section (:392, :409, :456): consistent, flag only if a change formats some but not all.
- Opening balances from trial balance (Oct 2026, previous-system/gl-actions.ts postOpeningBalancesFromTrialBalance + gl-section "Opening balances" panel): clean of platform/competitor names. Stored values neutral: batch "Opening balances <association name> <date>", entry "OPENING-<date>", memo "Opening balance from previous system trial balance". Wording to watch: "open balances" (receivables import) vs "opening balances" sit side by side; check that the UI's line count matches what the server posts (the prior-years line).

## message_notify (20261014233000, Oct 2026)
- Conversation links in staff/owner mail (/inbox/<id>, /portal|resident/messages/<id>) built slug-only ('https://'||slug||'.portier369.com'), commented as "sign-in address". These are ordinary links: need the verified-custom-domain case first (fixed in 20261014233000). Watch for "sign-in address" comments used to justify slug links that aren't auth redirects.

## Email-queue guard messages (20261014220000, Oct 2026)
- Trigger/RPC raise text reaches staff raw via `?error=` (notifications.ts failTo wraps `${queueError.message}.`; a message ending in "." gives ".."). Watch for "the platform" in guard text (from-address message) and trailing periods in raise text.


## Past audits (detail)
- [audits-oct-2026.md](audits-oct-2026.md) — audited pages, company-address surface, root 404, unsubscribe, credit memos, work orders, PO, scheduled reports: what was clean and wording watches.
## Email unsubscribe (claude/email-unsubscribe, Oct 2026, 20261015010000)
- Footer/List-Unsubscribe link = companyUrl(portfolio with COMPANY_ADDRESS_COLUMNS, '/unsubscribe/<token>'), stored once in email_unsubscribe_links.page_url; footer names portfolios.company_name; public page/actions use email_unsubscribe_session company_name + companyAddressRedirect. Clean.
- Watch: SQL "is this platform mail?" checks must match JS isPlatformSenderName (case-insensitive startsWith 'Portier369'); email_prepare_batch used exact `not in ('Portier369','Portier369 Platform')`, so 'Portier369 Billing' optional mail would get a company footer. (Fixed: like 'portier369%' plus sent_by null or a platform operator.)

## Credit memos (verified Oct 2026, late-fee removal branch 20261015040000)
- post_homeowner_credit(p_memo) writes payments.notes, which trigger payments_move_private_fields moves to staff-only payment_private (20261004200000). Owners see method 'credit' + payments.reference (default 'Credit'; remove_late_fee overwrites it to 'Late fee removed'), never the memo. Callers that set reference: check it is neutral, owner-safe text. So 'Late fee removed: <reason>' is staff-only; earlier note claiming memos reach owners was wrong.
- Owner-facing side effect to check for credit-based fee removals: portal/ledger shows the fee as Paid (applied_amount, payment_status) plus a credit row referenced 'Late fee removed'; v_charge_balances has no "waived" state (recorded as a Next gap, Oct 2026).
- remove_late_fee raise text (20261015050000, Oct 2026): clean, staff-only. lib/rpcs/credits.ts removeLateFee passes error.message raw (no period added), while its own fail() strings end in "."; DB raise text there has no period: punctuation nit only.

## Codex #379/#380/#381 follow-ups (Oct 2026, 20261015110000/120000)
- Amenity guard raises ("outside the amenity's hours", "must end by the next day"), signature "archived association" raise, portal/amenities hints and inspections inspection_search RPC: clean. Anchor-patch `raise exception '<fn>: anchor not found'` text runs at migration time only, never user-facing: skip.
- 'removed' charge status (20261015130000, Oct 2026): v_charge_balances payment_status 'removed' renders via Badge (status.replace('_',' ')) on portal/ledger + units/[id]; toneForStatus maps it inactive. Marker-trigger raise 'Late fees are removed from the unit page' (staff typing reference 'Late fee removed'): clean, no period.
- Removal-credit guards (Oct 2026, 20261015150000..200000 + payments/[id] "Late fee removed" Alert): clean. Only reallocate_payment's raise reaches the app (reallocatePayment fail(error.message), raw, no period); the payments/payment_applications trigger raises fire only on direct table writes. Watch: one guard per concept should share wording (insert said "applied by hand", delete "applied or unapplied by hand").

## Work-order fixes (claude/work-orders-fixes, Oct 2026, 20261015170000)
- Vendor assignment mail (lib/notifications/vendor-assignment.ts): clean. fromName = company_name (fallback 'Your management team', unreachable given the CHECK), replyTo support_email, from_address unset -> EMAIL_FROM (worker moves it to the verified sender domain), links companyUrl with custom_domain cols selected, association_id set. Same pattern as status-change.ts; use it as the reference for new company mail helpers.
- Status-change mail now reroutes work orders with service_request_id to the request submitter (same helper, same branding). Bulk-comms {source_ref} merges refs 'WO #n — title'; neutral.

## Setup-records deep check (Oct 2026, 20261016164000/164100)
- New raise text + bulk/parking/board-seat errors: clean. To tell new raises from carried-over copies, grep the string in older migrations (e.g. 'GL account is outside this portfolio', 'Permission denied for unit %' predate it). associationToday's 'association not found' gives "Could not load the association: association not found" (lowercase, no period): recurring nit.

## PO board decision + reserve/asset guards (claude/po-projects-deep-check, Oct 2026, 20261015230000)
- Staff record board decisions on PO/bill pages (board portal read-only); copy clean. fixed_assets/reserve trigger raises reach staff raw via lib/rpcs/fixed-assets.ts fail(error.message): watch DB jargon ("scope") in raise text.

## Admin/operator deep check (9c2800bb, Oct 2026, 20261016130000)
- portfolios_guard_platform_columns raise now says "platform support" (was "Portier369 support" in 20261002224531/20261005010002/20261006070000); company admins now update portfolios directly, so this text can reach them. Clean. Operator audit failure text ("Tell engineering") is operator-only: allowed.
## Cross-cutting checks (detail in [audited-branches](audited-branches.md))
- DB raise text reaches staff raw via fail(error.message)/`?error=`: watch "the platform", "Portier369 support" (use "platform support"), DB jargon, double periods.
- SQL "is this platform mail?" must match isPlatformSenderName: `lower(btrim(from_name)) like 'portier369%'`, not an exact list.
- Slug-only links in SQL mail justified as "sign-in address" are often ordinary links: need the verified-custom-domain case.
- Portal/vendor copy: "your management company", not "management office"/"property manager"/bare "management".
- Reference company-mail helper: lib/notifications/vendor-assignment.ts (also followed cleanly by purchase-order-approved.ts, Oct 2026: no link, no platformMail).
- To tell a carried-over raise/fallback from a new one, grep the exact string across older migrations (e.g. 'Management staff' dates from 20261005094000).
- Per-branch audit history (what was clean, lineages like submit_owner_message): see audited-branches.md.
