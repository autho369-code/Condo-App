## docs/brain/Decisions.md

Reviewer: Codebase Details Goldfish (REVIEW mode), 2026-10-31. Repository read-only; the latest migration defining each function/policy was treated as live.

- **[Major] Board decisions on "other requests" have no path in code.**
  Decision: "a bill, purchase order or other request needing the board ... staff record the decision".
  Evidence: staff can create general approval requests (`app/(app)/associations/[id]/approvals/new/page.tsx:129-132`, `request_type: 'expense'`). `record_approval_decision` is called only from `lib/rpcs/bills.ts:122` (bill pages) and `lib/rpcs/purchase-orders.ts:118` (PO pages). `app/(app)/associations/[id]/approvals/page.tsx` lists requests with a status badge only and has no decision form. Vote tallying no longer approves anything (`supabase/migrations/20261014150000_payables_fixes.sql:115-137`), and `trg_approval_requests_approve_guard` (same file, 27-48) blocks every other way to approve.
  Why it diverges: only bills and POs were built. A general approval request can never be approved or rejected, so it stays `pending` forever.

- **[Nit] "Interest settings and the daily interest job were removed": the money function is still live and was changed after the removal.**
  Evidence: `public.assess_association_interest(date)` still exists and service_role can still run it (`20260929171000_association_interest_engine.sql:85-86`). It was patched again on 2026-10-15 (`20261015040000_collections_fixes.sql:202-210`), after the 2026-10-14 decision. The interest columns are still live (`supabase/schema-columns.json`: associations.annual_interest_rate, interest_grace_days, interest_post_day_of_month, interest_grace_balance, interest_income_gl_account_id). The allocation order UI still offers an "Interest" class (`app/(app)/associations/[id]/payments/page.tsx:97`).
  Why it diverges: the cron and settings UI are gone, but the function that posts interest charges is still callable. The drop is parked in `docs/TODO.md:129-130`, and Decisions.md doesn't mention that leftover.

- **[Nit] An ambiguous SMS START is not handled the way the decision says.**
  Decision: when the reply can't be placed, "not filed with any company (each gets a log entry without the message)".
  Evidence: in `app/api/sms/twilio/inbound/route.ts:58-71`, an ambiguous START returns `409 'Ambiguous SMS consent owner'` and never calls `logUnmatchedReply`. Only the reply branch logs (route.ts:36). START also counts archived conversations (route.ts:66), but replies leave them out (`lib/sms/inbound-reply.ts:63`). STOP opts out only `entity_type in ('owner','vendor')` (route.ts:52), not every consent record for the number.
  Why it diverges: the decision covers "a text reply or START" together. START with several companies leaves no log entry, and START and replies pick the company with different rules.

- **[Nit] The confirm rule for one-click access actions is not applied everywhere.**
  Decision: access-changing one-click actions "use `PendingSubmit` with `confirm`" (it names "send reset link").
  Evidence: these platform-operator buttons are plain `<Button type="submit">` with no confirm: "Send Reset" (`app/platform-operator/companies/[id]/page.tsx:411`), "Reactivate" company (213), "New Link" on invitations (534) and "Unlock" (421).
  Why it diverges: the workspace settings page follows the rule (`app/(app)/settings/page.tsx:376-385`), but the operator company page does not.

- **[Nit] The company-name fallback is not "Your management company" everywhere.**
  Decision: "Neutral company-name fallback stays 'Your management company'".
  Evidence: `'Management company'` is used as the fallback in `app/(app)/bills/page.tsx:228`, `charges/page.tsx:302`, `owners/page.tsx:209`, `violations/page.tsx:240`, `work-orders/page.tsx:223`, `architectural-reviews/page.tsx:141` and `service-requests/page.tsx:174`.
  Why it diverges: there are two fallback strings. The decided wording is not the only one used.

- **[Nit] The bank-reconciliation undo guard is stricter than "a month it covers is closed".**
  Evidence: `20261015020000_banking_followups.sql:~119-131` refuses the undo when any closed month ends after the previous reconciliation's statement date. That includes closed months after this reconciliation's own statement date, which it does not cover.
  Why it diverges: the code rule is "no closed month after the previous reconciliation", not "no closed month inside this one". It errs on the safe side, but the documented rule is different.

- **[Nit] The email hold over-matches addresses, and platform/staff mail is not exempt.**
  Decision (2026-10-26): "Staff and platform mail unaffected". The hold covers the addresses of people in the held association.
  Evidence: `email_is_held` matches with `position(addr in <field>)` (`20261027010000_hold_resident_email_one_association.sql:84,93,101,106`). That is a substring test, so a recipient such as `jo@x.com` is held when an owner's email is `bjo@x.com`. `claim_email_queue_snapshot` (same file, 135-137) applies the hold to every row, including `platform_mail` rows.
  Why it diverges: staff or platform mail to an address that happens to be a substring of a held resident's address is held. The decision says those are unaffected. The migration comment accepts over-holding, but Decisions.md does not.

- **[Nit] Company state rules apply only when copied, not continuously.**
  Decision: "`company_state_rules` ... overrides the built-in `collection_jurisdiction_profiles`".
  Evidence: the override exists only inside `apply_delinquency_jurisdiction` (`20261010010000_company_state_rules.sql:~113-175`), which copies values into `delinquency_policies`. Nothing re-applies a rule when a company admin edits it. The earlier backfill (`20260929140000_state_aware_delinquency_gates.sql:405-418`) used built-in profiles only.
  Why it diverges: if an admin edits a state rule, associations that already had their state applied keep the old values until someone re-applies the state.

- **Unverified: "The only live edge function is data-export-builder."** `supabase/functions/` holds only the seven retired stubs (each returns 410). There is no source for `data-export-builder` in the repo, so what is deployed can't be checked from code.

- **Unverified (not checked in depth for lack of time; no code finding):** payment-plan window and bounce rules (20261013150000-20261015050000); the trial-balance tie-out and opening-balance rules; token-page and `/accept-invitation` host handling; the Zelle remembered-sender downgrade on a new owner; per-record owner writes across every portal action; the "server actions never fall back to a bound id" rule across all actions.
