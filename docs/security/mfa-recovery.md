# MFA recovery runbook

Use the in-product recovery path first. A management-company administrator can reset a manager from **Company Admin → Managers → Manager → Reset MFA**. A platform administrator can reset non-operator users from **Platform Operator → Users**, and another platform administrator can reset an operator from **Platform Operator → Operators**. Every reset requires confirmation and writes authorization and completion audit events.

Platform operators must never reset their own MFA in the application. Maintain at least two active platform administrators so recovery remains available when one loses an authenticator.

## Break-glass recovery

Use this only when no second platform administrator can sign in. The incident responder must have approved service-role access and an incident or support ticket.

1. Confirm the target user ID and email in Supabase Auth.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the exact environment in the current terminal. Never paste either value into a ticket, chat, or command history.
3. Run:

   `npm run security:mfa-recover -- --project-ref <project-ref> --user-id <auth-user-uuid> --confirm-email <target-email> --actor-email <responder-email> --reason <ticket-id>`

4. Confirm the command reports completion and that `audit_logs` contains `mfa_break_glass_authorized` and `mfa_break_glass_completed` for the target.
5. Ask the user to sign in on the correct apex or tenant workspace and enroll a new authenticator. Do not send or receive TOTP secrets.
6. Close the incident only after the new enrollment creates `mfa_enrolled` and the old factor no longer appears.

The script refuses a project-reference mismatch or target-email mismatch, writes the authorization event before removing factors, and does not print credentials or factor secrets.
