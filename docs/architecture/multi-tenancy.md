# Multi-tenant URL extensions

> _The white-glove premise — every management company gets their own URL._

Portier serves a different operating company on every domain it answers. Below
is the routing and provisioning model that makes that possible without
duplicating any code or any data store.

---

## URL strategy

Two mechanisms, one resolution function.

| Strategy | Example | When to use |
|---|---|---|
| **Subdomain** (default) | `beacon.portier369.com` | Every new tenant, day one. Free with the `*.portier369.com` wildcard. |
| **Custom domain** (vanity) | `app.managebeacon.com` | Larger / pickier tenants who want a branded address. CNAME points at Vercel. |

The marketing apex (`portier369.com`) and dev hosts (`*.vercel.app`,
`localhost`) are intentionally **not** tenants — they show the public sales
site or a generic auth shell.

---

## Where it lives

| Layer | File | Purpose |
|---|---|---|
| Database | `supabase/migrations/20260510020000_portfolio_url_extensions.sql` | Adds `portfolios.slug` (NOT NULL, unique, URL-safe) and `portfolios.custom_domain` (unique, optional). Backfills `slug` from `company_name` for existing rows. Defines `resolve_portfolio_for_host(text)` RPC. |
| Resolver | `lib/tenant/resolve.ts` | `resolveTenantFromHost(host)` calls the RPC, handles apex / preview / localhost edge cases, and exposes `tenantUrl(slug, path)` for outbound links from the platform console. |
| Edge | `middleware.ts` | Calls the resolver on every request, then sets `x-portier-tenant-{slug,id,name}` headers on the response so server components can read them via `headers()`. |
| Server | `lib/tenant/resolve.ts → tenantSlugFromHeaders(headers)` | Helper for server components / route handlers to read the tenant the middleware established. |

---

## Data isolation — _unchanged_

URL routing is a **branding** layer, not a security layer. Data isolation
remains exactly what Supabase RLS already enforces:

1. Every tenant-owned table carries `portfolio_id`.
2. RLS policies scope every read/write to `portfolio_id = me().portfolio_id`.
3. The `me()` RPC returns the authenticated user's portfolio.

So even if a Beacon staffer pasted a Cedar Grove URL into their browser, they
would land on a page that returns **zero rows** because RLS still filters by
their portfolio. The URL is decorative; the database is canonical.

---

## What needs to happen outside the codebase

### DNS

```
portier369.com           → A     76.76.21.21   (Vercel)
*.portier369.com         → CNAME cname.vercel-dns.com.
```

The wildcard catches every subdomain. No per-tenant DNS work.

### Vercel

Project → Settings → Domains:

```
portier369.com           Production
*.portier369.com         Production  (wildcard)
```

When a vanity domain is added, also add it here (Vercel handles the SSL):

```
app.managebeacon.com     Production
```

### Supabase

No new env vars. The middleware uses the existing service-role key to call
the `resolve_portfolio_for_host` RPC.

For local development, the resolver also matches `*.localhost`, so you can run
`http://beacon.localhost:3000` against a dev Supabase and exercise the full
tenant flow.

---

## Provisioning a new tenant

1. **Sales call** — close the deal, capture the company name.
2. **Operator console** — `/platform/portfolios` → "Provision client" form.
   The existing `provision_portfolio(...)` RPC creates the portfolio shell,
   the first manager admin, the tier and seat allocation.
3. **Pick a slug** — defaults from `company_name` (lowercased, hyphenated).
   Editable on the portfolio detail page.
4. **(Optional) custom domain** — when the client is ready, add the domain
   in Vercel and to `portfolios.custom_domain`. CNAME instructions go in the
   onboarding packet.
5. **Send the welcome email** — `https://{slug}.portier369.com/login`.

Total time from "yes" to "their team can sign in": ~5 minutes.

---

## What still needs building (out of scope for this drop)

- **Tenant-aware login branding** — the login page can show the tenant's
  company name + logo when reached via subdomain. Read
  `tenantSlugFromHeaders(headers())` in `app/(auth)/layout.tsx` and look up
  the portfolio for the eyebrow text + concierge panel quote.
- **Cross-tenant URL guard** — when a signed-in user lands on the wrong
  subdomain (e.g. Beacon staffer → cedar.portier369.com), redirect them to
  their own subdomain instead of showing them an empty workspace.
- **Tenant logo upload** — a one-time concierge action stored in
  `portfolios.logo_url`, used on auth pages + the resident portal.
