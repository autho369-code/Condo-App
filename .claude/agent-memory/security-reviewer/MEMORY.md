# security-reviewer memory

## Confirmed rules (Mirsad)
- Owners, vendors and board never see manager notes or change anything; the board portal is read-only.

## Recurring mistakes
- `communications_log` RLS only checks `portfolio_id`: writes into another association pass RLS unless `managesAssociation` is checked (see `lib/rpcs/notifications.ts`).
- Service-client undo/cleanup must be pinned to the exact row id plus `portfolio_id`.
