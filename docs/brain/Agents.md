# Agents

Back to [[Home]]. Mirsad built these to oversee the work — **use them**.
Definitions in `.claude/agents/`, each with its own memory in
`.claude/agent-memory/<name>/MEMORY.md` (committed; they learn).

| Agent | When |
|---|---|
| **overseer** | Start of every task and before every PR: reads this vault, checks the plan/change against [[Product Rules]] and [[PR Rules]], says which reviewers must run, checks the vault was updated |
| design-reviewer | pages/components (`app/**`, `components/**`) |
| security-reviewer | server actions, API routes, data access, middleware, SQL functions |
| schema-checker | any `.from/.select/.insert/.update/.rpc` change |
| migration-reviewer | `supabase/migrations/**` |
| white-label-checker | user-facing text, emails, PDFs, links, metadata |

`/portier-review` runs the matching reviewers, fixes and verifies. When Codex,
CI or Mirsad catches something a reviewer missed, tell that reviewer so it
records the lesson, and commit that memory change with the PR. New agents
only load when a session starts.
