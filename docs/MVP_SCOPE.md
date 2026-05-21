# MVP Scope

This is the first usable version. Anything outside this list is backlog until these flows are stable.

## Must Ship

1. **Login and role routing**
   - Staff can sign in and land on the right dashboard.
   - Owners can sign in and land on the owner portal.

2. **Dashboard**
   - Show portfolio health: associations, owners, open work orders, recent payments, and urgent tasks.
   - No decorative metrics without real Supabase data.

3. **Associations**
   - List associations.
   - Open an association detail view with units, owners, board, budget, approvals, and documents.
   - Create a new association only if the form writes cleanly to Supabase.

4. **Owners and Units**
   - List owners and units.
   - Open detail pages with contact info, owned units, balances, charges, payments, and service history.

5. **Work Orders**
   - List, create, assign, update status, and view a work order timeline.
   - Prioritize emergency/high/normal states clearly.

6. **Payments and Receivables**
   - Owner portal can show balance and ledger.
   - Payment page can either process Stripe when configured or clearly show payments disabled.
   - Staff can see charges/payments status.

7. **Reports**
   - Ship only the core reports first: delinquency, income statement, balance sheet, general ledger, and owner ledger.
   - Reports must render real Supabase data and support association filtering where relevant.

## Explicit Backlog

- SMS inbox
- Ballots/voting
- Inspections
- Inventory
- Unit turns
- Full document template merge engine
- QuickBooks sync
- Marketplace/integrations center
- Advanced automation center
- Broad AppFolio parity

## Release Gate

- `npm.cmd test` passes.
- `npm.cmd run build` passes.
- Production Vercel URL is accessible without deployment protection.
- Supabase Auth redirect URLs include production and preview callback URLs.
- Supabase service credentials have been rotated or replaced with new API keys.
- Smoke test passes for login, dashboard, associations, owners, payments, and reports.
