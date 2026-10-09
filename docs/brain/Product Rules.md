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
