# Association-Only System Design

## Purpose

Portier is an HOA and condominium association management system. The product should use **Association** as the primary business object everywhere. The previous "Property" direction came from the wrong AppFolio workflow and should be replaced with the AppFolio HOA-style association workflow.

The immediate focus is the **New Association** workflow, but the terminology rule applies across the UI, routes, reports, and future Supabase schema work.

## Canonical Language

Use "Association" everywhere the system means a managed HOA, condominium association, or community association.

Approved replacements:

- New Property -> New Association
- Properties -> Associations
- Property Name -> Association Name
- Property Type -> Association Type, only if a type field remains useful
- Property Groups -> Association Groups
- Property Directory -> Association Directory
- property_groups -> association_groups
- property_group_id -> association_group_id
- property_type -> association_type, only if the field remains useful
- /platform/properties -> /platform/associations

"Property" should not appear in the operational UI for association setup, association directories, navigation, contextual task panes, or error messages. If "property management" appears in marketing copy, it should be reviewed separately and changed to "association management" unless there is a deliberate SEO reason to keep it.

## Layout Rule

Every operational page must keep the agreed three-pane structure:

1. Static left navigation.
2. Center work area where the selected module's work happens.
3. Right contextual Tasks pane.

There must not be a fourth activity or workflow column. Activity belongs in the center work area. Contextual actions belong in the right Tasks pane.

## New Association Workflow

The New Association page should be modeled on AppFolio's HOA association flow, not the larger rental/property-management form.

The center work area contains one continuous form with a single save/create action. The approved sections are:

1. **Association Details**
   - Association Name, required.
   - Address, required.
   - Address 2, optional.
   - City, state, and zip.
   - Lockbox ID, optional.

2. **Bank Accounts**
   - Cash GL account, required when accounting is configured.
   - Bank account, required when accounting is configured.
   - Ability to add another bank account row.

3. **Recurring Charge Settings**
   - Start date.
   - GL account.
   - Frequency.

4. **Management Fee**
   - Fee type: flat or percent.
   - Fee amount or percent.
   - Minimum fee.
   - Maximum fee.
   - Optional "waive fee when vacant" style setting only if it maps to association accounting needs.

5. **Late Fee Policy**
   - Fee type: flat or percent.
   - Fee amount or percent.
   - Eligible charge basis.
   - Grace period setting.
   - Optional settings can be collapsed under the section, but still live in the center form.

6. **Images / Photos**
   - Upload one or more association photos.
   - Store images against the association record.
   - Show pending uploads before save when possible.

7. **Import Units and Homeowners Spreadsheet**
   - Download template action.
   - Upload drop zone for units and homeowner data.
   - Import can be completed after association creation if the backend requires an association id first.

8. **Save / Create Association**
   - One primary save button at the bottom of the center form.
   - The button creates the association and any included child records that can be safely persisted in one flow.

Explicit exclusions from this first workflow:

- Rental information.
- Lease settings.
- Lease templates.
- Renewal options.
- Tenant-oriented lease fees.
- Property-management-only fields that do not help HOA association setup.

## Right Tasks Pane

The right pane changes based on the selected left navigation module. For New Association it should contain contextual links only, such as:

- Import a New Association.
- Add bank account.
- Add GL account.
- Upload association photos.
- Help topics.

The right pane should not duplicate the center form and should not hold required create-association fields.

## Supabase Data Model Direction

The `associations` table is the canonical root record for the managed community.

Schema work should preserve existing data, then remove or rename misleading property terminology. The preferred migration pattern is:

1. Rename tables and columns when they hold association data.
2. Preserve row data during renames.
3. Update application code to use the new association names.
4. Remove UI references to the old property terminology.
5. Avoid destructive drops until the replacement path is verified.

Expected schema direction:

- `associations` remains the root table.
- `property_groups`, if used for grouping associations, becomes `association_groups`.
- `property_group_id`, if attached to associations, becomes `association_group_id`.
- `property_type`, if still needed, becomes `association_type`; otherwise remove it from the New Association workflow.
- Rental and lease-specific association columns should not be surfaced in the new workflow. If they are unused and unsafe to keep long-term, they should be deprecated in a later cleanup migration after data review.
- Photos should be stored through the existing file/storage pattern if one exists. If no pattern exists, use Supabase Storage with RLS policies tied to the association access model.
- Bank account and GL account selections should use existing accounting tables where possible rather than inventing placeholder data.
- Import uploads should create or stage units and homeowners under the association.

All Supabase work must keep RLS enabled for exposed tables and must verify migrations against the current Supabase CLI or MCP documentation before implementation.

## Data Flow

1. User opens New Association from the Associations module or right Tasks pane.
2. The page loads accounting options, GL accounts, bank accounts, and upload constraints.
3. User completes the center form.
4. Save validates required association fields first, then accounting fields that are required by current configuration.
5. The backend creates the association root record.
6. The backend creates related records for bank-account mappings, recurring charges, fees, late fee policy, and image metadata/uploads where applicable.
7. Spreadsheet import either stages during save or runs immediately after the association id exists.
8. User lands on the new association detail page or association directory with a clear success state.

## Error Handling

Validation errors should use association language. Examples:

- "Association Name is required."
- "Could not create association."
- "Select a bank account or remove the extra bank account row."
- "Upload failed. The association was created, but photos need to be added again."

Partial failures should not silently discard successful work. If photos or spreadsheet import fail after the association is created, keep the association and explain what needs another attempt.

## Testing

Implementation should include focused tests for:

- No "New Property" or operational "Property" language on the New Association route.
- New Association form renders the approved sections.
- Rental and lease sections are absent.
- The page keeps the three-pane layout without a fourth column.
- Save calls the association creation path with association-named fields.
- Supabase migration preserves existing association data during property-to-association renames.
- RLS policies continue to protect association, upload, and accounting records.

## Rollout

Implementation should happen in a controlled sequence:

1. Rename visible UI labels and routes to Association.
2. Replace the current New Property/New Association form with the approved center form.
3. Wire the form to existing Supabase data where available.
4. Add or migrate schema fields only where the approved form requires them.
5. Verify locally in the in-app browser at desktop width.
6. Run automated tests and production build.
7. Commit and push to `main` only after verification passes.

## Approval State

Approved design decisions:

- Association is the canonical business object.
- No rental or lease sections in the Association setup flow.
- Management fee, late fee policy, and images stay in the center form.
- The page has one save/create action.
- The application keeps the three-pane layout: left navigation, center work area, right Tasks pane.
