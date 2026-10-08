# How Mirsad works

Back to [[Home]]. Follow these without being told.

- He says **"go to next gap"** → take the top item in [[Status]] → *Next gaps*
  and build it. Be fast and direct. **No options menus. Do not ask what to
  work on.**
- Stay on Portier369 unless he says otherwise.
- Use the agents he built — see [[Agents]]. The **overseer** runs at the start
  of every task and before every PR; the matching reviewers run on every change
  before it is committed.
- Before saying what's next or done: read this vault, `CLAUDE.md` and all of
  `docs/TODO.md`. Never say "all done". Verify a TODO item's premise in the
  code before building it (see [[Decisions]]).
- Check chain before every push: `npm run typecheck`, `npm test` (also with
  `NEXT_PUBLIC_APEX_DOMAIN=example.test NEXT_PUBLIC_SITE_URL=http://localhost:3000`),
  `npm run lint`. Never push red.
- Record what shipped, new rules and the next gap in this vault and commit it
  with the work.
- Don't make him send files, screenshots or answers to build something. Use
  what he already sent (his real AppFolio exports, 2026-10-08) and build;
  don't keep his personal data in the repo (tests use made-up rows shaped
  like the real file). "stop overcomplicating" (2026-10-08).
