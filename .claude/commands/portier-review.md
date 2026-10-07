---
description: Run the Portier369 review agents that match this branch's changes, fix what they find, and record lessons
argument-hint: "[optional files or folders to limit the review]"
---
Review the current Portier369 change with the project's review agents.

1. **Scope.** Run `node scripts/review-scope.mjs $ARGUMENTS`. If it prints
   nothing, say there is nothing to review and stop.
2. **Pick the agents** from the listed files (run every one that matches):
   - `app/**` or `components/**` pages/components → `design-reviewer`
   - server actions (`'use server'`), `app/api/**`, `lib/rpcs/**`,
     `lib/auth/**`, `lib/security/**`, `middleware.ts`, or any data read/write
     → `security-reviewer`
   - any `.from(` / `.rpc(` / `.select(` / `.insert(` / `.update(` change
     → `schema-checker`
   - `supabase/migrations/**` → `migration-reviewer`
   - user-facing text, emails, PDFs, links, metadata → `white-label-checker`
3. **Run them in parallel** (one message, several Agent calls), passing each
   the file list from step 1.
4. **Fix** every real finding, following `CLAUDE.md`. If a finding is wrong,
   don't change code; note why. Never apply DELETE/DROP SQL: list it for
   Mirsad to run in the SQL editor.
5. **Verify:** `npm run typecheck`, `npm test`, `npm run lint`.
6. **Teach the agents:** for each finding that was wrong, tell that agent why
   so it records the false alarm in its memory; for anything you or the
   checks caught that an agent missed, tell it to record the missed check.
7. **Report** in plain English: which agents ran, what was found and fixed,
   anything left for Mirsad, and the check results. Do not commit or push
   unless asked.
