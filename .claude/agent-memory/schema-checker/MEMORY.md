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
