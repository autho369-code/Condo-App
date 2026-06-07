import Link from 'next/link';

export default function SettingsHelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-8 py-6">
      <header>
        <nav className="text-xs font-semibold uppercase tracking-wider text-ink-500">
          <Link href="/settings" className="hover:text-ink-700">Settings</Link>
          <span className="mx-2">/</span>
          Help
        </nav>
        <h1 className="mt-2 text-2xl font-semibold text-ink-900">Settings overview</h1>
        <p className="mt-1 text-sm text-ink-500">
          Configure your company profile, manage your team, and set default policies for all associations.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-ink-900">Company profile</h2>
        <p className="mt-1 text-sm text-ink-600">
          Your company name and phone number appear on owner statements, portal pages, and automated communications.
          The texting number enables SMS reminders and alerts — add one to keep owners informed in real time.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-900">NSF fee</h2>
        <p className="mt-1 text-sm text-ink-600">
          Set the fee charged when an owner&apos;s payment is returned by their bank. This amount is automatically
          added to the owner&apos;s ledger each time a payment fails. Most companies set this between $25 and $50.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-900">Payment reminders</h2>
        <p className="mt-1 text-sm text-ink-600">
          Define when automated reminders are sent relative to the assessment due date.
          Positive numbers send reminders before the due date; negative numbers send them after.
          For example: &ldquo;14, 7, 1, -7, -30&rdquo; sends reminders 14 days before, 7 days before, 1 day before,
          7 days after, and 30 days after the due date.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-900">Fiscal year &amp; statements</h2>
        <p className="mt-1 text-sm text-ink-600">
          Set which month your fiscal year begins — this affects all annual reporting and budget cycles.
          The statement generation day determines when monthly owner statements are automatically produced.
          Most companies generate statements on the 1st of each month.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-900">Security</h2>
        <p className="mt-1 text-sm text-ink-600">
          Enable multi-factor authentication (MFA) for portfolio admins to protect sensitive financial data.
          Extending MFA to all staff provides additional protection. Changes take effect on next login.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-900">Online payment fees</h2>
        <p className="mt-1 text-sm text-ink-600">
          Control how card processing fees are handled when owners pay online. You can absorb them,
          pass them through to the owner, split them, or add a flat convenience fee. The default industry
          practice is to pass card fees through to the owner while absorbing ACH fees.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-900">Managing your team</h2>
        <p className="mt-1 text-sm text-ink-600">
          Use the invite form to add staff members by email. Select the role that matches their responsibilities:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-600">
          <li><strong>President</strong> — Full access to all associations, financials, and team management.</li>
          <li><strong>Property Manager</strong> — Day-to-day operations: work orders, violations, owner communication.</li>
          <li><strong>Accountant</strong> — Financial access: bills, payments, bank reconciliation, GL accounts.</li>
          <li><strong>On-Site Manager</strong> — Maintenance and unit-level operations for assigned properties.</li>
          <li><strong>Leasing Agent</strong> — Owner onboarding, unit assignments, occupancy tracking.</li>
          <li><strong>Accounts Payable</strong> — Bill entry, vendor payments, check runs.</li>
        </ul>
        <p className="mt-3 text-sm text-ink-600">
          Each team member receives an email invitation. Once they accept, they appear in the team table
          where you can change their role or reset their password at any time. Removing a staff member
          immediately revokes their access.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-900">Late fees</h2>
        <p className="mt-1 text-sm text-ink-600">
          Late fee policies are set per association, not at the company level — because each HOA has its own
          governing documents and fee structure. Configure late fees when you set up or edit each association.
        </p>
      </section>

      <footer className="border-t border-ink-100 pt-4 text-xs text-ink-400">
        Need help with something not covered here? Contact your platform administrator.
      </footer>
    </div>
  );
}
