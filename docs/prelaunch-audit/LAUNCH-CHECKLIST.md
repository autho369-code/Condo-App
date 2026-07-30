# Launch checklist

- [ ] Approve migration recovery plan; record all remote/local versions.
- [ ] Test migrations on a restored staging copy; take and verify a production backup.
- [ ] Verify tenant/RLS matrix for every role and two associations.
- [ ] Run payment webhook duplicate, ordering, refund, dispute, and autopay isolation tests in Stripe test mode.
- [ ] Verify each association has its own enabled Stripe connected account before accepting a charge.
- [ ] Confirm Plaid, Resend, SMS provider, cron, AI, and rate-limit secrets in Preview and Production.
- [ ] Run CI commands from `TEST-RESULTS.md`; attach artifacts.
- [ ] Reconcile all financial reports to source journals and control accounts using disposable staging data.
- [ ] Verify scheduled-report queue, storage downloads, retention, and authorization.
- [ ] Obtain owner/legal sign-off for legal pages and pilot one management company before broad launch.
