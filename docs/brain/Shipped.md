# Shipped

Back to [[Home]]. Newest first. (The session-start hook also prints the last
15 merges on main live from git.)

## 2026-10-08
- #258 (merged 4f5f0d4; no migration): AppFolio open balances — a changed
  amount is reported, not reposted; items gone from a complete file are
  reported; all result messages downloadable.
- #257 (merged 6d10b58; migration 20261008070000 applied, 20261008080000
  applied except claim_import_lock, which waits on Mirsad because its body
  has a DELETE): AppFolio importer — units, homeowners, chart of accounts,
  vendors, open balances, work orders, trial balance tie-out — checked on
  the real exports.
- #256 (merged 7b37b23; migration 20261008060000 applied): the SETOF uuid
  identity helpers (board/resident/tenant/vendor) run as PL/pgSQL; board
  30-table timing 5.1 s -> 1.8 s, owner 2.6 s -> 0.97 s.
- #255 (merged 9ced138; migration 20261008050000 applied): RLS helpers run
  as PL/pgSQL (nested SQL helpers re-planned per row, ~1 ms each); pages
  stop hitting the 8 s statement timeout; manager 2.9 s -> 0.7 s, board
  14.9 s -> 5.1 s for 30 tables.
- #254 (merged 5446724; migration 20261008040000 applied): speed (pdx1
  region next to the DB, me() once per request, loading screens), one-time
  tokens on ad-hoc charges, chargebacks and bulk vendor emails, records use
  their association's/vendor's company (calendar events, statements, vendor
  emails, owner notices), calendar vendor trigger, reset links to the
  company workspace, committee members must be owners, calendar reminder
  moves fail loudly, inspection work order links once.
- #253 (merged dbf551c; no migration): a company's address never serves the
  platform's marketing pages or site files (`/demo`, `/legal` redirect to
  login; disallow-all robots; sitemap, llms.txt, IndexNow key,
  report-card.html and marketing APIs 404); client-facing fallbacks use
  `NEUTRAL_COMPANY_NAME`; MFA issuer, help email, send-email From are the
  company's.
- #252 (merged 7cbc3dd; migration 20261008030000 applied): a property group
  must be the association's company's (app checks before writes; DB triggers
  on associations and on group moves, serialized with a row lock; group
  directory report counts only the company's associations).
- #251 (merged 331d709; no migration): letters, owner/resident resets and
  resident invites use the recipient's company (name, reply-to, sign-in
  address); residents, pets and vehicles take the owner's company; addPet
  checks the unit and resident (closed a cross-company pet plant).
- #250 (merged c959991; no migration): `/accept-invitation` refuses another
  company's invitation on a company's address (platform address allowed),
  names the inviting company, shows expired / other-account states (sign-in
  keeps the token), rate limits per token, plain errors.
- #249 (merged 052b402; migration 20261008020000 applied): maintenance
  "complete" runs in one transaction (`complete_maintenance_task`, SECURITY
  INVOKER) with a compare-and-set on what the page showed, so it completes
  once and never half; removed two uncalled calendar server actions.
- #248 (merged be2f13b; no migration): association profile shows the
  public violation-report link on the company's own address with a shared
  `CopyButton`; warns when the company has no workspace address.
- #247 (merged 9d7f1e8; no migration): `/sign/[token]` and
  `/vendor-upload/[token]` treat another company's token as invalid on a
  company's address and move to the company's address from the platform
  address; neutral public metadata; company pages no longer inherit the root
  author/creator/description/keywords.
- #246 (merged fbad2ae; no migration): `/report-violation`, its submit
  action and the AI photo route only list and accept the host company's
  associations (and spend only its AI key); Stripe receipts send in the
  company's name; public layout falls back to a neutral name.

## 2026-10-07
- #245 (merged e25b1d1; migration 20261007100000 applied): delinquency sync
  scoped to the caller's associations; 30 saves that RLS could silently skip
  now fail loudly; vendor ACH order; site manager scoped; error banners.
- #244 (merged f0da498; migration 20261007090000 applied): 16 finance and
  delinquency RPCs association-scoped for managers limited to some
  associations (save/archive recurring bill and delinquency RPCs were real
  gaps; the rest add an earlier refusal over existing row triggers).
- #243 (merged df91ada; migrations 20261007070000 + 20261007080000 applied):
  AI follow-up (snapshot guard admits company admins, on/off from a usable
  key); ~45 destructive buttons confirm first; company names must contain a
  visible character (app + DB check kept in sync by a test); Plaid Link no
  platform-name fallback; security sweep (owner attachment delete scoped to
  the owner's storage path, meeting-document delete, ~15 silent RLS no-ops
  fail loudly, safe `back=`, bill RPCs association-scoped).
- #242 (merged 32bd9b5): AI Assistant setup reachable for company admins;
  managers see an "ask your company admin" note instead of a bounce; AI
  on/off status. Merged before the Codex fixes — those ride the follow-up.
- #239 (merged 0e8f398; migrations applied): invitation token hardening (token format CHECK,
  server-generated tokens for API writes, `html_escape` escapes `'`); company
  name can't be blank, brand color #RRGGBB (DB checks + all three settings
  actions); Branding page validates URLs/email and fails loudly; support email
  validated in the Branding, Company Admin and Platform Operator actions.
- #241 (merged 11ad690): `/settings` team table and MFA rows meet the 40px touch
  target; every submit uses `PendingSubmit`, with confirms before Remove,
  Send reset link and Apply role.
- #240 (merged 79e91ab; migration 20261007060000 applied): `/settings` saves
  show a success banner and never keep a stale error; NBSP-safe company-name
  check.
- #238 (merged b7ec661; migration 20261007030000 applied): second brain vault + hooks; Settings staff invitation email on
  the company workspace, escaped, Runbook link; company pages never fall back
  to the platform name (`NEUTRAL_COMPANY_NAME`).
- #237 / #235: first memory file. #236: `/platform/*` → `/platform-operator`
  permanent redirects in `next.config.mjs`.
- #234: staff guides generated per company at `/manuals/*.pdf`
  (`lib/guides/content.ts`, `app/manuals/[file]/route.ts`).
- #233: generated PDF letters headed by the company.
- #232: company links use the verified custom domain (`companyUrl` in
  `lib/tenant/host.ts`; hourly `/api/tenant/verify-domains`).
- #229–#231: review agents with self-learning memory; `/portier-review`;
  `scripts/review-scope.mjs`.
