# overseer memory

- Re-check Status → Next gaps against the final diff: a gap written before a
  fix in the same PR can already be done by it (2026-10-07, #238).
- Check the vault (docs/brain/) is committed in the same commit as the work —
  an untracked vault plus a staged delete of the old memory leaves no memory.
