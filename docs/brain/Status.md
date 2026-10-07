# Status

Back to [[Home]]. Updated 2026-10-07 (after #238).

## Where things stand
- Design-system migration done (all 219 pages); board + company-admin use the
  shared Sidebar + light body.
- `docs/TODO.md` build queue done except resale/estoppel (declined — see
  [[Decisions]]). Remaining open boxes need Mirsad: test login + Supabase
  network access for cloud sessions, provider accounts (Twilio, Lob, Stripe
  Connect keys, Plaid), decisions (tenant portal, platform remittance, legal,
  pilot).

## Open PR
- Invitation token hardening (this branch) — migration
  `20261007040000_invitation_token_format_and_html_escape_quote.sql`.
  **After Mirsad merges: apply it with `apply_migration` on
  termxngysvotnfbzbgrv** and verify the constraint + trigger exist.
- Same PR (#239), second part: company name can't be blank and brand color
  must be #RRGGBB — migration
  `20261007050000_portfolio_name_and_brand_color_checks.sql` (apply after
  merge too) plus checks in the Settings, Branding and Company Admin actions;
  Branding page validates logo/website/support email, never trusts a
  client-sent company id, and errors on a 0-row save.
- Same PR (#239), third part: every save on `/settings` (policy, invite,
  remove member, change role) redirects to `?saved=<kind>` with a success
  banner, so an old error banner never sticks; an empty role choice errors.
- #238 merged (b7ec661); its migration `20261007030000` is applied and verified
  (new definition live, execute service-only).

## Next gaps (pick up here, top first)
1. `/settings` team table (`app/(app)/settings/page.tsx`, role select and
   Apply / Send reset link / Remove buttons): hand-built 32px controls — use
   the shared `Select`/`Button` so they meet the 40px touch target at 375px.
2. Look for the next white-label / sign-in / data-exposure gap with the
   overseer agent (a zero-width-space-only company name still passes the DB
   check — only reachable by direct SQL).
