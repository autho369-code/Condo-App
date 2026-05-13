# Portier Completion Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Portier feel like a working, premium property-management application with reports as the flagship workflow.

**Architecture:** Keep the current Next.js App Router and Supabase SSR patterns. Prioritize executable workflows over broad placeholders: visible actions must route, submit, download, or be clearly marked as future work. Use Portier's own brand and information architecture rather than copying AppFolio's UI or text.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase Postgres/Auth/RLS, Vitest.

---

### Task 1: Reports Command Center

**Files:**
- Modify: `app/(app)/reports/page.tsx`
- Modify: `app/(app)/reports/[slug]/page.tsx`
- Modify: `lib/rpcs/reports.ts`
- Create: `app/(app)/reports/runs/[id]/download/route.ts`
- Create: `lib/reports/exporter.ts`
- Create: `lib/reports/generator.ts`
- Create: `lib/reports/routing.ts`
- Test: `tests/reports/routing.test.ts`
- Test: `tests/reports/exporter.test.ts`

- [x] Write failing tests for report routing and CSV export helpers.
- [x] Implement canonical report slugs, CSV serialization, and download URL helpers.
- [x] Wire legacy `?slug=` links and hyphen slugs to canonical report routes.
- [x] Add CSV generation and a report-run download route.
- [x] Limit visible export choices to the verified CSV path.
- [x] Verify all live Supabase report definitions open locally and generate CSV data without mutating live rows.

### Task 2: Scheduled Reports

**Files:**
- Create: `lib/reports/schedule.ts`
- Create: `lib/rpcs/scheduled-reports.ts`
- Create: `app/(app)/scheduled-reports/new/page.tsx`
- Test: `tests/reports/schedule.test.ts`

- [x] Write failing tests for next-run schedule calculation.
- [x] Implement UTC next-run calculation for daily, weekly, biweekly, monthly, quarterly, and annual schedules.
- [x] Add a scheduled-report creation page and server action.
- [x] Keep scheduled exports on the live CSV path.

### Task 3: Route And Placeholder Cleanup

**Files:**
- Modify: `components/workspace/context-panel.tsx`
- Modify: `scripts/audit-local-links.mjs`
- Modify: `docs/placeholder-inventory.md`

- [x] Reclassify future task links as placeholders instead of broken routes.
- [x] Keep `/scheduled-reports/new` as a real route.
- [x] Run `npm run check:routes` and commit the regenerated inventory.

### Task 4: Project Status And Remaining Gaps

**Files:**
- Modify: `docs/PROJECT_STATUS.md`

- [x] Update stale project status claims.
- [x] Record verified report status and remaining migration/RLS gap.
- [x] Keep AppFolio references framed as category expectations, not copied design.

### Task 5: Final Verification And Publish

**Files:**
- No code files expected.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run check:routes`.
- [ ] Run `npm run check:dashboard-text`.
- [ ] Push `codex/reports-hardening` to GitHub.
