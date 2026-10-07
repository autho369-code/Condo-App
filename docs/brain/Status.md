# Status

Back to [[Home]]. Updated 2026-10-07.

## Where things stand
- Design-system migration done (all 219 pages); board + company-admin use the
  shared Sidebar + light body.
- `docs/TODO.md` build queue done except resale/estoppel (declined — see
  [[Decisions]]). Remaining open boxes need Mirsad: test login + Supabase
  network access for cloud sessions, provider accounts (Twilio, Lob, Stripe
  Connect keys, Plaid), decisions (tenant portal, platform remittance, legal,
  pilot).

## Open PR
- **#238** — second brain + staff invitation email + no platform-name fallback.
  **After Mirsad merges: apply
  `supabase/migrations/20261007030000_invitation_email_company_workspace.sql`
  with Supabase MCP `apply_migration` on termxngysvotnfbzbgrv.**

## Next gaps (pick up here, top first)
1. Hardening (security reviewer): CHECK constraint on `user_invitations.token`
   format (verify existing rows first); `public.html_escape` should also escape
   `'`.
2. Decide wording: on a company workspace with no readable name, the app
   manifest / link-preview image now show "Your management company"
   (`NEUTRAL_COMPANY_NAME`). Only reachable with bad data; consider a
   `btrim(company_name) <> ''` check on `portfolios`.
3. Then: look for the next white-label / sign-in / data-exposure gap with the
   overseer agent.
