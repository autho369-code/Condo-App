# Shipped

Back to [[Home]]. Newest first. (The session-start hook also prints the last
15 merges on main live from git.)

## 2026-10-07
- #238 (open): second brain vault + hooks; Settings staff invitation email on
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
