import type { Metadata } from 'next'
import { LegalShell, H2 } from '../_components'

export const metadata: Metadata = {
  title: 'Security',
  description: 'How Portier369 protects your association and owner data.',
  alternates: { canonical: '/legal/security' },
}

export default function SecurityPage() {
  return (
    <LegalShell title="Security" updated="June 14, 2026">
      <p>
        Portier369 manages sensitive financial and personal data for community associations. Protecting that data is
        foundational to the platform. This page summarizes the measures we use; we are happy to discuss specifics with
        prospective Customers under NDA.
      </p>

      <H2>Tenant isolation</H2>
      <p>
        Every database query is governed by row-level security enforced at the database layer. Access is scoped to a
        user&apos;s portfolio and role, so one management company can never access another&apos;s data, and owners, board
        members, and vendors only see what their role permits.
      </p>

      <H2>Access control</H2>
      <p>
        Accounts are invitation-based and role-based, following the principle of least privilege. Administrative and
        platform-operator actions are separated from association accounting, and sensitive operations are recorded in
        an audit trail. We encourage strong, unique credentials and are expanding multi-factor authentication options.
      </p>

      <H2>Encryption</H2>
      <p>
        Data is encrypted in transit using industry-standard TLS and encrypted at rest by our infrastructure providers.
        Sensitive integration secrets are held in a dedicated secrets vault. Resident assessment payments are made
        offline, so we do not collect or store homeowner card or bank account numbers on our own infrastructure.
      </p>

      <H2>Banking data</H2>
      <p>
        Where a Customer connects a bank account for reconciliation, connectivity is provided by Plaid. Plaid holds the
        banking login credentials; Portier369 receives account and transaction data through access tokens and does not
        store online banking credentials. Reconciliation does not move money.
      </p>

      <H2>AI data processing</H2>
      <p>
        Optional AI features operate on a bring-your-own-key basis: when a Customer enables them, content such as
        uploaded documents or images is transmitted to the AI provider the Customer selected and configured with its
        own credentials, solely to produce the requested output. Customers control whether these features are enabled
        and which provider receives their data. See our{' '}
        <a href="/legal/privacy" className="text-[#1E3A5F] underline underline-offset-2">Privacy Policy</a> for details.
      </p>

      <H2>Infrastructure and certifications</H2>
      <p>
        The platform runs on established cloud infrastructure (including Supabase and Vercel) whose providers maintain
        their own industry-recognized security certifications, such as SOC 2. Portier369 does not yet hold its own
        independent certification; we describe our practices honestly and will update this page as our program matures.
      </p>

      <H2>Backups and recovery</H2>
      <p>
        The platform uses automated backups and point-in-time recovery so data can be restored after an incident.
        Backups are retained on a rolling schedule and aged out over time. Production resident data is not committed to
        source control.
      </p>

      <H2>Sub-processor security</H2>
      <p>
        We engage a limited set of sub-processors (listed in our Privacy Policy) and require them, by contract, to
        maintain security obligations consistent with those described here.
      </p>

      <H2>Incident response</H2>
      <p>
        We maintain an incident-response process. If a security incident affects Customer data, we will investigate,
        take steps to contain and remediate it, and notify affected Customers without undue delay, consistent with our
        Data Processing Addendum and applicable law.
      </p>

      <H2>Data portability</H2>
      <p>
        Your data belongs to you. Customers can export their records at any time, and there is no vendor lock-in on your
        association data.
      </p>

      <H2>Reporting a vulnerability</H2>
      <p>
        If you believe you have found a security issue, please contact us at{' '}
        <a href="mailto:hello@portier369.com" className="text-[#1E3A5F] underline underline-offset-2">hello@portier369.com</a>{' '}
        with enough detail to reproduce it. We will acknowledge your report, investigate promptly, and keep you informed.
        We will not pursue legal action against researchers who act in good faith, avoid privacy violations and service
        disruption, and give us a reasonable opportunity to remediate before public disclosure.
      </p>

      <p className="!mt-10 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] text-gray-600">
        Security is an ongoing program, not a one-time state. This page describes current practices and may evolve as
        the platform grows.
      </p>
    </LegalShell>
  )
}
