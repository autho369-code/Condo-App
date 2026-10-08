# schema-checker memory

## Recurring mistakes
- Tables/columns that never existed: `bills`, `budgets`, `bank_accounts.balance`, `work_orders.owner_id`.
- Embeds need a real foreign key: `created_by(full_name)` on `service_requests` fails (not an FK to a public table).

## How coverage works
- `npm run check:columns` parses selects with the TypeScript parser, resolves constants (incl. imports) and same-file parameters.
- Unreadable selects go in `supabase/unchecked-selects.json` with a reason; each needs its own covering test.

## Hand checks
- `.update()` payloads often use conditional spreads `...(cond ? { col: v } : {})` (e.g. lib/rpcs/portfolio.ts updatePortfolioPolicy): check the keys inside spreads too.
- For CHECK-constraint migrations, confirm the column's nullability in the baseline (`20260715040000_production_schema_baseline.sql`); a CHECK on a nullable column lets NULL through.

## RLS read-back (`.update(...).eq(...).select('id')` "not saved" checks)
- Adding `.select()` adds no new RLS constraint when the update already has a column filter (`.eq('id')`): Postgres applies SELECT USING to the existing row (filtered) and the new row (error) once a WHERE clause reads the table. An empty result means the row was not updated; that is a real failure, not a false alarm. Still compare SELECT and UPDATE policies, because a narrower SELECT already blocked writes silently. Example: meeting_action_items select needs can_access_confidential_meeting_mvp, update needs can_edit_association_mvp (2026-10-07 silent-save sweep).
- Find policies by grepping the baseline (`"public"."<t>"` quoted form) and later migrations (`public.<t>`, `alter policy`, and DO-loop `format(... %I)` arrays such as operator_writes_need_admin and staff_association_in_company, which are restrictive write-only policies).

## Nullability and sender checks
- Nullability: read the `CREATE TABLE` block in the baseline (no `NOT NULL` = nullable), then grep migrations for `alter column <col>` / `set not null`; `lib/types/database.ts` Insert types (`col?: T | null`) confirm it fast.
- `email_queue.from_name = null` is the white-label path: `app/api/email/process-queue/route.ts` fills the company name/sender when `portfolio_id` is set and `from_name` is blank (e.g. app/api/stripe/webhook/route.ts:81, 2026-10-07).
- When a `select('*')` is narrowed to explicit columns, compare against the consumer's TS interface and every `r.<field>` it reads (e.g. house_rules in app/(public)/report-violation/page.tsx vs report-violation-form.tsx `HouseRule`).

## Public token pages
- Token lookups: `signature_signers.token_hash` and `document_request_links.token_hash` are UNIQUE (so `.maybeSingle()` is safe); hex digest from `hashSigningToken` is lowercase, matching the RPCs' `lower(p_token_hash)`. `vendor_request_session` jsonb includes `portfolio_id` (20260929220000). Company lookup helpers live in `lib/tenant/token-company.ts` (2026-10-08, all clean).
