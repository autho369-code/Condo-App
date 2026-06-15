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
        agreement with them. For our own account, billing, marketing, and website information, Portier369 acts as a
        controller. If you are a homeowner, board member, tenant, or vendor, please also review your management
        company&apos;s own privacy notice, as they determine how your association data is used.
      </p>

      <H2>Information we collect</H2>
      <p>
        <strong>Account information:</strong> name, email address, phone number, role, and login credentials.
        <br />
        <strong>Association and property data:</strong> units, ownership and occupancy records, tenant and emergency-
        contact details, ledgers, assessments, violations, work orders, meeting and architectural records, and documents
        entered or uploaded by Customers (including lease and insurance documents stored in private, access-controlled
        storage).
        <br />
        <strong>Financial and banking data:</strong> double-entry accounting records, and — where a Customer connects a
        bank account — bank-account and transaction information obtained through our banking-data provider (Plaid). See
        &quot;Payments and financial data&quot; below.
        <br />
        <strong>Payment information:</strong> for subscription billing of management companies, billing contact and
        payment-method details are processed by our third-party billing provider; we do not store full card or bank
        account numbers on our own servers.
        <br />
        <strong>Communications:</strong> emails, SMS, and notices sent through the platform, and support correspondence.
        <br />
        <strong>Usage and device data:</strong> log data, IP address, browser type, and activity within the Services,
        used to operate, secure, and improve the platform.
      </p>

      <H2>How we use information</H2>
      <p>
        We use information to provide and maintain the Services; authenticate users and enforce role-based access;
        process billing and send transactional communications; provide support; detect and prevent fraud and abuse;
        comply with legal obligations; and improve and develop new features. We do not sell or share personal
        information for cross-context behavioral advertising.
      </p>

      <H2>Payments and financial data</H2>
      <p>
        Portier369 does not collect online card payments from homeowners. Resident assessments are paid to the
        management company offline and recorded by a manager; the platform reconciles those payments against the
        association&apos;s books. We store no homeowner cardholder data.
      </p>
      <p>
        Where a Customer chooses to connect a bank account, we use <strong>Plaid</strong> to link the account and
        retrieve transaction information for reconciliation. Plaid holds the banking credentials; Portier369 receives
        account and transaction data, not login credentials. Plaid&apos;s handling of end-user information is described in
        the{' '}
        <a href="https://plaid.com/legal/#end-user-privacy-policy" className="text-[#1E3A5F] underline underline-offset-2">
          Plaid End User Privacy Policy
        </a>
        . Subscription billing of management companies is handled by our billing provider subject to its own terms.
      </p>

      <H2>Artificial-intelligence features</H2>
      <p>
        Some optional features use artificial-intelligence (&quot;AI&quot;) services on a bring-your-own-key basis. When a
        Customer enables these features, it configures its own AI provider (for example, OpenAI, Anthropic, DeepSeek, or
        a compatible provider) using the Customer&apos;s own account and credentials. Content submitted to those features —
        which may include uploaded documents, images (such as insurance certificates), or association records — is
        transmitted to the provider the Customer selected, solely to generate the requested output. The Customer
        selects the provider and is responsible for that provider&apos;s terms, including any data-use or model-training
        terms. AI output may be inaccurate and should not be relied upon as legal, accounting, tax, or compliance
        advice.
      </p>

      <H2>How we share information</H2>
      <p>
        We share information with the Customer organization you belong to; with the sub-processors described below, who
        process data on our behalf under contractual confidentiality and security obligations; when required by law or
        legal process or to protect rights, property, and safety; and in connection with a merger, acquisition, or sale
        of assets, subject to this Policy.
      </p>

      <H2>Sub-processors</H2>
      <p>We engage the following categories of sub-processors to provide the Services:</p>
      <ul className="list-disc space-y-1 pl-6">
        <li><strong>Supabase</strong> — database, authentication, and file storage.</li>
        <li><strong>Vercel</strong> — application hosting and content delivery.</li>
        <li><strong>Resend</strong> — transactional and bulk email delivery.</li>
        <li><strong>Plaid</strong> — bank-account connectivity and transaction data (where enabled by a Customer).</li>
        <li><strong>Our subscription-billing provider</strong> — billing of management-company subscriptions.</li>
        <li>
          <strong>Customer-selected AI provider</strong> — only where a Customer enables AI features and provides its
          own credentials (see &quot;Artificial-intelligence features&quot;).
        </li>
        <li><strong>SMS provider</strong> — text-message delivery, where SMS features are used.</li>
      </ul>
      <p>
        A current list of sub-processors is available on request at{' '}
        <a href="mailto:hello@portier369.com" className="text-[#1E3A5F] underline underline-offset-2">hello@portier369.com</a>.
      </p>

      <H2>Data security</H2>
      <p>
        We use technical and organizational measures to protect information, including row-level security enforced at
        the database layer, encryption in transit and at rest, role-based access controls, audit logging, and signed,
        time-limited URLs for stored documents. No method of transmission or storage is completely secure, and we
        cannot guarantee absolute security. See our{' '}
        <a href="/legal/security" className="text-[#1E3A5F] underline underline-offset-2">Security</a> page for more.
      </p>

      <H2>Security incident notification</H2>
      <p>
        We maintain an incident-response process. In the event of a personal-data breach affecting Customer data, we
        will notify the affected Customer without undue delay after becoming aware, consistent with the Data Processing
        Addendum and applicable law, and will cooperate with the Customer&apos;s own notification obligations.
      </p>

      <H2>Data retention and deletion</H2>
      <p>
        We retain information for as long as needed to provide the Services and as required by applicable law and our
        agreements with Customers. Customers control the retention of their association data. Following termination of a
        Customer agreement, association data is deleted or returned within sixty (60) days, subject to legal retention
        requirements and routine backup cycles; residual copies in backups are deleted on our regular backup rotation.
      </p>

      <H2>Data Processing Addendum</H2>
      <p>
        Where Portier369 processes personal data on a Customer&apos;s behalf, our Data Processing Addendum (&quot;DPA&quot;) governs
        that processing and is incorporated into the Customer agreement. The DPA addresses processing instructions,
        confidentiality, sub-processor flow-down, security, breach notification, and deletion or return of data.
        Customers may request the DPA at the contact address below.
      </p>

      <H2>International data transfers</H2>
      <p>
        The Services are intended for Customers and associations located in the United States, and information is
        processed in the United States. If you access the Services from outside the United States, you understand that
        your information will be processed in the United States, where data-protection laws may differ from those of
        your location.
      </p>

      <H2>Your privacy rights</H2>
      <p>
        Depending on your jurisdiction, you may have rights to access, correct, delete, or port your personal
        information, or to object to or restrict certain processing. Because we often act as a processor, please direct
        requests concerning association data to your management company; we will assist them as required. For
        information we hold as a controller, contact us at the address below. We will not discriminate against you for
        exercising these rights.
      </p>

      <H2>California privacy rights (CCPA/CPRA)</H2>
      <p>
        If you are a California resident, you have the right to know the categories and specific pieces of personal
        information we collect, the purposes for collection, and the categories of recipients; to request correction or
        deletion; and to limit the use of sensitive personal information. We do not sell personal information and do not
        share it for cross-context behavioral advertising. You may exercise these rights, or use an authorized agent to
        do so, by contacting us at the address below; where we act as a processor, we will route your request to the
        relevant Customer (the business) and assist them.
      </p>

      <H2>Other U.S. state privacy rights</H2>
      <p>
        Residents of states with comprehensive privacy laws (including Virginia, Colorado, Connecticut, Utah, Texas,
        and others) may have similar rights to access, correct, delete, and obtain a copy of their personal information,
        and to appeal a declined request. Because Portier369 typically processes association data on behalf of a
        Customer who is the controller, please direct such requests to your management company; we will support them in
        responding.
      </p>

      <H2>Cookies and analytics</H2>
      <p>
        We use strictly necessary cookies for authentication and security, and we may use privacy-conscious,
        aggregated usage analytics provided by our hosting platform to operate and improve the Services. We do not use
        third-party advertising cookies.
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
        Questions about this Policy, or requests to exercise your rights, can be sent to{' '}
        <a href="mailto:hello@portier369.com" className="text-[#1E3A5F] underline underline-offset-2">hello@portier369.com</a>.
      </p>

      <p className="!mt-10 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
        This Privacy Policy is a working draft prepared for review by qualified legal counsel and may be updated before
        and after it is relied upon. It is provided for transparency and is not legal advice.
      </p>
    </LegalShell>
  )
}
