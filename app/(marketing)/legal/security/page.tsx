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
        an audit trail.
      </p>

      <H2>Encryption</H2>
      <p>
        Data is encrypted in transit using industry-standard TLS. Payment details are handled by PCI-compliant
        third-party processors; we do not store full card or bank account numbers on our own infrastructure.
      </p>

      <H2>Infrastructure</H2>
      <p>
        The platform runs on established cloud infrastructure with automated backups and point-in-time recovery.
        Hosting and database providers maintain their own industry-recognized security certifications.
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
        so we can investigate promptly. We appreciate responsible disclosure.
      </p>

      <p className="!mt-10 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] text-gray-600">
        Security is an ongoing program, not a one-time state. This page describes current practices and may evolve as
        the platform grows.
      </p>

      <p className="!mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
        This document is a general template provided for convenience and is not legal advice. Portier369 recommends
        review by qualified legal counsel before relying on it for your business.
      </p>
    </LegalShell>
  )
}
