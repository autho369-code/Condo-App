# Product rules

Back to [[Home]].

- Supabase project `termxngysvotnfbzbgrv` only — never touch staging or
  stellar-ops without asking. Additive migrations: Claude applies after merge
  (Supabase MCP `apply_migration`). **SQL with DELETE/DROP → Mirsad runs it in
  the SQL editor.** (Use `create or replace trigger`, not drop.)
- **White label everywhere:** clients see their own company name and domain
  ("EACH CLIENT MUST HAVE ITS OWN DOMAIN"). Only "Powered by Portier369" /
  "Generated securely by Portier369" credits stay.
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
