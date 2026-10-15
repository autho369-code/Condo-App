# schema-checker memory

Per-area schema facts (enums, RPC signatures, new columns by migration): [feature-refs.md](feature-refs.md).

## Recurring mistakes
- Tables/columns that never existed: `bills`, `budgets`, `bank_accounts.balance`, `work_orders.owner_id`.
- Embeds need a real foreign key: `created_by(full_name)` on `service_requests` fails (not an FK to a public table).
- Enum literals in payloads are invisible to check:columns (e.g. sms_status has no 'received', lib/sms/inbound-reply.ts): grep `AS ENUM` in the baseline + `add value` in migrations.
- `gl_accounts.number` is INTEGER: a Map keyed by CSV strings never matches and a non-digit value in `.in('number')` fails with 22P02 (app/(app)/owners/import/appfolio/vendor-actions.ts:106-141).

## How coverage works
- `npm run check:columns` parses selects with the TypeScript parser, resolves constants (incl. imports) and same-file parameters.
- Unreadable selects go in `supabase/unchecked-selects.json` with a reason; each needs its own covering test.
- Not covered: rpc selects, `.or()` strings, payload keys, enum values, jsonb RPC keys. Check by hand.
- On Windows, "can't check statically" + "no longer in the code" pairs for one entry are a path-separator artifact.
- Fast multi-column check: node one-liner over schema-columns.json (top-level `{table: [cols]}`).

## Hand checks
- `.update()` payloads often use conditional spreads `...(cond ? { col: v } : {})`: check keys inside spreads too.
- For CHECK migrations, confirm nullability in the baseline (`20260715040000_production_schema_baseline.sql`); a CHECK on a nullable column lets NULL through. Nullability: baseline CREATE TABLE, then grep `set not null`; `lib/types/database.ts` Insert types confirm fast.
- When `select('*')` is narrowed, compare against the consumer's TS interface and every `r.<field>` it reads.
- `email_queue.from_name = null` is the white-label path (process-queue fills the company sender).

## RLS read-back (`.update(...).eq(...).select('id')`)
- With a column filter, `.select()` adds no new RLS constraint; an empty result means not updated (real failure). Still compare SELECT vs UPDATE policies (meeting_action_items example, 2026-10-07).
- Find policies by grepping the baseline (`"public"."<t>"`) and later migrations (`public.<t>`, `alter policy`, DO-loop `format(... %I)` arrays like operator_writes_need_admin / staff_association_in_company).
- Narrowing a FOR ALL policy is safe only if a separate SELECT policy exists.
- A column-level revoke breaks user-client `select('*')`, `.insert().select()` returning it, and `.eq('<col>')` filters.

## Optimistic-lock filters
- `.eq('<timestamptz>', readBack)` round-trips (postgrest-js encodes `+`). Null previous needs `.is(col, null)`; nullable CHECK status needs `.or('status.is.null,status.neq.X')`. Check BEFORE UPDATE triggers that rewrite the guarded column.

## RPCs
- `db.rpc('fn').select().order().range()` is valid for `returns table`/setof; compare columns to the `returns table` list. `returns setof <table>` allows embeds via that table's FKs.
- `fetchAllRows` (lib/supabase/fetch-all.ts) needs a unique final order column; returns `{rows, truncated, error: string|null}`.
- jsonb RPCs: match every `jsonb_build_object` key against what the page reads.
- `!inner` embed filters and multi-level `!inner` with `.eq('a.b.col')` are valid with range/count.

## Migrations that patch functions
- Anchor patches (string replace of pg_get_functiondef): verify each anchor against the LATEST prior definition (may live inside an earlier patch's `$n$` string). `create or replace` must keep the return type.
- Generic DO loops over pg_proc patch functions too: grep the name inside `proname in (...)` lists.
- Full-body rewrites: rebuild the latest body from every patch and `diff -w`; compare header claims to the body.
- Before accepting `revoke insert, update, delete` on a table, grep `'<table>'` (with -A2) across app/lib/scripts for direct writes.
- RETURN QUERY types must match exactly (compare baseline column types).

## Scope helpers
- `checkLinkedRecords` (lib/security/association-scope.ts) is the only guard for FK-less ids like `calendar_events.unit_id`.
