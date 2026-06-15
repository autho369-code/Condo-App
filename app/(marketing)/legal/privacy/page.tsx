import type { Metadata } from 'next'
import { LegalShell, H2 } from '../_components'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Portier369 collects, uses, and protects personal information.',
  alternates: { canonical: '/legal/privacy' },
}

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="June 14, 2026">
      <p>
        This Privacy Policy explains how Portier369 (&quot;Portier369,&quot; &quot;we,&quot; &quot;us&quot;) collects, uses, discloses, and
        safeguards information when you use our property management platform and related websites and services
        (collectively, the &quot;Services&quot;). By using the Services, you agree to the practices described here.
      </p>

      <H2>Who we are and our role</H2>
      <p>
        Portier369 provides software to community association and property management companies (&quot;Customers&quot;). For most
        information processed in the platform — owner records, payments, communications, and association data — the
        Customer is the data controller and Portier369 acts as a data processor on the Customer&apos;s behalf, under our
        agreement with them. If you are a homeowner, board member, or vendor, please also review your management
        company&apos;s own privacy notice.
      </p>

      <H2>Information we collect</H2>
      <p>
        <strong>Account information:</strong> name, email address, phone number, role, and login credentials.
        <br />
        <strong>Association and property data:</strong> units, ownership records, ledgers, assessments, violations,
        work orders, documents, and related records entered by Customers.
        <br />
        <strong>Payment information:</strong> processed through our third-party payment providers; we do not store full
        card or bank numbers on our own servers.
        <br />
        <strong>Communications:</strong> emails, SMS, and notices sent through the platform.
        <br />
        <strong>Usage and device data:</strong> log data, IP address, browser type, and activity within the Services,
        used to operate, secure, and improve the platform.
      </p>

      <H2>How we use information</H2>
      <p>
        We use information to provide and maintain the Services; authenticate users and enforce role-based access;
        process payments and send transactional communications; provide support; detect and prevent fraud and abuse;
        comply with legal obligations; and improve and develop new features. We do not sell personal information.
      </p>

      <H2>How we share information</H2>
      <p>
        We share information with the Customer organization you belong to; with service providers who process data on
        our behalf (such as hosting, payment processing, email, and SMS delivery) under contractual confidentiality and
        security obligations; when required by law or to protect rights and safety; and in connection with a merger,
        acquisition, or sale of assets, subject to this Policy.
      </p>

      <H2>Data security</H2>
      <p>
        We use technical and organizational measures to protect information, including row-level security enforced at
        the database layer, encryption in transit, role-based access controls, and audit logging. No method of
        transmission or storage is completely secure, and we cannot guarantee absolute security. See our{' '}
        <a href="/legal/security" className="text-[#1E3A5F] underline underline-offset-2">Security</a> page for more.
      </p>

      <H2>Data retention</H2>
      <p>
        We retain information for as long as needed to provide the Services and as required by our agreements with
        Customers and applicable law. Customers control retention of their association data and may request export or
        deletion in accordance with their agreement.
      </p>

      <H2>Your rights</H2>
      <p>
        Depending on your jurisdiction, you may have rights to access, correct, delete, or port your personal
        information, or to object to or restrict certain processing. Because we often act as a processor, please direct
        requests to your management company; we will assist them as required. You may also contact us at the address
        below.
      </p>

      <H2>Children&apos;s privacy</H2>
      <p>The Services are not directed to children under 16, and we do not knowingly collect their personal information.</p>

      <H2>Changes to this Policy</H2>
      <p>
        We may update this Policy from time to time. Material changes will be reflected by the &quot;Last updated&quot; date
        above and, where appropriate, additional notice.
      </p>

      <H2>Contact us</H2>
      <p>
        Questions about this Policy can be sent to{' '}
        <a href="mailto:hello@portier369.com" className="text-[#1E3A5F] underline underline-offset-2">hello@portier369.com</a>.
      </p>

      <p className="!mt-10 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
        This document is a general template provided for convenience and is not legal advice. Portier369 recommends
        review by qualified legal counsel before relying on it for your business.
      </p>
    </LegalShell>
  )
}
