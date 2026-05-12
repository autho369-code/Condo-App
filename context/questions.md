# Open Questions

Use this file for questions that must be answered before implementation.

## Supabase Cleanup

- Should `buildings` remain as a future optional physical-structure table under associations, or be removed from the active workflow?
- Should `property_groups` be renamed to `association_groups`, or removed entirely if grouping is not needed?
- Should `association_lease_template_settings` and `association_renewal_options` be removed after confirming no production data depends on them?
- Should `report_data_property_directory` be renamed to association/unit language, or replaced by a new report view?

## Screens

- Which AppFolio left-pane screen should be mapped after Associations?
