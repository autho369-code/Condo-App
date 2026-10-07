# Decisions

Back to [[Home]]. Don't redo these.

- **`'stripe'` stays in the `payment_processor` enum.** It is live: the Stripe
  Connect webhook saves payment methods with it and `select_payment_processor()`
  falls back to it. The old TODO item to drop it was withdrawn (2026-10-07).
- **Resale / estoppel certificate:** declined by Mirsad; build only if he asks.
- **Old `/platform/*` URLs** redirect permanently to `/platform-operator`
  (`next.config.mjs`), 2026-10-07.
- **Invitation emails** link to `<slug>.portier369.com` (sign-in rule); the
  Runbook link may use the verified custom domain.
- **Invitation tokens are always server-generated** (64 lowercase hex). Rows
  written through the API get a fresh token from the trigger and can't change
  it; a new SECURITY DEFINER RPC must never write a caller-supplied token.
- **Neutral company-name fallback stays "Your management company"**; blank
  names are now impossible (DB check + every settings action), so it is only a
  last resort.
- **Brand color is always #RRGGBB** (DB check; middleware falls back to
  #10B981) because it is sent to every page as a request header.
- **Server actions never fall back to a client-sent (bound) id** — use the
  caller's own portfolio and error if it's missing.
- **Destructive or access-changing one-click actions use `PendingSubmit` with
  `confirm`** (remove staff, send reset link, change role).
