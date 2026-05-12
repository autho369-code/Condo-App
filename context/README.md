# Portier Shared Context

This is the local working context folder for the project.

Use this folder for material that both the user and Codex need to share while building Portier:

- approved screenshots
- screen-by-screen notes
- Supabase wiring
- keep/remove decisions
- open questions
- the front-to-back project graph

This folder is the working memory. App code should not be changed from assumptions in chat alone; important decisions should be captured here first.

## Folder Map

- `screenshots/` - saved reference screenshots.
- `screen-map.md` - what each screen should contain in the left, center, and right panes.
- `supabase-map.md` - tables, relationships, and cleanup status.
- `decisions.md` - approved product/data decisions.
- `questions.md` - open questions before implementation.
- `project-graph.md` - front-end to Supabase wiring graph.

## Screenshot Naming

Use PNG files and this naming pattern:

```text
YYYY-MM-DD-module-screen-name.png
```

Examples:

```text
2026-05-12-associations-directory.png
2026-05-12-associations-new.png
2026-05-12-dashboard.png
```

After adding a screenshot, log it in `screen-map.md`.
