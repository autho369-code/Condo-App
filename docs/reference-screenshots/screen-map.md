# AppFolio Reference Screen Map

This file maps each approved reference screenshot to Portier UI and Supabase wiring.

## Screens

| Status | Screenshot | Left Pane | Center Pane | Right Pane | Supabase Wiring |
| --- | --- | --- | --- | --- | --- |
| Captured in chat | Associations directory | Associations | Association list with name, address, unit count, pagination | Calendar, Tasks, Reports, Statements, Help Topics | `associations`, `units` aggregate |
| Captured in chat | New Association | Associations > New Association | Association details, bank accounts, recurring charge settings, management fee, late fee policy, images, import units/homeowners, save | Help topics / contextual tasks | `associations`, bank/GL tables, units, owners, uploads |

## Template For New Screens

```markdown
### Screen Name

![Screen Name](images/YYYY-MM-DD-screen-name.png)

- Left pane:
- Center pane:
- Right pane:
- Required Supabase tables:
- Actions:
- Keep:
- Remove:
- Status:
```
