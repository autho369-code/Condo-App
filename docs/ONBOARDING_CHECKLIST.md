# Onboarding Checklist — bringing a new client live on Portier369

A repeatable sequence for onboarding a management company and its first
association(s). Roughly top-to-bottom; each step notes **who** does it and
**where**. Paths checked 2026-06-22; payments, tenants, SMS, remittance and
the chart-of-accounts step updated 2026-10-31.

---

## 0. Before you start (gather from the client)
- [ ] Company legal name + branding (logo optional), billing contact email
- [ ] Plan tier (Foundation / Growth / Portfolio / Enterprise)
- [ ] For each association: name, building(s), and a **unit roster** (unit #s)
- [ ] **Owners list** → fill the CSV template (Step 4)
- [ ] **Opening balances** per unit (current A/R) → fill the CSV template (Step 5)
- [ ] Where owners send payments (payee + mailing address) → remittance (Step 6)
- [ ] *(optional)* The client's own AI provider + API key, if they want AI features

---

## 1. Operator: create the company  *(Platform Operator)*
- [ ] `/platform-operator/companies` → **Create company** (name + first admin email).
      This provisions the portfolio and queues the company-admin invite.
- [ ] Set the **plan/limits** on the company detail page (`/platform-operator/companies/[id]`).
- [ ] If the admin didn't get the email, use **Send Reset** / **Set temporary
      password** on that page, or copy the invite link.

> Login entry points for the client: `/login` → **Company Admin** / **Operator**
> buttons, or the standard role tabs.

## 2. Company admin accepts + signs in  *(Company Admin)*
- [ ] Accept the `/invite` link → set password → lands on `/company-admin/overview`.
- [ ] Add managers if needed (`/company-admin/managers` → invite; optionally scope
      each manager to specific associations).
- [ ] **Chart of accounts** — only the company admin can enter it: `/gl-accounts`
      → New GL account, or import the previous system's chart on
      `/owners/import/previous-system`. Managers post to it but can't change it.

## 3. Create the association(s) + buildings  *(Manager / Company Admin)*
- [ ] Create the association (`/associations` → new).
- [ ] Add at least one **building** (units attach to a building). The CSV importer
      will auto-create a "Main" building if none exists, but creating it explicitly
      is cleaner.

## 4. Import owners & units  *(Manager)*  — `/owners/import` (Owners & Units tab)
- [ ] Pick the target association.
- [ ] **Download template** → fill: `unit_number, owner_first_name,
      owner_last_name, owner_email, owner_phone, ownership_pct, monthly_dues,
      move_in_date`.
- [ ] Upload → review the **row-by-row preview** (fix any flagged rows) → Import.
      Creates units (find-or-create by number), owners, and occupancies + dues.
- [ ] Spot-check `/owners` and a unit or two.

## 5. Import opening balances  *(Manager)*  — `/owners/import` (Opening Balances tab)
- [ ] **Download template** → fill: `unit_number, opening_balance, as_of_date, memo`.
- [ ] Upload → preview → Import. Posts each as a charge so each unit's **A/R is
      correct from day one** (verify on `/charges` or a unit's ledger).

## 6. Set payment / remittance instructions  *(Manager, per association)*
- [ ] Association profile → **Payment Instructions**: payee, mailing address, notes.
      Owners see this on `/portal/pay` ("How to Pay"); without it they see
      "contact your management company." Payments recorded by the manager
      (check, ACH, Zelle) auto-apply to charges. Online card/ACH payments and
      AutoPay work once the platform Stripe keys are set and the association
      connects its own Stripe account (association → Payments tab).

## 7. *(Optional)* Turn on AI features  *(Company Admin)* — `/settings/ai`
- [ ] Set the client's AI provider + API key (bring-your-own-key). Enables:
      AI violation letters, the communications copilot, and the Portfolio
      Assistant (`/assistant`). Without a key these show a "configure AI" link.

## 8. Invite the people  *(Manager)*
- [ ] **Owners** → portal activation (owner gets a `/invite` link → `/portal`).
- [ ] **Board members** → mark an owner as a board member (on the New Owner form
      or the association's Board tab) → they get `/board` (financials, approvals,
      minutes, etc.).
- [ ] **Vendors** → invite to portal from `/vendors` (lands on `/vendor`).
- [ ] **Tenants** → optional portal login at `/resident` (invite from the
      owner's page → Occupancy section); otherwise reachable by email.

## 9. Operator: bill the company  *(Platform Operator)* — `/platform-operator/billing`
- [ ] Once: enter Portier369's ACH payment details on this page (the invoice
      email can't be sent without them).
- [ ] **Generate invoice** (defaults to the plan price) → **Send** (emails the
      billing contact with the ACH details) → company pays by ACH → **Mark paid**.

## 10. Verify it's live
- [ ] Manager `/dashboard` shows real numbers (A/R, open work orders, bills).
- [ ] Board portal financials/delinquencies populate for a board member.
- [ ] An owner can sign in to `/portal`, see their balance + "How to Pay".
- [ ] Send a test email (`/send-email`) to a real external inbox and confirm it
      lands (deliverability is configured for portier369.com).

---

## Notes / current limitations
- **Online owner payments** (Stripe Connect, per association) are built but
  off until the platform Stripe keys are set in Vercel; until then owners pay
  offline and the manager records it.
- **SMS** sends through Twilio once the account's KYC and 10DLC registration
  are done; until then texts are recorded but not delivered. Email delivers
  via Resend.
- **Legal** pages (`/legal/*`) are drafted; have counsel sign off before the first
  paying client.
- **Platform remittance**: companies pay Portier369 by ACH; the details are
  entered once on `/platform-operator/billing` and go on every invoice and the
  company's Billing page (`/company-admin/billing`).
