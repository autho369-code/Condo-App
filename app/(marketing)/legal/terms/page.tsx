import type { Metadata } from 'next'
import { LegalShell, H2 } from '../_components'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing use of the Portier369 platform and services.',
  alternates: { canonical: '/legal/terms' },
}

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="June 14, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Portier369 platform, websites, and
        related services (the &quot;Services&quot;). By accessing or using the Services, you agree to these Terms. If you are
        using the Services on behalf of an organization, you represent that you are authorized to bind that
        organization. Portier369 is operated by [LEGAL ENTITY NAME], a [STATE] [entity type] (&quot;Portier369&quot;).
      </p>

      <H2>The Services</H2>
      <p>
        Portier369 provides software for community association and property management, including accounting, work
        orders, violations, communications, and owner, board, and vendor portals. Access is provided on a subscription
        basis and is governed by the order or agreement between Portier369 and the subscribing management company
        (&quot;Customer&quot;). If there is a conflict between these Terms and a signed order or master subscription agreement,
        the signed agreement controls.
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

      <H2>Customer data and ownership</H2>
      <p>
        As between the parties, Customers own the association and property data they submit (&quot;Customer Data&quot;).
        Portier369 processes Customer Data to provide the Services in accordance with our{' '}
        <a href="/legal/privacy" className="text-[#1E3A5F] underline underline-offset-2">Privacy Policy</a> and the
        applicable Customer agreement. Customers are responsible for the accuracy and lawfulness of data they submit and
        for obtaining any necessary consents. Customers grant Portier369 a limited license to host, process, and
        transmit Customer Data solely to provide and support the Services.
      </p>

      <H2>Data protection</H2>
      <p>
        Where Portier369 processes personal data on a Customer&apos;s behalf, our Data Processing Addendum (&quot;DPA&quot;) applies
        and is incorporated into the Customer agreement by reference. The DPA governs processing instructions,
        confidentiality, security, sub-processors, breach notification, and deletion or return of data.
      </p>

      <H2>Payments and fees</H2>
      <p>
        Subscription fees for the Services are set out in your order and, except as required by law or expressly stated,
        are non-refundable. The Services do not collect online card payments from homeowners; resident assessments are
        paid to the management company offline and recorded in the platform, and, where enabled, reconciled against
        bank-transaction data obtained through our banking-data provider. Subscription billing of management companies
        may be processed by a third-party billing provider subject to its own terms.
      </p>

      <H2>Third-party services</H2>
      <p>
        The Services may integrate with third-party providers (for hosting, banking data, email, SMS, and optional AI
        features). Your use of those integrations may be subject to the third parties&apos; terms, and Portier369 is not
        responsible for third-party services.
      </p>

      <H2>Artificial-intelligence features</H2>
      <p>
        Certain optional features use AI services that the Customer configures under the Customer&apos;s own provider account
        and credentials. The Customer is responsible for selecting its provider and reviewing that provider&apos;s terms,
        including any data-use or model-training terms. AI output may be inaccurate and must not be relied upon as legal,
        accounting, tax, or compliance advice; the Customer is responsible for reviewing AI output before relying on it.
        Portier369 makes no warranty as to the accuracy or suitability of AI output.
      </p>

      <H2>Service availability</H2>
      <p>
        We aim to keep the Services available but do not guarantee uninterrupted availability in these public Terms. Any
        committed service levels or uptime credits, if offered, are stated in the applicable order or master
        subscription agreement. We may perform maintenance and may modify or discontinue features from time to time.
      </p>

      <H2>Intellectual property</H2>
      <p>
        The Services, including all software, design, and content provided by Portier369, are owned by Portier369 and
        protected by intellectual-property laws. We grant you a limited, non-exclusive, non-transferable right to use
        the Services during your subscription, subject to these Terms.
      </p>

      <H2>Confidentiality</H2>
      <p>
        Each party may receive non-public information of the other (&quot;Confidential Information&quot;). The receiving party
        will use Confidential Information only to perform under these Terms, will protect it with reasonable care, and
        will not disclose it except to personnel and advisors bound by confidentiality obligations or as required by
        law. Customer Data is the Customer&apos;s Confidential Information.
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
        preceding the claim. These limitations do not apply to a party&apos;s indemnification obligations, breach of
        confidentiality, infringement of the other party&apos;s intellectual-property rights, a Customer&apos;s payment
        obligations, or a party&apos;s gross negligence or willful misconduct.
      </p>

      <H2>Indemnification</H2>
      <p>
        Portier369 will defend the Customer against third-party claims that the Services, as provided, infringe that
        third party&apos;s intellectual-property rights, and will indemnify the Customer for amounts finally awarded. The
        Customer will defend Portier369 against third-party claims arising from Customer Data or the Customer&apos;s use of
        the Services in violation of these Terms or applicable law, and will indemnify Portier369 for amounts finally
        awarded. Each indemnity is conditioned on prompt notice, reasonable cooperation, and control of the defense by
        the indemnifying party.
      </p>

      <H2>Term and termination</H2>
      <p>
        These Terms apply while you use the Services. Either party may terminate as provided in the applicable
        subscription agreement, and either party may terminate for the other&apos;s uncured material breach. Upon
        termination, your right to use the Services ends. Customers may export their Customer Data for thirty (30) days
        after termination, after which it is deleted or returned in accordance with the Privacy Policy and DPA.
        Provisions that by their nature should survive (including ownership, confidentiality, disclaimers, limitation of
        liability, indemnification, and dispute resolution) survive termination.
      </p>

      <H2>Governing law</H2>
      <p>
        These Terms are governed by the laws of the State of [GOVERNING-LAW STATE], without regard to its
        conflict-of-laws principles. Subject to the dispute-resolution section below, the state and federal courts
        located in [VENUE — county, state] have exclusive jurisdiction over any dispute not subject to arbitration, and
        the parties consent to that jurisdiction and venue.
      </p>

      <H2>Dispute resolution and arbitration</H2>
      <p>
        The parties will first attempt to resolve any dispute informally by contacting each other. If a dispute is not
        resolved within thirty (30) days, it will be resolved by binding arbitration administered by the American
        Arbitration Association under its Commercial Arbitration Rules, seated in [VENUE], except that either party may
        bring an individual claim in small-claims court or seek injunctive relief for misuse of the Services or
        intellectual property. To the extent permitted by law, disputes will be resolved on an individual basis, and
        the parties waive any right to participate in a class or representative action. If this class-action waiver is
        held unenforceable as to any claim, that claim will proceed in court.
      </p>

      <H2>Changes to these Terms</H2>
      <p>
        We may update these Terms from time to time. Material changes will be reflected by the &quot;Last updated&quot; date
        above and, where appropriate, additional notice. Continued use after changes take effect constitutes
        acceptance.
      </p>

      <H2>General</H2>
      <p>
        These Terms, together with any applicable order or subscription agreement and the documents they reference, are
        the entire agreement between the parties regarding the Services and supersede prior agreements on that subject.
        Neither party may assign these Terms without the other&apos;s consent, except to a successor in a merger or sale of
        substantially all assets. Neither party is liable for delays caused by events beyond its reasonable control
        (force majeure). If any provision is held unenforceable, the remaining provisions remain in effect. A failure to
        enforce a provision is not a waiver. Notices must be in writing and sent to the contact below or the contact in
        the applicable order.
      </p>

      <H2>Contact</H2>
      <p>
        Questions about these Terms can be sent to{' '}
        <a href="mailto:hello@portier369.com" className="text-[#1E3A5F] underline underline-offset-2">hello@portier369.com</a>.
      </p>

      <p className="!mt-10 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
        These Terms are a working draft prepared for review by qualified legal counsel. Bracketed items
        ([LEGAL ENTITY NAME], [STATE], [GOVERNING-LAW STATE], [VENUE]) must be completed with Portier369&apos;s corporate and
        jurisdiction details before publication. This draft is provided for transparency and is not legal advice.
      </p>
    </LegalShell>
  )
}
