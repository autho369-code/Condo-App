# Product rules

Back to [[Home]].

- Supabase project `termxngysvotnfbzbgrv` only — never touch staging or
  stellar-ops without asking. Additive migrations: Claude applies them
  (Supabase MCP `apply_migration`) as soon as the SQL is settled and before
  Mirsad can merge, reads them back, and the PR body says "do not merge until
  the migration is live" until it is (see [[PR Rules]]). **SQL with DELETE/DROP → Mirsad runs it in
  the SQL editor.** (Use `create or replace trigger`, not drop.)
- **White label everywhere:** clients see their own company name and domain
  ("EACH CLIENT MUST HAVE ITS OWN DOMAIN"). Only "Powered by Portier369" /
  "Generated securely by Portier369" credits stay.
- **Public pages are one company's:** a public page or route that reads with
  the service client filters every read and write by the host's company
  (`tenantFromHeaders(headers).portfolioId`, set by middleware) - never lists
  or accepts another company's data; an address with no company fails closed.
  Token pages (`/sign`, `/vendor-upload`, `/invite`) belong to the token's
  company instead: on another company's address the token is invalid; on
  the platform address the page moves to the company's own address.
- **All sign-ins go through Portier369's own Supabase sign-in:** auth links
  (sign-in, reset, invites, callbacks) stay on `<slug>.portier369.com`, never a
  custom domain.
- Build for new clients; don't migrate or backfill the sample (Granville)
  data. "Don't bill anyone, this is just a sample."
- Owners, vendors and the board never see manager notes. Board portal is
  read-only. Owners/vendors change only what their portal offers, on their own
  records. Server actions re-check auth inside the action and fail loudly.
- Verify Supabase columns before writing queries; every link must resolve;
  shared design system only (`docs/DESIGN_SYSTEM.md`).
- Speed: SECURITY DEFINER helpers used by RLS are PL/pgSQL, never
  LANGUAGE sql. A nested SQL helper is re-planned on every call (~1 ms per
  row), which made pages time out (fixed in 20261008050000). A new or
  replaced helper must be `language plpgsql`; measure RLS changes as each
  role inside a rolled-back transaction before shipping.
- RLS policies are written `TO authenticated` (no TO clause means every
  role, signed-out included). Signed-out access only via an explicit
  `to anon` policy (marketing_leads insert) or the service client on
  public pages. Never `USING (true)` on company data. Shared (platform)
  rows are the ones with no company; never share a row because of a flag
  staff can write (is_system). `npm run db:migrations:check` fails a new
  CREATE POLICY without a TO clause. (2026-10-12)
- A page that renders fewer rows than it exports passes printFromTables to
  ExportActions (Print otherwise prints only the rendered rows). A change to
  a page's data sources (a table read moved into an embed or an RPC) needs
  docs/redesign/baseline-inventory.json updated: run
  npx vitest run tests/redesign before pushing. (2026-10-12)
- A SECURITY DEFINER function or trigger must not hand back columns hidden
  from signed-in users (column grants, e.g. bank_accounts numbers): a
  whole-row copy (to_jsonb(old), row_to_json) gets around them. Don't grant
  EXECUTE to authenticated on a definer function nothing calls. (2026-10-12)
- No unbounded list query: the API stops at 1,000 rows without an error.
  Either .limit(N) with { count: 'exact' } and a "Showing the newest N of
  M" notice, or fetchAllRows (order ending in id) when every row is needed.
  Count and sum in the database (head counts, RPCs), never over a capped
  list. (2026-10-12)
- Judge RLS speed at scale, not on today's tiny tables: add thousands of
  rows in a rolled-back transaction and time each role (a per-row policy
  is invisible at 17 rows: units 4 ms at 17 rows, 341 ms at 5,000).
  (2026-10-12)
- Every table a manager can reach that belongs to an association (directly,
  or through a unit or bank account) carries the restrictive mgr_assoc_scope
  policy; a new such table gets it in the same migration. (2026-10-12)
- RLS policies call helpers ONCE PER QUERY: write `( SELECT public.f() )`
  for zero-argument helpers, and compare the row's column against a
  once-per-query helper (`portfolio_id = ( SELECT public.my_access_portfolio() )`,
  `association_id IN ( SELECT rls_private.my_accessible_association_ids() )`)
  instead of `can_access_portfolio(portfolio_id)`, which runs per row
  (20261011010000). Keep the result false, not null (COALESCE), when it
  is ANDed with another per-row check. Changing a can_* helper body?
  Change its once-per-query twin too (each helper's COMMENT names it,
  20261011040000); policies no longer call the originals.
- **No competitor names in the product** (Mirsad, 2026-10-09): nothing a
  manager, owner, board or vendor sees — page text, buttons, URLs, errors,
  and text an import stores (charge descriptions, notes) — says "AppFolio".
  Say "previous system". Marketing comparison pages are the only exception.
- **Every association's records are its own** (Mirsad, 2026-10-09): a record
  belongs to one association and never mixes with or is reused by another.
  Homeowners: one record per association (a person in two associations = two
  records; one record can own many units in any of that association's
  buildings). Deleting an association deletes all of its records.
  Imports, pickers and lookups match only inside the association.
  - **Vendors: per association** (same company in two associations = two
    vendor records). **One exception: the management company** (Mirsad,
    2026-10-09) is a single company-level vendor (`is_management_company`,
    no association) that management fees bill from every association. One
    vendor login sees every association the vendor works for (Mirsad chose
    "build it now"), each record reached only through its own staff
    invitation, never by email match ([[Decisions]]).
  - **Chart of accounts: one per company**, entered and changed by the
    company admin; balances stay per association.
- **No bare DELETE in database functions** (2026-10-09): Supabase's
  pg_safeupdate refuses a DELETE with no WHERE from API sessions, even
  inside a security definer RPC. Clear a per-call temp table with
  `truncate`.
- **No inline subqueries over RLS tables inside policies** (2026-10-13):
  Postgres expands the inner table's policies inside the outer plan,
  recursively (a one-unit owner query planned ~190 ms). Put the lookup in an
  rls_private plpgsql SECURITY INVOKER set function (same rows: the caller's
  policies still apply) and use `col in (select rls_private.fn())`
  (20261014000000). Migration versions must be real UTC times (no hour 24).
- **Cross-row checks in triggers lock what they read** (2026-10-13): a
  trigger that checks a row against another table's row reads it FOR SHARE
  (or shares an advisory lock with the trigger guarding the other side), so
  two concurrent writes cannot each pass on stale data (20261014030000).
- **A changed measure rechecks stored statuses** (2026-10-13): when a
  migration changes a function a stored status is derived from (e.g.
  payment_plan_paid_amount -> payment_plans.status), the same migration
  runs the recheck for existing rows; triggers only fire on the next write
  (20261013230000).
- Every form field has a name a screen reader can read: a <label htmlFor> tied to the control (use Field + Input/Select/Textarea), a fieldset/legend for radio groups, or aria-label. `npm run lint` enforces labels (jsx-a11y/label-has-associated-control). Field ties its label to a single Input/Select/Textarea child itself; with several controls pass htmlFor + id. (2026-10-11)
- Scripts: app pages run under an enforced nonce CSP (lib/server/csp.ts). No inline <script> or on*= handlers in app pages; a new third-party script/frame host must be added to lib/server/csp.ts; an inline script in a blob/print window needs its sha256 in the policy (see PRINT_SCRIPT_HASH). (2026-10-11)
