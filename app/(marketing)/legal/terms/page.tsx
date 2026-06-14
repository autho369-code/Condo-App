import type { Metadata } from 'next'
import { LegalShell, H2 } from '../_components'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing use of the Portier369 platform and services.',
  alternates: { canonical: '/legal/terms' },
}

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="June 13, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Portier369 platform, websites, and
        related services (the &quot;Services&quot;). By accessing or using the Services, you agree to these Terms. If you are
        using the Services on behalf of an organization, you represent that you are authorized to bind that
        organization.
      </p>

      <H2>The Services</H2>
      <p>
        Portier369 provides software for community association and property management, including accounting, work
        orders, violations, communications, and owner, board, and vendor portals. Access is provided on a subscription
        basis and is governed by the order or agreement between Portier369 and the subscribing management company
        (&quot;Customer&quot;).
      </p>

      <H2>Accounts and access</H2>
      <p>
        Accounts are provisioned by invitation. You are responsible for maintaining the confidentiality of your
        credentials and for all activity under your account. You must provide accurate information and promptly notify
        us of any unauthorized use. Access is role-based; you agree to use only the access granted to you.
      </p>

      <H2>Acceptable use</H2>
      <p>
        You agree not to misuse the Services, including by attempting to gain unauthorized access, interfering with
        operation or security, uploading unlawful or infringing content, reverse engineering the platform except as
        permitted by law, or using the Services to violate the rights of others or any applicable law.
      </p>

      <H2>Customer data</H2>
      <p>
        As between the parties, Customers own the association and property data they submit. Portier369 processes that
        data to provide the Services in accordance with our{' '}
        <a href="/legal/privacy" className="text-[#1E3A5F] underline underline-offset-2">Privacy Policy</a> and the
        applicable Customer agreement. Customers are responsible for the accuracy and lawfulness of data they submit and
        for obtaining any necessary consents.
      </p>

      <H2>Payments and fees</H2>
      <p>
        Subscription fees are set out in your order. Payment processing for assessments and other transactions is
        handled by third-party providers subject to their own terms. Except as required by law or expressly stated,
        fees are non-refundable.
      </p>

      <H2>Third-party services</H2>
      <p>
        The Services may integrate with third-party providers (for hosting, payments, email, SMS, and optional AI
        features). Your use of those integrations may be subject to the third parties&apos; terms, and Portier369 is not
        responsible for third-party services.
      </p>

      <H2>Intellectual property</H2>
      <p>
        The Services, including all software, design, and content provided by Portier369, are owned by Portier369 and
        protected by intellectual-property laws. We grant you a limited, non-exclusive, non-transferable right to use
        the Services during your subscription, subject to these Terms.
      </p>

      <H2>Disclaimers</H2>
      <p>
        The Services are provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, whether express or
        implied, including merchantability, fitness for a particular purpose, and non-infringement, to the maximum
        extent permitted by law. Portier369 does not provide legal, accounting, or tax advice; you are responsible for
        compliance with the laws governing your associations.
      </p>

      <H2>Limitation of liability</H2>
      <p>
        To the maximum extent permitted by law, Portier369 will not be liable for any indirect, incidental, special,
        consequential, or punitive damages, or for lost profits or data, arising out of or relating to the Services.
        Our aggregate liability for any claim is limited to the amounts paid for the Services in the twelve months
        preceding the claim.
      </p>

      <H2>Termination</H2>
      <p>
        Either party may terminate as provided in the applicable subscription agreement. Upon termination, your right to
        use the Services ends, and Customers may export their data in accordance with their agreement before deletion.
      </p>

      <H2>Changes to these Terms</H2>
      <p>
        We may update these Terms from time to time. Material changes will be reflected by the &quot;Last updated&quot; date
        above and, where appropriate, additional notice. Continued use after changes take effect constitutes
        acceptance.
      </p>

      <H2>Contact</H2>
      <p>
        Questions about these Terms can be sent to{' '}
        <a href="mailto:hello@portier369.com" className="text-[#1E3A5F] underline underline-offset-2">hello@portier369.com</a>.
      </p>

      <p className="!mt-10 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
        This document is a general template provided for convenience and is not legal advice. Portier369 recommends
        review by qualified legal counsel before relying on it for your business.
      </p>
    </LegalShell>
  )
}
