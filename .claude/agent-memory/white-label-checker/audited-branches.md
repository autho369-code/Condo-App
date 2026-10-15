---
name: audited-branches
description: Per-branch white-label audit notes (Oct 2026): what was checked, clean results, wording nits, SQL lineages
metadata:
  type: project
---

## Company-address surface follow-ups
- Operator-sends-for-another-company fixes (Oct 2026, diff 901ab288..HEAD): owner statements (bulk-operations sendOwnerStatements), vendor bulk comms (maintenance-comms), calendar events, forgot-password platform-host reset link (tenantWorkspaceUrl(slug), auth link: allowed): clean. Pattern: brand from the record's company (association/vendor portfolio_id + service-client read), not me.portfolio.
- AppFolio import (app/(app)/owners/import/appfolio/*, Oct 2026): 14 visible "Portier369" strings (select placeholders, GL tie-out badges/column/alerts, credit alert, vendor notImported msg). Pattern: "X vs Portier369" comparison copy in migration/import tools; neutral = "your ledger"/"this workspace"/"Not in your ledger". Quick check: grep -n Portier on *.tsx and on notImported.push/error: strings in *-actions.ts (comments/identifiers like `portier`, `not_in_portier` are internal).
- Owners-per-association branch (Oct 2026, 20261009010000 + owners/change, owners/new, import, entities.ts link): new errors/raise messages clean (say "association"/"company", no platform/competitor names). owners.auth_user_id stays UNIQUE, so forgot-password's owner lookup (`.order().limit(1)`) still yields one row and the reset mail keeps company name + slug auth link. `AppFolio` hits in owners/import/actions.ts and lib/rpcs/entities.ts are comments/identifiers only.
- Vendors-per-association branch (Oct 2026, 20261009020000 + vendors/new|edit|list, VendorSelect, import vendor-section/actions): clean. Trigger raise messages, failTo errors, import notImported strings and "Management company" labels name no platform/competitor. `appfolio_vendors` lock key, `importAppfolioVendors`, `appfolio-vendor-file` id are internal identifiers.
- Bills CSV upload vendor-in-association (Oct 2026, 20261009030000 + bills/upload help/template): clean. Template now generic ("City Electric", "Maple Court..."). Sample-data names still in placeholders/templates elsewhere (grep -rn "Granville\|ComEd" app): journal-entries/upload:10-11, onboard:153, vendors/forms:64, bills/new:315, credit-cards:100, reports/builder:187; flag only when a change touches them.

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

## Root error/404 pages (CSP branch, Oct 2026)
- app/not-found.tsx renders under the ROOT layout only for unmatched URLs, so with no metadata the tab shows the root 'Portier369 — Property Management Software…' title on company hosts. Next 15.5 reads metadata/generateMetadata from not-found modules (resolve-metadata.js collectMetadata errorConvention): fix = `generateMetadata` -> workspaceMetadata() + title. Check any new root-level page (not-found, error) for this. Relative "/" on a company host is fine: middleware redirects marketing "/" to same-host /login.
- Owner portal fixes (Oct 2026, claude/owner-portal-fixes): pay/insurance/service-request errors, calendar detail, owner assistant: clean of platform name. Wording: AutoPay 'minimum' mode is really a cap (Math.min(set, due) in autopay-run:258), so the label "Minimum amount" contradicted its hint; relabeled "Up to a set amount" in the same PR.
- Owner portal fixes round 2 (179c2990): ledger CSV/PDF now one header per association ("<company> — <association>", company = me.portfolio?.company_name ?? neutral), Unit column, "Late fee removed" label via lib/portal/ledger-rows isLateFeeRemoval, paused-AutoPay chip, failed/canceled pay result, load-error Alerts: clean. Nit: autopay error says "the management office"; portal convention is "your management company".
- Payables follow-ups (Oct 2026, vendor/payments truncated-totals Alert + pay_owner_payable date raises in 20261014160000): clean. Vendor portal says "your management company" (vendor/profile:58, compliance:174); bare "Ask management" is a wording nit, not a leak.
- SMS sender routing (Oct 2026, lib/sms/*, api/sms/twilio/*, lib/time/association-today.ts): clean of platform name. Twilio webhook JSON errors go to Twilio, not users: skip. Nested messages like "Could not load the association: Association not found" read capitalised mid-sentence with no period; wording nit only.

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

## PO board decision + reserve/asset guards (claude/po-projects-deep-check, Oct 2026, 20261015230000)
- Staff record board decisions on PO/bill pages (board portal read-only); copy clean. fixed_assets/reserve trigger raises reach staff raw via lib/rpcs/fixed-assets.ts fail(error.message): watch DB jargon ("scope") in raise text.

## Admin/operator deep check (Oct 2026, 20261016130000)
- Neutral wording for "only the platform can fix this" in client-visible text = "platform support" (portfolios_guard_platform_columns raise, MFA self-reset, Stripe id errors). Older copies said "Portier369 support"; flag new ones. lib/auth/login-errors.ts workspace_not_found still says "Portier369 support" (unknown-host login only, arguably platform context).
- Suspended-company email hold lets platform mail through via `lower(btrim(from_name)) like 'portier369%'`: matches isPlatformSenderName. Operator-only text ("Tell engineering") is allowed.

## Zelle owner payments (claude/zelle-owner-payments, Oct 2026, 20261017010000)
- Portal "Pay by Zelle" panel, association Zelle settings, bank-feed "Receive as owner payment" form and its raises: clean. Recipient and name are association data; placeholders neutral. lib/rpcs/bank-feed.ts fail(result.error.message) passes raises raw; mixed trailing periods are a nit only.
