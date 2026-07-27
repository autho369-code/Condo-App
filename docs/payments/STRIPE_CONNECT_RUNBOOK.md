# Stripe Connect Standard operations

## Non-negotiable payment boundary

Portier uses Stripe Connect Standard with **one association-owned connected
account for each association**. An acct_... value may belong to exactly one
associations.id; the partial unique index on
associations.stripe_account_id is a release-critical control.

All Checkout, AutoPay, refund lookup, payout, and reconciliation API calls must
run as direct charges in that association's connected-account context by
sending the Stripe-Account: acct_... header. Money belongs to the association
and settles from its Stripe balance to its own verified bank account.

The following designs are prohibited:

- Destination charges, transfer_data, transfers, or a shared platform balance.
- Portier receiving, holding, pooling, or routing association funds.
- Reusing or moving a connected account between associations.
- Accepting, logging, emailing, or storing card numbers, CVCs, bank credentials,
  or other raw payment account data. Payment details must be entered only in
  Stripe-hosted Checkout or onboarding.

If the association/account boundary cannot be proven, fail closed and do not
create, update, refund, settle, or post a payment.

## Current production launch gate

A read-only production audit on 2026-07-26 verified:

- Associations: **2**
- Associations with a connected Stripe account: **0**
- Associations with charges enabled: **0**
- Live payment intents and active AutoPay mandates: **0**

Online payments are therefore not live. Both associations must independently
complete the per-association checklist below. Do not treat platform Stripe
configuration alone as payment readiness.

## Environment configuration

Store values only in the deployment secret manager. Never commit or paste
secret values into tickets, logs, screenshots, documentation, or chat.

| Variable | Production requirement |
| --- | --- |
| STRIPE_SECRET_KEY | Server-only live secret for Portier's Connect platform |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Matching live publishable key; this is the only client-visible Stripe key |
| STRIPE_WEBHOOK_SECRET | Server-only signing secret for the production Connect webhook endpoint |
| STRIPE_LIVEMODE | Exactly true in production |
| NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_PORTAL_URL | Canonical HTTPS URLs used for return and success links |

Configure the Connect webhook at /api/stripe/webhook to receive events from
connected accounts. Subscribe at minimum to:

- checkout.session.completed
- payment_intent.succeeded
- payment_intent.payment_failed
- charge.refunded
- charge.dispute.created
- payout.created
- payout.paid
- payout.failed
- account.updated
- account.application.deauthorized

The endpoint must verify the Stripe-Signature against the unmodified request
body and the environment's own webhook secret. It must reject an event whose
livemode does not match STRIPE_LIVEMODE, or whose event.account does not map
uniquely to the same association and processor account as the local row.

Preview/test uses test keys, a test webhook secret, and
STRIPE_LIVEMODE=false. It must use isolated non-production association and
payment data; never write a test connected-account ID into a production
association row. Never send test events to the live endpoint or replay live
events into preview.

## Onboard one association

The platform operator performs these steps separately for every association:

1. Confirm the legal association record and the authorized association
   representative. Do not collect tax or bank data for Stripe.
2. From the association payment settings, create one Standard connected
   account. Confirm its metadata contains the intended association and
   portfolio IDs.
3. Confirm the returned acct_... is stored once and is not already assigned
   to another association. Never overwrite a different existing account ID.
4. Generate a single-use Stripe Account Link. The association representative
   completes Stripe-hosted onboarding, including legal entity, EIN, controller,
   and settlement bank details directly with Stripe.
5. Refresh status from Stripe after the representative returns. A completed
   redirect is not proof of readiness.
6. Keep Pay Online and AutoPay disabled until all of these are true:
   details_submitted, charges_enabled, and payouts_enabled; no
   requirements.disabled_reason; no stripe_deauthorized_at; and the
   connected account is in the same live/test mode as the environment.
7. Record the operator, association, account ID suffix, timestamp, and evidence
   of the readiness checks without recording secret or payment credentials.

If requirements later become due, charges or payouts become disabled, or the
application is deauthorized, immediately disable new payments and AutoPay for
that association until Stripe again reports a fully ready account.

## Per-association go-live checklist

Complete and retain this evidence independently for each association:

- [ ] Correct legal association and authorized representative confirmed.
- [ ] Unique Standard acct_... mapped to exactly this association.
- [ ] Connected-account metadata matches association and portfolio IDs.
- [ ] details_submitted=true.
- [ ] charges_enabled=true.
- [ ] payouts_enabled=true.
- [ ] No disabled reason or deauthorization timestamp.
- [ ] Association-owned settlement bank confirmed in Stripe; local settlement
      account mapping reviewed.
- [ ] Production live key, publishable key, webhook secret, and
      STRIPE_LIVEMODE=true validated without exposing their values.
- [ ] Connect webhook delivery for this event.account succeeds and is recorded
      once; signature, mode, account, association, amount, currency, and local
      intent checks all pass.
- [ ] A minimum-value live card payment is approved by the association, posts
      exactly once to the correct owner/unit ledger, and sends the correct
      receipt.
- [ ] A minimum-value live ACH payment is approved and remains pending until
      Stripe reports settlement; no early ledger duplication occurs.
- [ ] Refund/adjustment workflow is tested or tabletop-reviewed with finance.
- [ ] First payout is traced from Stripe balance transactions to only this
      association's intents and then to its bank-feed deposit.
- [ ] Any mismatch produces needs_review and no silent cross-association or
      guessed reconciliation.
- [ ] AutoPay remains disabled until its mandate, customer, payment method,
      run, PaymentIntent, and webhook all carry the same connected account.
- [ ] Association officer and Portier operations sign off.

Go live one association at a time. Monitor the first payment, first ACH
settlement, and first payout before enabling the next association.

## Daily payment operations

### Collections and AutoPay

- Create the local payment attempt first, then use its immutable ID in Stripe
  metadata and the idempotency key.
- Resolve the association's account from trusted server-side tenant data; never
  accept an account ID from browser input.
- Send every Stripe request with that account's Stripe-Account header.
- On a timeout or retryable indeterminate response, retry only with the same
  idempotency key. Never create a replacement attempt until the original is
  conclusively resolved.
- Webhooks, not browser redirects, determine final settlement. Duplicate or
  out-of-order events must remain idempotent.

### Refunds

Issue a refund only from the affected association's Standard Stripe dashboard
or an account-scoped server operation, after finance verifies the owner, amount,
original charge, and association. The refund webhook records a processor
adjustment; finance must post and approve the corresponding owner-ledger
adjustment. Partial refunds require the same review. Never refund a charge found
only by an unscoped Stripe ID.

### Disputes

charge.dispute.created places the payment into chargeback review. Notify the
association's authorized finance contact, respond with evidence in that
association's Stripe dashboard before Stripe's deadline, and post any required
ledger adjustment under dual review. Do not use another association's
documents, funds, or Stripe balance to answer or cover the dispute.

### Payouts and reconciliation

Treat Stripe's connected-account balance transactions as the authoritative
membership of a payout. For each payout:

1. Require event.account to map to one association.
2. Read the payout and its balance transactions using the same Stripe-Account
   header.
3. Match only successful local intents with that association ID, processor
   account ID, and Stripe charge ID.
4. Compare Stripe's net balance-transaction total to the payout amount.
5. Match the payout to that association's configured bank-feed deposit.
6. Mark mismatches, missing charges, conflicting payout attribution, missing
   settlement accounts, or failed payouts needs_review/failed; do not guess,
   pool associations, or force a match.

Finance reviews processor adjustments, failed payments, disputes, refunds,
unmatched deposits, and needs_review payouts daily. Engineering monitors
failed webhook events and stale processing/AutoPay attempts.

## Offboarding an association

1. Disable new Checkout and AutoPay before changing access.
2. Stop future AutoPay runs while preserving mandate and transaction evidence.
3. Resolve or explicitly transfer responsibility for pending ACH payments,
   refunds, disputes, negative balances, reserves, and payouts.
4. Reconcile through the final Stripe payout and bank deposit, and export the
   association's Stripe and Portier reports according to retention policy.
5. Have the association control or disconnect its Standard account. Process
   account.application.deauthorized as an immediate payment disable.
6. Preserve the historical account mapping and processor IDs for audit. Never
   assign the old acct_... to another association and never delete financial
   history to make an offboard appear complete.

## Incident response

For suspected account crossover, secret exposure, forged webhook, duplicate
posting, unexplained payout, or unauthorized charge:

1. Stop new payments and AutoPay for the affected association(s). If scope is
   unknown, disable the payment integration globally.
2. Preserve Stripe request IDs, event IDs, connected account IDs, timestamps,
   logs, and affected local row IDs. Do not copy raw payment credentials.
3. Do not repair a mismatch by editing account IDs, replaying unsigned payloads,
   deleting events, or manually duplicating ledger posts.
4. Compare the signed event's account, livemode, object IDs, metadata, amount,
   and currency to the immutable local attempt and association.
5. For webhook handler failures, return a failure so Stripe can retry; after the
   defect is fixed, replay only the original verified Stripe event and confirm
   idempotent results.
6. For key or webhook-secret exposure, rotate the affected environment's
   credential in Stripe and the deployment secret manager, redeploy, verify
   signature rejection/acceptance, and review events during the exposure
   window.
7. Keep payout mismatches and refunds/disputes in review until finance approves
   the association-specific ledger correction.
8. Document scope, owner impact, funds impact, containment, evidence, corrective
   entries, notifications, and sign-off before re-enabling the association.

No payment incident is closed until Stripe, the Portier ledger, the
association's bank activity, and the owner ledger agree.
