# Supabase Map

This file tracks which Supabase tables are used, renamed, removed, or pending review.

No schema changes should be made from this file alone. It is an audit and approval map.

## Canonical Root

| Table | Status | Notes |
| --- | --- | --- |
| `associations` | Keep | Main HOA/condo association record. |
| `units` | Keep | Units belong to associations. |
| `owners` | Keep | Homeowners/owners connected to units and associations. |
| `occupancies` | Keep | Connects owners/homeowners to units and current/past status. |
| `vendors` | Keep | Vendor directory and vendor task workflows. |
| `email_queue` | Keep | Needed for homeowner email workflows. |
| `communication_messages` | Keep | Needed for communication history and outbound messages. |
| `documents` | Keep | Needed for forms, owner packets, vendor document requests, and generated documents. |
| `management_agreements` | Keep | Needed for owner/association management agreement workflows. |
| `vendor_compliance` | Keep | Needed for vendor documents and compliance tracking. |

## Needs Review

| Table/View | Suspected Issue | Proposed Direction | Approval |
| --- | --- | --- | --- |
| `property_groups` | Property terminology conflicts with Association-only direction. | Rename to `association_groups` or remove if unused. | Pending |
| `buildings` | May represent old property workflow. | Decide whether to keep as optional physical structure under Association. | Pending |
| `association_lease_template_settings` | Lease workflow excluded from Association setup. | Remove/deprecate after data dependency check. | Pending |
| `association_renewal_options` | Renewal workflow excluded from Association setup. | Remove/deprecate after data dependency check. | Pending |
| `report_data_property_directory` | Property terminology. | Rename/replace with association/unit directory report. | Pending |

## Screen Wiring

| Screen | Tables | Status |
| --- | --- | --- |
| Associations Directory | `associations`, `units` | Context mapped, implementation pending review. |
| Homeowners Directory | `owners`, `occupancies`, `units`, `associations` | UI simplified to screenshot structure. |
| Owners Directory | `owners`, `management_agreements`, `documents` | UI simplified to screenshot structure; deeper actions pending. |
| Vendors Directory | `vendors`, `vendor_compliance`, `documents`, `payment_methods` | UI simplified to screenshot structure; deeper actions pending. |
| Send Email Homeowners Modal | `owners`, `email_queue`, `communication_messages` | Captured, not implemented. |
| Move In Homeowner | `owners`, `occupancies`, `units`, `associations`, `documents` | Captured, terminology decision pending. |

## Cleanup Rule

Before removing anything:

1. Find all UI/code references.
2. Check if the table has real data.
3. Confirm replacement table or workflow.
4. Create migration.
5. Verify app behavior.
6. Update this map.
