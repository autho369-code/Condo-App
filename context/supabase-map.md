# Supabase Map

This file tracks which Supabase tables are used, renamed, removed, or pending review.

No schema changes should be made from this file alone. It is an audit and approval map.

## Canonical Root

| Table | Status | Notes |
| --- | --- | --- |
| `associations` | Keep | Main HOA/condo association record. |
| `units` | Keep | Units belong to associations. |
| `owners` | Keep | Homeowners/owners connected to units and associations. |

## Needs Review

| Table/View | Suspected Issue | Proposed Direction | Approval |
| --- | --- | --- | --- |
| `property_groups` | Property terminology conflicts with Association-only direction. | Rename to `association_groups` or remove if unused. | Pending |
| `buildings` | May represent old property workflow. | Decide whether to keep as optional physical structure under Association. | Pending |
| `association_lease_template_settings` | Lease workflow excluded from Association setup. | Remove/deprecate after data dependency check. | Pending |
| `association_renewal_options` | Renewal workflow excluded from Association setup. | Remove/deprecate after data dependency check. | Pending |
| `report_data_property_directory` | Property terminology. | Rename/replace with association/unit directory report. | Pending |

## Cleanup Rule

Before removing anything:

1. Find all UI/code references.
2. Check if the table has real data.
3. Confirm replacement table or workflow.
4. Create migration.
5. Verify app behavior.
6. Update this map.
