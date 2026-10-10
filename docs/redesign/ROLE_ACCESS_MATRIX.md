# Role access matrix (baseline, before the redesign)

Baseline commit: `2fea8502` (main, 2026-10-10). Source of truth: the guards in
`lib/auth/me.ts`, the layout of each role area, `middleware.ts`, and the
database (RLS, grants, triggers). The redesign changes none of these. The six
product roles are application roles; they are not the Postgres roles
`authenticated` / `anon`.

## Who passes each guard

| Guard (`lib/auth/me.ts`) | Allowed | Denied → where |
|---|---|---|
| `requireAuth` | any signed-in account whose company matches the workspace address | signed out → `/login`; another company's address → `/login?error=workspace_access_denied`; operator on a company address → `/login?error=platform_workspace_only` |
| `requireStaff` | `is_staff`, platform operator | everyone else → their own home (`roleHome`) |
| `requireWorkspaceStaff` | staff, company admin, platform operator | → `roleHome` |
| `requireFinanceStaff` | `is_finance_staff`, platform operator | → `roleHome` |
| `requireFinanceOrPortfolioAdmin` | finance staff, company admin, platform operator | → `roleHome` |
| `requirePortfolioAdmin` | company admin, platform operator | → `/dashboard` |
| `requirePlatformOperator` | active platform operator (admin, support, readonly) | → `/dashboard` |
| `requirePlatformAdmin` | platform operator with role `admin` | → `/platform-operator?error=…` |
| `requireBoard` | `is_board`, platform operator | → `roleHome` |
| `requireOwner` | a login with an active (portal on, not archived) owner record | → `/login?mode=owner` or `…&error=portal_access_disabled` |
| `requireVendor` | a login with an active vendor record | → `/login?mode=vendor` or `…&error=portal_access_disabled` |
| `requireTenant` | an active resident (tenant) record | → `/login?mode=resident…` |

On top of the page guards:
- **Platform operators can't write by default.** Inside a server action or any non-GET request, every guard built on `requireAuth` refuses operators whose role is not `admin` (`refuseOperatorAction`). The support queue allows `support`. The database enforces the same rule with `operator_write_guard` on company data tables.
- **Middleware runs on every request.** It refreshes the session, checks that the company matches the workspace address, blocks operator writes and enforces MFA.
- **Home page by role (`roleHome`).** The first matching role decides, in this order:

  | Role | Home page |
  |---|---|
  | Operator | `/platform-operator` |
  | Company admin | `/company-admin/overview` |
  | Staff | `/dashboard` |
  | Board | `/board` |
  | Vendor | `/vendor` |
  | Owner | `/portal` |
  | Resident | `/resident` |

## Role areas

| Role | Area | Layout guard | Pages | Page-level guards (count) | Sidebar entries |
|---|---|---|---|---|---|
| Operator | `app/platform-operator` | `requirePlatformOperator` | 21 | requirePlatformOperator 18, + requirePlatformAdmin 2, + requireOp 1 | 19 |
| Company admin | `app/company-admin` (+ shared staff pages it links to, e.g. `/assistant`, `/meetings`, `/settings/*`) | `requirePortfolioAdmin` | 24 | requirePortfolioAdmin 22, layout only 2 | 29 |
| Property manager | `app/(app)` | `requireAuth` + staff / company admin / operator, else `roleHome` | 251 | requireStaff 145, requireFinanceStaff 51, requireWorkspaceStaff 14, requirePortfolioAdmin 7, requireFinanceOrPortfolioAdmin 5, mixed 10, layout only 17 | 107 sidebar + 144 Action Center |
| Owner | `app/portal` | `requireOwner` | 35 | requireOwner 34, layout only 1 | 23 |
| Board | `app/board` | `requireBoard` | 26 | requireBoard 7, layout only 19 | 6 |
| Vendor | `app/vendor` | `requireVendor` | 10 | requireVendor 10 | 9 |
| Resident (not one of the six, same shell) | `app/resident` | `requireTenant` | 10 | requireTenant 10 | 9 |

Per-page guards and per-route capabilities are listed in
`FUNCTION_PRESERVATION_MATRIX.csv`, generated from `baseline-inventory.json`.

## Data scope (database, unchanged)

- **Staff:** company via `can_access_portfolio`. Scoped managers are also limited to their associations by the restrictive `mgr_assoc_scope` and `can_manage_association`. Finance requires `can_manage_finance`.
- **Owners:** every active record of the login (`current_owner_ids()`). Writes are tied to the named record (`owner_record_matches`). Sold units are hidden through occupancy tenure.
- **Board:** their associations (`current_board_association_ids()`). Read-only except the workflows that already exist.
- **Vendors:** their own vendor records (`current_vendor_ids()`). They can change only a work order's status (`trg_work_order_000_vendor_guard`).
- **Operators:** read across companies. They write only with role `admin`.

## Allow / deny checks to run after the redesign

For each role, with an ordinary account of that role (never a service key):

| Check | Expected |
|---|---|
| Landing after sign-in | `roleHome` page above |
| Another role's area by URL (e.g. owner → `/dashboard`, vendor → `/portal`, manager → `/platform-operator`) | redirected as in the guard table |
| Another company's workspace address | `/login?error=workspace_access_denied` |
| Changing `?record=` / an id in the URL to another association's record | not found or not shown (RLS), never another company's data |
| Read-only operator posts a form | refused (`Only Portier platform admins can make changes.`) |
| Every sidebar / Action Center entry for the role | opens the same route as in the baseline |

## Access gaps for verification (2026-10-10)

- Production has **no owner or board logins** (`owners.auth_user_id`, `board_members.auth_user_id` all null) and one vendor login. No test credentials are available to this session.
- Owner, board and vendor screens can't be exercised signed-in until a test login exists. Their parity is checked statically (inventory + parity test) and recorded as **unverified in the browser**.
- Manager and company-admin screens can be checked in the browser panel only after Mirsad signs in himself. Claude never enters passwords.
