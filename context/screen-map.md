# Screen Map

This file maps each approved reference screen to Portier behavior and Supabase wiring.

## Associations Directory

Screenshot:

- Captured in chat, file not yet saved locally.

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

- Approved from screenshot.
- Not fully wired yet.

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
