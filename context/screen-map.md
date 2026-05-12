# Screen Map

This file maps each approved reference screen to Portier behavior and Supabase wiring.

## Associations Directory

Screenshot:

![Associations Directory](screenshots/2026-05-12-associations-directory.png)

Layout:

- Left pane: Associations selected.
- Center pane: association directory table.
- Right pane: contextual Tasks.

Center pane:

- Title: Associations.
- Instruction: click row to view association information.
- Table columns:
  - Name
  - Units
- Row content:
  - association name
  - street address
  - city/state/zip
  - unit count
- Pagination.
- Show hidden associations link/filter.

Right pane groups:

- Calendar
- Tasks
- Reports
- Statements
- Help Topics

Supabase wiring:

- `associations`
- `units` aggregate by association

Status:

- Approved from saved screenshot.
- Not fully wired yet.

## Dashboard

Screenshot:

![Dashboard](screenshots/2026-05-12-dashboard.png)

Layout:

- Left pane: Dashboard selected.
- Center pane: operational dashboard blocks stacked vertically.
- Right pane: contextual Tasks.

Center pane:

- Online Payments
- Online Portal Adoption
- Notifications
- Maintenance
- Association Approvals
- Upcoming Income Recertifications
- Vendor Online Payables

Right pane:

- Setup
- Calendar
- Property/Association shortcuts
- In Reports
- Help Topics

Supabase wiring:

- `associations`
- `payments`
- `owners`
- `occupancies`
- `work_orders`
- `approval_requests`
- `vendors`
- reporting views

Status:

- Captured from saved screenshot.
- Needs comparison before implementation.

## Homeowners Directory

Screenshot:

![Homeowners Directory](screenshots/2026-05-12-homeowners-directory.png)

Layout:

- Left pane: People expanded, Homeowners selected.
- Center pane: Homeowners directory.
- Right pane: contextual Tasks and Reports.

Center pane:

- Top tabs: Homeowners, Owners, Vendors.
- Title: Homeowners.
- Alphabet filter A-Z and All.
- Table columns:
  - Name
  - Association
  - Unit
  - Phone
- Pagination.

Right pane:

- Tasks:
  - Change Homeowner
  - Move In Homeowner
  - New Vendor
  - Email All Homeowners
- Reports:
  - Dues Roll
  - Homeowner Delinquency
  - Homeowner Directory
  - Homeowner Ledger

Supabase wiring:

- `owners`
- `occupancies`
- `units`
- `associations`

Status:

- Approved from saved screenshot.
- Directory page should be simplified to match.

## Owners Directory

Screenshot:

![Owners Directory](screenshots/2026-05-12-owners-directory.png)

Layout:

- Left pane: People expanded, Owners selected.
- Center pane: Owners directory.
- Right pane: contextual Tasks, Letters, and reports.

Center pane:

- Top tabs: Homeowners, Owners, Vendors.
- Title: Owners.
- Alphabet filter A-Z and All.
- Table columns:
  - Name
  - Company
  - Phone
  - Email
- Pagination.

Right pane:

- Tasks:
  - New Owner
  - Owner ACH Setup
  - Owner Portal Activation
  - Send Owner Packets
  - New Management Agreement
  - Management Agreements
  - Send Form to Owner
  - Owner Portal Bulk Settings
- Letters:
  - Owner Statement (Enhanced)
  - Owner Statement

Supabase wiring:

- `owners`
- `management_agreements`
- `user_invitations`
- `documents`

Status:

- Approved from saved screenshot.
- Directory page should be simplified to match.

## Vendors Directory

Screenshot:

![Vendors Directory](screenshots/2026-05-12-vendors-directory.png)

Layout:

- Left pane: People expanded, Vendors selected.
- Center pane: Vendors directory.
- Right pane: contextual Tasks, Reports, and Help Topics.

Center pane:

- Top tabs: Homeowners, Owners, Vendors.
- Title: Vendors.
- Filters:
  - Vendor text input
  - Trade dropdown
  - More Filters
  - Clear Filters
- Table columns:
  - Name
  - Address
  - Trades
  - Phone
  - Email
- Pagination.

Right pane:

- Tasks:
  - New Vendor
  - Vendor ACH Setup
  - Request Documents
  - Request W-9
- Reports:
  - Vendor Directory
  - Vendor Ledger
  - Vendor Ledger (Enhanced)
- Help Topics:
  - Vendor Portal Overview
  - Set Up Vendor E-Checks
  - Vendor Document Management

Supabase wiring:

- `vendors`
- `vendor_compliance`
- `documents`
- `payment_methods`

Status:

- Approved from saved screenshot.
- Directory page should be simplified to match.

## Send Email Homeowners Modal

Screenshot:

![Send Email Homeowners Modal](screenshots/2026-05-12-send-email-homeowners-modal.png)

Layout:

- Modal over Homeowners directory.

Center modal:

- From
- Send from do-not-reply checkbox
- Recipients dropdown
- Copy Email Addresses link
- CC
- Additional Recipients
- Subject
- Message
- Send
- Cancel
- Customize My Signature

Supabase wiring:

- `owners`
- `email_queue`
- `communication_messages`
- `documents` or templates if signatures are stored there

Status:

- Captured from saved screenshot.
- Needs implementation review.

## Move In Homeowner

Screenshot:

![Move In Homeowner](screenshots/2026-05-12-move-in-homeowner.png)

Layout:

- Left pane: People.
- Center pane: move-in wizard.
- Right pane: contextual Tasks and Account.

Center pane:

- Wizard steps:
  - Profile
  - Additional Tenants/Homeowners
  - Select Unit
  - Lease Details/Association Details needs product decision
  - Generate Lease/Generate Documents needs product decision
  - Finish Move In
- Profile information card:
  - name
  - company
  - phone numbers
  - emails
  - move-in date

Supabase wiring:

- `owners`
- `occupancies`
- `units`
- `associations`
- `documents`

Status:

- Captured from saved screenshot.
- Needs terminology decision before implementation because screenshot uses tenant/lease language.

## New Association

Screenshot:

- Captured in chat, file not yet saved locally.

Layout:

- Left pane: Associations.
- Center pane: New Association form.
- Right pane: contextual Tasks/Help.

Center pane:

- Association Details
- Bank Accounts
- Recurring Charge Settings
- Management Fee
- Late Fee Policy
- Images / Photos
- Import Units and Homeowners Spreadsheet
- Save / Create Association

Supabase wiring:

- `associations`
- bank account tables
- GL/accounting tables
- `units`
- `owners`
- storage/upload tables or Supabase Storage

Status:

- Approved from screenshot.
- Not fully wired yet.

## Template

```markdown
## Screen Name

Screenshot:

![Screen Name](screenshots/YYYY-MM-DD-screen-name.png)

Layout:

- Left pane:
- Center pane:
- Right pane:

Center pane:

-

Right pane:

-

Supabase wiring:

-

Keep:

-

Remove:

-

Status:

-
```
