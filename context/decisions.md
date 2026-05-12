# Approved Decisions

## Product Direction

- Portier is an HOA and condominium association management system.
- Use **Association** as the canonical business object.
- Do not use rental/lease workflows in the Association setup flow unless explicitly approved later.
- Keep the three-pane app pattern:
  - left pane: static navigation
  - center pane: active work area
  - right pane: contextual Tasks
- Do not add a fourth column.

## Workflow Rules

- Wire one screen at a time.
- Use screenshots as source material when available.
- Do not change user-facing copy unless the user asks for copy changes.
- Do not remove Supabase tables or columns without a keep/remove review first.
- Preserve data during schema cleanup unless the user explicitly approves destructive deletion.

## Current Association Setup Decision

The New Association center form should include:

- Association Details
- Bank Accounts
- Recurring Charge Settings
- Management Fee
- Late Fee Policy
- Images / Photos
- Import Units and Homeowners Spreadsheet
- Save / Create Association

Exclude:

- rental fields
- lease settings
- lease templates
- renewal options
