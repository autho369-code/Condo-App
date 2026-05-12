# Production-Real Core Cleanup Design

## Goal

Turn the current Condo-App branch from a broad scaffold into a credible working product slice for daily HOA/property-management operations.

## First Slice

The first production slice is core property management plus whole-app cleanup:

- Keep the primary staff workflows visible: dashboard, communication center, calendar, associations, owners, tenants, vendors, accounting, work orders, violations, reports, surveys, settings.
- Stop advertising modules that are only "Coming soon" as normal navigation destinations.
- Make placeholder UI honest: unfinished actions should be disabled, removed, or labeled as future work outside the main workflow.
- Preserve all existing uncommitted implementation work and build on it instead of rewriting the app.
- Add focused verification so we can prove the app builds and the navigation contract does not regress.

## Architecture

The app stays on the existing Next.js App Router + Supabase model:

- Server Components and server actions remain the default for data-backed routes.
- Supabase RLS remains the source of access control.
- The staff shell remains `app/(app)/layout.tsx` with `components/nav/sidebar.tsx`.
- Generic workspace shell components stay in `components/workspace`.

The first cleanup focuses on the shell and route surface because that is what makes the app feel finished or unfinished immediately. Data-heavy workflow fixes will follow route by route after this surface is honest.

## Navigation Rules

The sidebar should show production-usable staff routes by default. Routes backed by `ComingSoon` should be hidden from primary nav until they have a real list/detail workflow and backing schema.

For this slice, hide these from primary navigation:

- `/forms`
- `/inventory`
- `/projects`
- `/unit-turns`

Keep routes that have real list/detail or query-backed pages even if they still need polish:

- `/work-orders`
- `/recurring-work-orders`
- `/purchase-orders`
- `/fixed-assets`
- `/letters`
- `/inbox`
- `/send-email`

## Placeholder Rules

Placeholder pages can remain reachable by direct URL for future planning, but they should not be presented as finished features. Reusable placeholder components should use plain wording and should not look like an error state.

Decorative controls that imply behavior should be removed unless they actually work. The context panel close glyph should be removed in this slice because the panel is server-rendered and not dismissible.

## Verification

This slice is complete when:

- `npm run build` passes.
- A focused navigation test proves hidden routes are absent from the primary nav config.
- A focused workspace component test proves placeholder pages are labeled as unavailable/future work.
- The uncommitted worktree still contains the user's existing feature changes; only intentional files are edited.

## Out Of Scope

This slice does not build the full forms engine, inventory system, project budgeting module, or unit-turn workflow. Those need schema and workflow specs before implementation.
