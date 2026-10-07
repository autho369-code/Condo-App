# Portier369 — Second Brain

This folder is an **Obsidian vault** and the single memory for Portier369.
It lives in the repo, so it is the same for Mirsad, every Claude session and
every agent. Nothing here depends on a chat remembering anything.

**Open it in Obsidian:** Obsidian → "Open folder as vault" →
`C:\Users\autho\Portier369-current\docs\brain` (after `git pull`). Optional:
the community plugin *Obsidian Git* pulls changes automatically.

**How Claude uses it (automatic):**
- Every session start, `scripts/brain/session-start.mjs` (SessionStart hook in
  `.claude/settings.json`) loads every note here, the latest merges on main
  and the open boxes in `docs/TODO.md`.
- If a session commits work without a committed update to this vault, the Stop
  hook `scripts/brain/stop-guard.mjs` tells Claude to record it.
- The [[Agents|overseer agent]] runs at the start of every task and before
  every PR.

## Notes
- [[How Mirsad Works]] — read first; follow without being told
- [[Product Rules]] — standing rules for the product
- [[PR Rules]] — how changes ship
- [[Status]] — where things stand and the **next gaps**
- [[Shipped]] — log of merged work
- [[Decisions]] — choices made and why (don't redo them)
- [[Agents]] — overseer + review agents and when they run
- [[Sessions]] — where older history lives
- [[Connectors]] — business plugins / connectors
