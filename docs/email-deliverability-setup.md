# Email Deliverability Setup — portier369.com (Resend domain authentication)

**Goal:** make invitation and notification emails from the app land in real
inboxes (Gmail, Outlook, etc.) instead of spam or being silently dropped. This
requires authenticating the `portier369.com` domain in Resend with SPF, DKIM,
and DMARC DNS records.

**Who runs this:** an operator with (a) login access to the Resend dashboard for
the account holding the `resend_api_key`, and (b) DNS edit access at the
registrar / DNS host for `portier369.com`.

> This is a runbook. The actual DKIM key values are generated per-domain and are
> account-specific — **copy the real values from the Resend dashboard**; the
> records shown here are *shapes/placeholders*, not literal values to paste.

---

## Ground truth — how this app sends mail (verified in code)

- The app queues every outbound email into the `email_queue` table via
  `lib/email/queue.ts`.
- The default sender is **`hello@portier369.com`** (display name `Portier369`);
  a no-reply variant **`noreply@portier369.com`** is also used.
  - `lib/email/queue.ts:11-13` — `EMAIL_FROM`, `EMAIL_FROM_NOREPLY`, `EMAIL_FROM_NAME`.
- A cron drains `email_queue` (status `pending`) → `process-email-queue` edge
  function → `send-email` edge function → Resend API (`https://api.resend.com/emails`).
  - `send-email` `DEFAULT_FROM = "hello@portier369.com"`; Resend key read from
    Supabase Vault secret `resend_api_key` first, falling back to the
    `RESEND_API_KEY` env secret.
- `process-email-queue` **suppresses seed/test recipient domains** before they
  reach Resend (`example.com/.org/.net/.edu`, `test.com`, `email.com`,
  `localhost`, `invalid`, `portier369.test`). Real `@portier369.com` and real
  external recipients (e.g. `@gmail.com`) are **not** suppressed.

So the **domain that must be authenticated in Resend is `portier369.com`** — it
must own/verify both `hello@` and `noreply@` senders, which it does automatically
once the domain is authenticated (Resend verifies the *domain*, not individual
mailboxes).

---

## Checklist

### Phase 1 — Add the domain in Resend

- [ ] **1.1** Log in to the Resend dashboard for the account whose API key is in
      the Supabase Vault as `resend_api_key`.
      (If unsure it's the right account: in Resend → **API Keys**, confirm a key
      exists; the secret value in Vault must belong to *this* account.)
- [ ] **1.2** Go to **Domains** → **Add Domain**.
- [ ] **1.3** Enter the domain exactly: `portier369.com`
      (the bare apex domain — do **not** enter `mail.portier369.com` or
      `www.portier369.com`; the app sends from `@portier369.com`).
- [ ] **1.4** Choose the **region** closest to where the app/users live
      (e.g. `us-east-1` / North Virginia for US). The region only affects where
      Resend sends from; pick one and keep it.
- [ ] **1.5** Resend now displays a list of DNS records to add. **Leave this
      page open** — you will copy each value from here in Phase 2–4.
      Resend issues, per domain:
      - **DKIM** — typically one or more `CNAME` records (Resend's current
        default), OR a `TXT` record on older setups. The host/name looks like
        `resend._domainkey` (or `<selector>._domainkey`) and the value is a
        long generated string / target hostname. **These are unique to your
        domain — copy them verbatim from the dashboard.**
      - **SPF** — a `TXT` (and sometimes a `MX`) record for a Resend
        subdomain used for the Return-Path / bounce handling
        (e.g. host `send` → `MX` to `feedback-smtp.<region>.amazonses.com` +
        `TXT` `v=spf1 include:amazonses.com ~all`). Copy what the dashboard shows.

> Why "copy from dashboard": DKIM public keys and the exact SPF include host are
> generated for *your* account/domain. Do not invent them. The sections below
> describe the **record types and shapes** so you know what you're looking at and
> where to put them.

### Phase 2 — SPF (TXT record)

SPF authorizes Resend's servers to send mail "as" your domain. Resend's DNS list
will show the exact include host; it is almost always `amazonses.com` (Resend
sends through Amazon SES infrastructure).

- [ ] **2.1** At your DNS registrar, find the SPF record for the host Resend
      specified. Resend usually applies SPF to a **subdomain** it controls (e.g.
      `send.portier369.com`), in which case you add the record exactly as shown
      with no conflict against the apex.
- [ ] **2.2** If Resend instead asks you to put SPF on the **apex** (`@` /
      `portier369.com`), obey the **single-SPF-record rule**: a domain may have
      **only one** `v=spf1` TXT record. If one already exists, **merge** the
      includes into it — do not add a second `v=spf1` record.
      - Example merged apex SPF (only if you already had Google + now add Resend):
        ```
        Type:  TXT
        Host:  @   (or portier369.com)
        Value: v=spf1 include:_spf.google.com include:amazonses.com ~all
        ```
      - If there is **no** existing SPF and Resend wants it on the apex:
        ```
        Type:  TXT
        Host:  @   (or portier369.com)
        Value: v=spf1 include:amazonses.com ~all
        ```
      - Use `~all` (soft-fail) to start; tighten to `-all` (hard-fail) only after
        you've confirmed all legitimate senders are included.
- [ ] **2.3** Add the SPF `TXT` **exactly as Resend shows it** (host + value).
      Do not add `amazonses.com` manually if Resend's record already covers it on
      its own subdomain.

### Phase 3 — DKIM (CNAME, sometimes TXT)

DKIM cryptographically signs each message so receivers can verify it wasn't
forged or altered. Resend generates the key pair; you publish the public half.

- [ ] **3.1** In the Resend domain page, copy each **DKIM** record. Modern Resend
      issues **CNAME** records. The shape is:
      ```
      Type:  CNAME
      Host:  resend._domainkey            (copy EXACT host from Resend)
      Value: <generated>.dkim.amazonses.com   (copy EXACT target from Resend)
      ```
      There may be **two or three** such CNAMEs (e.g. `resend._domainkey`,
      `resend2._domainkey`, `resend3._domainkey`) — add **all** of them.
- [ ] **3.2** If your DNS host shows an older **TXT** DKIM record instead, the
      shape is:
      ```
      Type:  TXT
      Host:  resend._domainkey
      Value: p=MIGfMA0GCSq...   (long base64 public key — copy EXACT from Resend)
      ```
      (Do not type a fake `p=` value — it must be the dashboard's generated key.)
- [ ] **3.3** At the registrar, add each record with the host/name and value
      copied verbatim. **Do not append your domain to the host** if your DNS UI
      already appends it automatically — i.e. enter `resend._domainkey`, not
      `resend._domainkey.portier369.com`, unless your provider requires the FQDN.
- [ ] **3.4** Some hosts strip or "flatten" CNAMEs at the apex; that's fine — DKIM
      CNAMEs are on subdomains (`*._domainkey`), not the apex.

### Phase 4 — DMARC (TXT record)

DMARC tells receivers what to do when SPF/DKIM fail and where to send reports.
Start permissive (monitor only), then tighten once reports look clean.

- [ ] **4.1** Add a starter DMARC record (monitor mode, with aggregate reports):
      ```
      Type:  TXT
      Host:  _dmarc            (i.e. _dmarc.portier369.com)
      Value: v=DMARC1; p=none; rua=mailto:dmarc-reports@portier369.com; fo=1; adkim=s; aspf=s
      ```
      - `p=none` — monitor only; do nothing to failing mail yet.
      - `rua=mailto:...` — where aggregate XML reports go. Use a real mailbox you
        can read (e.g. `dmarc-reports@portier369.com` or your own address).
      - `adkim=s; aspf=s` — strict alignment (sender domain must match exactly).
        If reports show legit mail failing alignment, relax to `r` (relaxed).
- [ ] **4.2** After ~1–2 weeks of clean reports (all your real mail passing
      SPF+DKIM), tighten to quarantine:
      ```
      v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@portier369.com; adkim=s; aspf=s
      ```
- [ ] **4.3** Once quarantine is stable, move to full enforcement:
      ```
      v=DMARC1; p=reject; rua=mailto:dmarc-reports@portier369.com; adkim=s; aspf=s
      ```
- [ ] **4.4** There must be **exactly one** `_dmarc` TXT record. If one already
      exists, edit it — don't add a second.

### Phase 5 — Verify

- [ ] **5.1** **In Resend:** go back to **Domains → portier369.com** and click
      **Verify** (or wait for auto-check). Status must read **Verified** for the
      domain and a green check next to SPF/DKIM/DMARC.
      - DNS propagation can take minutes to a few hours. If it stays "Pending,"
        re-check the records for typos / extra trailing dots / wrong host.
- [ ] **5.2** **Independent DNS checks** (do not rely only on Resend):
      - SPF:   `https://mxtoolbox.com/spf.aspx` → enter `portier369.com`
      - DKIM:  `https://mxtoolbox.com/dkim.aspx` → domain `portier369.com`,
               selector `resend` (or the selector Resend used)
      - DMARC: `https://mxtoolbox.com/dmarc.aspx` → enter `portier369.com`
      - From a shell you can also run:
        ```
        nslookup -type=TXT portier369.com
        nslookup -type=CNAME resend._domainkey.portier369.com
        nslookup -type=TXT _dmarc.portier369.com
        ```
- [ ] **5.3** **Mail-tester end-to-end (provider level):** go to
      https://www.mail-tester.com, copy the one-time `test-xxxxx@srv1.mail-tester.com`
      address it shows, and send a test from Resend (Dashboard → **Send test
      email** from the verified domain, or via the API) to that address. Aim for
      **10/10**; confirm SPF=pass, DKIM=pass, DMARC=pass.
- [ ] **5.4** **App-level end-to-end (the real proof):** trigger an actual
      invitation from the running app to an external inbox you control
      (e.g. a Gmail address):
      1. Log in as Platform Operator / Manager and invite a new user using a real
         Gmail address (NOT an `@example.com` / seed address — those are
         suppressed by `process-email-queue`).
      2. Wait for the cron to drain the queue (the dispatcher runs on a short
         interval). Confirm in Supabase that the `email_queue` row flipped from
         `pending` → `sent` (and `sent_at` is set). If it shows `failed` with
         "suppressed", you used a seed domain — retry with a real one.
      3. In Gmail, open the received message → **Show original**. Confirm:
         - `SPF: PASS`
         - `DKIM: PASS` (signed by `portier369.com`)
         - `DMARC: PASS`
         - The message landed in **Inbox**, not Spam.

### Phase 6 — App-side checklist (confirm code ↔ DNS match)

- [ ] **6.1** **From-address matches the authenticated domain.** Code sends from
      `hello@portier369.com` / `noreply@portier369.com`
      (`lib/email/queue.ts:11-13`, and `send-email` `DEFAULT_FROM`). The
      authenticated Resend domain is `portier369.com`, so both senders are
      covered. If you ever change the sender domain in code, re-authenticate that
      new domain in Resend or mail will fail.
- [ ] **6.2** **Seed-domain suppression won't block real sends.**
      `process-email-queue` only suppresses `example.com/.org/.net/.edu`,
      `test.com`, `email.com`, `localhost`, `invalid`, `portier369.test`. Real
      recipient domains (Gmail, etc.) pass through. **Do not add any real
      customer domain to that suppression list.** (Source: `process-email-queue`
      edge function, `SUPPRESSED_DOMAINS`.)
- [ ] **6.3** **Vault key is set.** Confirm the Supabase Vault secret
      `resend_api_key` exists and holds a valid key for the **same** Resend
      account where `portier369.com` was just verified. The `send-email` function
      reads Vault first (`get_vault_secret('resend_api_key')`), then falls back to
      the `RESEND_API_KEY` env secret. A key from a *different* Resend account
      will not be allowed to send as the verified domain.
- [ ] **6.4** **Reply-To sanity.** If you want replies to reach a real mailbox,
      ensure invites set a `reply_to` to a monitored address; otherwise replies
      go to `noreply@`/`hello@`.

---

## Quick reference — records to add

| Purpose | Type  | Host (name)                  | Value (copy real value from Resend)                         |
|---------|-------|------------------------------|-------------------------------------------------------------|
| SPF     | TXT   | as Resend shows (often `send`) | `v=spf1 include:amazonses.com ~all` (one v=spf1 per host)  |
| DKIM    | CNAME | `resend._domainkey` (+more)  | `<generated>.dkim.amazonses.com` (exact target from Resend) |
| DKIM*   | TXT   | `resend._domainkey`          | `p=<generated public key>` (only if Resend issues TXT DKIM) |
| DMARC   | TXT   | `_dmarc`                     | `v=DMARC1; p=none; rua=mailto:dmarc-reports@portier369.com` |

\* DKIM is CNAME on current Resend; older/alternate setups use TXT — use whichever
the dashboard shows. Never invent the `p=` key value.

**Single-record rules:** one `v=spf1` TXT per host, one `_dmarc` TXT — merge,
never duplicate.

**Done when:** Resend shows **Verified**, mail-tester scores ~10/10, and a real
app invitation to a Gmail address lands in the Inbox with SPF/DKIM/DMARC all
passing.
