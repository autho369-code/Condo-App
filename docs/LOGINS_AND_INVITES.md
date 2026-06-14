# Logins & Invitation Chain — Portier369 (Granville Courts sample)
*As of 2026-06-14. TEST credentials — rotate before production.*

## All current logins
All persona passwords: **`Portier2026!`**

| Email | Role | Lands on | Notes |
|---|---|---|---|
| `hello@portier369.com` | **Platform Operator** | `/platform-operator` | super-admin; password reset to `Portier2026!` |
| `autho369@gmail.com` | Platform Operator | `/platform-operator` | original seed password (unknown — reset via operator if needed) |
| `admin@condoapp.io` | Platform Operator | `/platform-operator` | original seed password |
| `admin@hoa-os.local` | Platform Operator | `/platform-operator` | original seed password |
| `admin@portier369.com` | **Company Admin** (Stellar) | `/company-admin/overview` | hoa_role=company_admin |
| `manager@portier369.com` | **Manager** (Property Manager) | `/dashboard` | full manager workspace |
| `owner1@portier369.com` | **Owner + Board President** (Olivia, unit 101) | `/board` | also reaches `/portal` as owner |
| `owner2@portier369.com` | **Owner** (Liam, unit 102, rents to tenant) | `/portal` | owner portal |
| `vendor@portier369.com` | **Vendor** (Lakefront Maintenance) | `/vendor` | vendor portal |
| *(Tessa Tenant)* | **Tenant — NO login** | — | data-only contact; reachable by email/SMS only |

Login page: `/login` (one form; it routes by the account's real role). Use `hello@portier369.com` / `Portier2026!` as the platform operator.

## The invitation chain (who invites whom)

### 1. Platform Operator → Company Admin  ✅ wired
- Log in as `hello@portier369.com` → **Platform Operator** cockpit.
- Go to **Companies** (`/platform-operator/companies`).
- Either **Create company + admin** in one step (`createCompanyWithAdmin` → `provision_portfolio`), or open a company and **Invite admin** (`inviteAdmin`).
- This inserts a `user_invitations` row (`hoa_role='company_admin'`) and queues the invite email (Resend).
- The admin clicks the link → `/accept-invitation?token=…` (`accept_invitation` RPC) → sets a password → lands on `/company-admin/overview`.

### 2. Company Admin → Manager  ⚠️ GAP (fix pending)
- Company admin: **Managers** page (`/company-admin/managers`) → **"Invite Manager"** button.
- **Problem:** that button links to `/settings?tab=managers`, but `/settings` is gated by `requirePortfolioAdmin` (needs `hoa_role='manager'`). A `company_admin` fails that check and gets bounced. So a company admin currently *cannot* reach the manager-invite form.
- The underlying invite works (`invite_staff` RPC) when triggered by a manager/operator from `/settings`.
- **Fix needed:** give company admins access to the manager-invite action (own action in `/company-admin/managers`, or allow `is_company_admin` in the settings guard).

### 3. Manager → Owners / Tenants / Vendors
- **Owners** (portal invite) ✅: Manager → **Owners → Activations** (`/owners/activations`) shows portal status; **"Stage activation"** → `/owners/forms?template=portal_activation` sends the owner an activation link. Owner accepts → sets password → `/portal`. (Owners are first created via **Owners → New**.)
- **Vendors** ✅ (manual): Manager creates the vendor (**Vendors → New**); portal access via the vendor's `portal_activated` flag. Dedicated `invite_vendor` RPC exists but the one-click invite button isn't wired yet — vendor portal currently activated by setting the flag.
- **Tenants** — by design **no portal invite**. Manager adds the tenant as a contact (tenants table); they receive **email/SMS only** (Communication Center "Tenants" group; SMS console "Tenant" recipient). No login.
- **Board members** (bonus): `invite_board_member` RPC exists; a board member is an owner whose `hoa_role` is set to `board` + a `board_members` row (how Olivia was set up).

## Accept-invite mechanics
- Public routes: `/accept-invitation`, `/invite` (in middleware PUBLIC_PATHS).
- Invite emails are built by `inviteAdmin`/`invite_staff` and queued to `email_queue` → `process-email-queue` cron → Resend. Real `@portier369.com` addresses deliver; `@example.com` are suppressed.
- `accept_invitation(p_token)` consumes the token, links the auth user to the portfolio + role.

## Known gaps to close (for a working end-to-end chain)
1. **Company Admin → Manager invite is blocked** (see step 2) — highest priority.
2. **Vendor one-click invite** not wired (manual `portal_activated` works).
3. Owner activation send path goes through the forms flow — verify the email actually queues on "Stage activation".
