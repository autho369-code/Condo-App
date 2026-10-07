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
