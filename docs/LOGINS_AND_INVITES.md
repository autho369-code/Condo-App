# Logins & Invitation Chain — Portier369 (Granville Courts sample)
*As of 2026-06-14. TEST credentials — rotate before production.*

## All current logins
Shared persona passwords are retired. Use verified-email invitations or the normal recovery-email flow.

| Email | Role | Lands on | Notes |
|---|---|---|---|
| `hello@portier369.com` | **Platform Operator** | `/platform-operator` | super-admin; access requires its verified-email credential flow |
| `autho369@gmail.com` | Platform Operator | `/platform-operator` | original seed password (unknown — reset via operator if needed) |
| `admin@condoapp.io` | Platform Operator | `/platform-operator` | original seed password |
| `admin@hoa-os.local` | Platform Operator | `/platform-operator` | original seed password |
| `admin@portier369.com` | **Company Admin** (Stellar) | `/company-admin/overview` | hoa_role=company_admin |
| `manager@portier369.com` | **Manager** (Property Manager) | `/dashboard` | full manager workspace |
| `owner1@portier369.com` | **Owner + Board President** (Olivia, unit 101) | `/board` | also reaches `/portal` as owner |
| `owner2@portier369.com` | **Owner** (Liam, unit 102, rents to tenant) | `/portal` | owner portal |
| `vendor@portier369.com` | **Vendor** (Lakefront Maintenance) | `/vendor` | vendor portal |
| *(Tessa Tenant)* | **Tenant — NO login** | — | data-only contact; reachable by email/SMS only |

Login page: `/login` (one form; it routes by the account's real role). Never store or share a platform-operator password in this repository.

## The invitation chain (who invites whom)

### 1. Platform Operator → Company Admin  ✅ wired
- Log in as `hello@portier369.com` → **Platform Operator** cockpit.
- Go to **Companies** (`/platform-operator/companies`).
- Either **Create company + admin** in one step (`createCompanyWithAdmin` → `provision_portfolio`), or open a company and **Invite admin** (`inviteAdmin`).
- This inserts a `user_invitations` row (`hoa_role='company_admin'`) and queues the invite email (Resend).
- The admin clicks the link → `/accept-invitation?token=…` (`accept_invitation` RPC) → sets a password → lands on `/company-admin/overview`.

### 2. Company Admin → Manager  ✅ wired
- Company admin: **Managers** page (`/company-admin/managers`) has an inline **Invite manager** form (email + optional association checkboxes).
- Submitting calls the `inviteManager` server action (`app/company-admin/managers/actions.ts`), which re-checks `requirePortfolioAdmin` and calls the `create_manager_invitation` RPC. The invite email is queued with the tenant-branded `/invite?token=…` link.
- Selected associations travel with the invitation; on acceptance `apply_pending_invitation` creates the `association_managers` rows. No selection = full portfolio access.
- (Previously the button linked to `/settings?tab=managers`, which company admins could not reach — that gap is closed.)

### 3. Manager → Owners / Tenants / Vendors
- **Owners** (portal invite) ✅: Manager → **Owners → Activations** (`/owners/activations`) shows portal status; **"Stage activation"** → `/owners/forms?template=portal_activation` sends the owner an activation link. Owner accepts → sets password → `/portal`. (Owners are first created via **Owners → New**.)
- **Vendors** ✅: Manager creates the vendor (**Vendors → New**), then uses the one-click **Invite to portal** button on the vendor list (`/vendors`) or the vendor detail page (`/vendors/[id]`). Both call `inviteVendorToPortal` (`app/(app)/vendors/actions.ts`), which creates a `user_invitations` row (`hoa_role='vendor'`, superseding any older pending invite) for the vendor's first email on file and queues the `/invite` link. The vendor accepts → sets a password → lands on `/vendor`.
- **Tenants** — by design **no portal invite**. Manager adds the tenant as a contact (tenants table); they receive **email/SMS only** (Communication Center "Tenants" group; SMS console "Tenant" recipient). No login.
- **Board members** (bonus): `invite_board_member` RPC exists; a board member is an owner whose `hoa_role` is set to `board` + a `board_members` row (how Olivia was set up).

## Accept-invite mechanics
- Public routes: `/accept-invitation`, `/invite` (in middleware PUBLIC_PATHS).
- Invite emails are built by `inviteAdmin`/`invite_staff` and queued to `email_queue` → `process-email-queue` cron → Resend. Real `@portier369.com` addresses deliver; `@example.com` are suppressed.
- `accept_invitation(p_token)` consumes the token, links the auth user to the portfolio + role.

## Known gaps to close (for a working end-to-end chain)
1. ~~Company Admin → Manager invite is blocked~~ — fixed (inline form on `/company-admin/managers` → `inviteManager` → `create_manager_invitation`).
2. ~~Vendor one-click invite not wired~~ — fixed (`inviteVendorToPortal` on `/vendors` and `/vendors/[id]`).
3. Owner activation send path goes through the forms flow — verify the email actually queues on "Stage activation".
