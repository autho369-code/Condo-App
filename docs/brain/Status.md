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
- #238 merged (b7ec661); its migration `20261007030000` is applied and verified
  (new definition live, execute service-only).

## Next gaps (pick up here, top first)
1. In PR: invitation token hardening — tokens must be 64 lowercase hex; rows
   written through the API always get a server-generated token and can't
   change it (trigger `user_invitations_server_token`); `html_escape` also
   escapes `'`.
2. Decide wording: on a company workspace with no readable name, the app
   manifest / link-preview image now show "Your management company"
   (`NEUTRAL_COMPANY_NAME`). Only reachable with bad data; consider a
   `btrim(company_name) <> ''` check on `portfolios`.
3. Then: look for the next white-label / sign-in / data-exposure gap with the
   overseer agent.
