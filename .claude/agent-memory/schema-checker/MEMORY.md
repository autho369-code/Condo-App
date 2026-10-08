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

## Portfolios embeds
- `portfolios` has no column-level grants (baseline GRANT ALL to authenticated); reads go through `portfolios_staff_read` (is_any_staff/is_company_admin AND id = current_portfolio_id()) or `portfolios_platform_read`. `portfolios_admin_own` is disabled (USING false). Embed via `associations.portfolio_id` FK is fine for staff (2026-10-08, profile page slug/custom_domain embed clean).

## Optimistic-lock filters (compare-and-set updates)
- `.eq('<timestamptz col>', valueReadBack)` round-trips: PostgREST returns full microsecond ISO with `+00:00`, and postgrest-js uses `URL.searchParams.append`, so `+` is encoded as %2B. Null previous values need `.is(col, null)`. A nullable CHECK status needs `.or('status.is.null,status.neq.X')`. Check for BEFORE UPDATE triggers that rewrite the guarded column (maintenance_tasks has only `move_private_fields` on notes). Example: app/(app)/maintenance/page.tsx completeTask (2026-10-08, clean).

## Enum/status quick refs
- `occupancies.status` is enum `occupancy_status` ('current','future',...); `tenants.status` CHECK ('active','ended'); `tenants.archived_at` exists. `occupancies.association_id` -> associations FK (embed `associations(portfolio_id)` ok). `document_templates.portfolio_id` NOT NULL. (2026-10-08, occupancy-actions recipient-company change clean.)

## Cross-company FK checks
- `associations.property_group_id` -> property_groups FK accepts any company's group; app checks `property_groups.select('id').eq('id').eq('portfolio_id')` (read policy `property_groups_staff_read` = can_access_portfolio) and migration 20261008030000 adds trigger `associations_property_group_same_company` (errcode 23503). No new columns. (2026-10-08, associations/new + lib/rpcs/entities.ts createBuilding clean.)

## Idempotency / RPC return quick refs
- `email_queue.idempotency_key` has a full (non-partial) unique index `email_queue_idempotency_key_unique` (20260730003000), so `.upsert(..., { onConflict: 'idempotency_key' })` works. `form_submissions` cols: token, kind, result_id (uuid), created_by, created_at.
- RPC returns: `post_ad_hoc_charge` returns a `charges` row (use `.id`); `charge_back_work_order` returns a bare uuid. `calendar_event_reminders` links via `calendar_event_id` (not event_id), times in `remind_at`. (2026-10-08 diff vs dbf551c4, all clean.)

## Type mismatches the column check cannot see
- `gl_accounts.number` is INTEGER (1000-9999 CHECK): PostgREST returns a JS number, so a Map keyed by the CSV string never matches, and a non-digit value (e.g. "6371.01") in `.in('number', …)` fails the whole query with 22P02. Example: app/(app)/owners/import/appfolio/vendor-actions.ts:106-113,141 (2026-10-08).
- AppFolio import quick refs (2026-10-08, clean): enums work_order_status/priority/category, gl_account_type, gl_fund_account, vendor_payment_type (check/echeck/ach/online), recurring_frequency; `import_opening_balance(p_unit_id,p_charge_category_id,p_amount,p_description,p_as_of)` writes imported_balances.memo = p_description; `rpt_prm` returns aid/df/dt/cmp.
