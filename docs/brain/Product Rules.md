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
- **A record that is final is guarded in the database** (2026-10-13): app
  checks are not enough; a BEFORE UPDATE trigger refuses changes to a final
  record (a completed meeting's status and recorded quorum). Repairs go
  through public.app_is_repair_session() (service role, or a direct database
  session with no request). Inside a SECURITY DEFINER function current_user
  is the owner, so never test it for the caller's role (20261014130000).
- **A table-wide UPDATE grant can't be narrowed by revoking a column**
  (2026-10-13): where authenticated holds UPDATE on the whole table, protect
  a column with a BEFORE UPDATE OF trigger that refuses `current_user in
  ('authenticated','anon')` (SECURITY DEFINER functions run as their owner
  and pass). Inside such a trigger shared by tables, nest the column checks
  under `if tg_table_name = ...`: PL/pgSQL resolves every field in a
  condition, so `tg_table_name = 'x' and new.col ...` fails on the other
  table (20261014170000).
- **A sign-in link is never readable by a signed-in user** (2026-10-13): a
  row holding a password-reset, verification, invitation, e-signature or
  upload link (email_queue holds_auth_link) is readable by no signed-in user,
  not even the one who asked for it (a staff member resetting someone else's
  password would get that person's link), and such rows are queued by the
  server only; invitation tokens aren't readable either. Signed-in users
  can only retry a failed email. Anything they insert for delivery is checked
  in the database: sender name and address, reply-to, active HTML, owner,
  rate (20261014220000). Checks inside a trigger that reads other tables run
  in a definer helper: the caller's row-level security on every row made
  2,000 emails take ~4 s.
- **Every queued email is required or optional, decided by the database**
  (2026-10-13): a new producer of mass or optional mail gives its rows an
  optional key prefix (email_queue_optional_key); a new required kind sent
  from a signed-in session adds its prefix to email_queue_required_key, or
  it is treated as optional. Suppressed mail is kept and marked, never
  dropped silently.
- **Route by what the provider reports, never by what staff can edit**
  (2026-10-13): deciding which company a reply, consent change or webhook
  belongs to uses a value only the server writes (e.g.
  sms_messages.provider_from_number), every column the match reads is
  frozen for signed-in users, and routing lookups have no row cap and count
  distinct companies: one company's rows can't hide or claim another's.
- **Guards check current_user, not auth.role()** (2026-10-13): inside a
  SECURITY DEFINER function an owner's action runs, auth.role() is still
  'authenticated' while current_user is the function owner. A trigger that
  limits direct writes by signed-in users checks current_user, so trusted
  functions pass (an auth.role() guard refused staff notifications for owner
  messages after #367; 20261014233000).
- **A limit counts what the server sets, under a lock** (2026-10-13): a rate
  limit or quota must count by values the database sets (created_at := now(),
  sent_by := auth.uid() in the guard), never ones the caller supplies, and
  take a per-scope lock (pg_advisory_xact_lock) before counting, or
  parallel requests each see room (Codex on #367, 20261014230000).
- **Residents read staff tables through a safe RPC** (2026-10-13): a policy
  can't hide columns, so when a table holds staff-only fields (internal
  notes, instructions, recipients), owners and tenants read it through a
  SECURITY DEFINER function that returns only the resident fields and drops
  rows about other people; their direct read policy is USING false
  (resident_calendar_events, 20261014190000).
- **A move-in cutoff is one id set, not a per-row call** (2026-10-13): owner
  policies that compare each row to the owner's move-in date call a definer
  set function once (`id in (select rls_private.resident_visible_..._ids())`);
  hiding the seller's payments must not hide what they paid off (charge
  balances use the unit's applications).
- **Resident pages filter to their own rows, not RLS alone** (2026-10-13): a
  login can also be an owner, board member or staff, whose policies show
  more; filter by the resident's own ids in the query.
- **Undo by what a row is, not by an id held in memory** (2026-10-13): a
  webhook that compensates (cancels what it created when the state changed
  under it) must find the rows by their identity (owner, unit, method), so
  a redelivered event, which no longer knows the id it created, undoes them
  too; cancel a Stripe session before releasing the local reservation
  (Codex on #363).
- **A row guard checks the row as it is, not as requested** (2026-10-13):
  on UPDATE/DELETE, look up the parent through OLD (the row's real parent);
  checking NEW and then resetting it to OLD lets a request name an open
  parent to change a closed one's child (Codex on #361, 20261014180000).
  Switching a guard to SECURITY DEFINER needs an explicit caller-access
  check first (RLS no longer applies inside it).
- **Rules the API enforces belong in the database too** (2026-10-13): a
  check in an API route (dates, order, one in progress) is bypassed by a
  direct table write; values the server computes (balances, amounts) are
  recomputed in the trigger, never taken from the request.
- **Per-row calls to SET search_path helpers are slow** (2026-10-13): a
  function with SET (search_path, etc.) is never inlined, so calling one per
  row costs a full call each (gl_normal_amount on 24,000 lines = 1.2 s).
  Aggregate first, then call the helper per group. A LANGUAGE sql function
  with "p is null or ..." filters runs a generic plan; use plpgsql with
  plan_cache_mode = force_custom_plan (20261014040000/050000).
- **One correlated subquery per value in views** (2026-10-13): a view that
  repeats the same correlated subquery for several columns runs each copy as
  its own subplan, and each re-evaluates that table's access rules. Compute
  it once with LEFT JOIN LATERAL and reuse the column (20261014060000).
- **A changed measure rechecks stored statuses** (2026-10-13): when a
  migration changes a function a stored status is derived from (e.g.
  payment_plan_paid_amount -> payment_plans.status), the same migration
  runs the recheck for existing rows; triggers only fire on the next write
  (20261013230000).
- **Dates follow the association's calendar** (2026-10-13): a database rule
  about "today" (late, overdue, due soon, not in the future) uses
  association_local_date(association), never current_date (UTC): in a US
  evening UTC is already tomorrow (20261015040000).
- **Managers can remove a late fee** (Mirsad, 2026-10-13): remove_late_fee
  credits the open amount back to the fee's income account with a reason;
  the fee's late_fee_assessments row stays so it is never charged again.
- Every form field has a name a screen reader can read: a <label htmlFor> tied to the control (use Field + Input/Select/Textarea), a fieldset/legend for radio groups, or aria-label. `npm run lint` enforces labels (jsx-a11y/label-has-associated-control). Field ties its label to a single Input/Select/Textarea child itself; with several controls pass htmlFor + id. (2026-10-11)
- Scripts: app pages run under an enforced nonce CSP (lib/server/csp.ts). No inline <script> or on*= handlers in app pages; a new third-party script/frame host must be added to lib/server/csp.ts; an inline script in a blob/print window needs its sha256 in the policy (see PRINT_SCRIPT_HASH). (2026-10-11)
