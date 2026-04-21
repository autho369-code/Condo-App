// New Association — the legal / financial entity (HOA / Condo corporation).
//
// See PROJECT_HANDOFF.md §0. Association = legal and financial governance.
// Physical-asset fields (address, year built, site manager, amenities,
// maintenance info) are NOT here — they belong on the Building.
//
// After saving, the user is redirected to /buildings/new?association=<id>
// to add the first physical property under this legal entity.
import Link from 'next/link';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { createAssociation } from '@/lib/rpcs/entities';

export const dynamic = 'force-dynamic';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default async function NewAssociationPage() {
  const me = await requirePortfolioAdmin();
  const supabase = await createClient();

  // If the user has no assigned portfolio (platform operator or half-provisioned
  // staff), load the portfolios they can see via RLS so they can pick one.
  let portfolioOptions: Array<{ id: string; company_name: string }> = [];
  if (!me.portfolio?.id) {
    const { data } = await supabase.from('portfolios').select('id, company_name').order('company_name');
    portfolioOptions = data ?? [];
  }
  const needsPortfolioPicker = !me.portfolio?.id && portfolioOptions.length > 1;
  const autoPortfolioId = !me.portfolio?.id && portfolioOptions.length === 1 ? portfolioOptions[0].id : null;

  // No portfolio visible at all? The user is unprovisioned — surface a clear message
  // rather than a crash.
  if (!me.portfolio?.id && portfolioOptions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-10">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">No portfolio assigned</h1>
        <p className="text-sm text-gray-600">
          Your account isn&apos;t linked to a portfolio yet, so you can&apos;t create associations.
          Ask a platform operator to assign you to one (or to add you to <code>platform_operators</code>), then try again.
        </p>
        <div className="mt-4">
          <Link href="/dashboard" className="text-sm text-blue-700 hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-6">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">New Association</h1>
      <p className="mb-4 text-sm text-gray-500">
        Create the legal / financial entity first. After saving, you&apos;ll add the physical
        property (building, address, site manager, maintenance info) as a separate step.
      </p>

      <form action={createAssociation} className="space-y-4">

        {/* Portfolio target — hidden when the user has exactly one portfolio in
            scope; a picker when they can choose between several. */}
        {autoPortfolioId && <input type="hidden" name="portfolio_id" value={autoPortfolioId} />}
        {needsPortfolioPicker && (
          <Card>
            <CardTitle>Portfolio</CardTitle>
            <div className="space-y-3 px-5 py-4">
              <Row label="Target Portfolio" required help="Which portfolio should this association belong to?">
                <select name="portfolio_id" required defaultValue="" className={input()}>
                  <option value="">— Select —</option>
                  {portfolioOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.company_name}</option>
                  ))}
                </select>
              </Row>
            </div>
          </Card>
        )}

        {/* ============================================================
            LEGAL ENTITY
           ============================================================ */}
        <Card>
          <CardTitle>Legal Entity</CardTitle>
          <div className="space-y-4 px-5 py-4">
            <Row label="Association Name" required help="The display name used across the portal.">
              <input name="name" required placeholder="Brandon Shores Condominium Association" className={input()} />
            </Row>
            <Row label="Legal Name" help="The registered name of the corporation, if different from the display name.">
              <input name="legal_name" placeholder="Same as above if blank" className={input()} />
            </Row>
            <Row label="Tax ID (EIN)" help="Federal Employer Identification Number.">
              <input name="tax_id" placeholder="12-3456789" className={`${input()} max-w-xs`} />
            </Row>
          </div>
        </Card>

        {/* ============================================================
            FINANCIAL / REPORTING
           ============================================================ */}
        <Card>
          <CardTitle>Financial &amp; Reporting</CardTitle>
          <div className="space-y-4 px-5 py-4">
            <Row label="Fiscal Year Start" required help="The month your fiscal year begins. December for calendar-year HOAs.">
              <select name="fiscal_year_start" defaultValue="1" className={input()}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </Row>
            <Row label="Reserve Funds" help="Opening reserve balance.">
              <MoneyInput name="reserve_funds" defaultValue="0.00" />
            </Row>
            <Row label="Vendor 1099 Payer">
              <select name="vendor_1099_payer" defaultValue="use_management_company" className={input()}>
                <option value="use_management_company">Use Management Company</option>
                <option value="use_owner">Use Owner</option>
              </select>
            </Row>
            <Row label="Basis for Owner Payouts">
              <select name="owner_payout_basis" defaultValue="cash" className={input()}>
                <option value="cash">Cash</option>
                <option value="accrual">Accrual</option>
              </select>
            </Row>
          </div>
        </Card>

        {/* ============================================================
            FEE POLICY
           ============================================================ */}
        <Card>
          <CardTitle>Fee Policy</CardTitle>
          <div className="space-y-4 px-5 py-4">
            <Row label="NSF Fee">
              <MoneyInput name="nsf_fee_amount_override" defaultValue="25.00" />
            </Row>

            <div className="border-t border-gray-100 pt-4">
              <div className="mb-3 text-sm font-semibold text-gray-800">Late Fee</div>
              <div className="space-y-3">
                <Row label="Late Fee Type" required>
                  <RadioGroup name="late_fee_type" defaultValue="flat" options={[
                    { value: 'flat',    label: 'Flat' },
                    { value: 'percent', label: 'Percent' },
                  ]} />
                </Row>
                <Row label="Base Late Fee" required>
                  <MoneyInput name="late_fee_amount_override" defaultValue="0.00" />
                </Row>
                <Row label="Eligible Charges" required>
                  <select name="late_fee_eligible_charges" defaultValue="all_charges" className={input()}>
                    <option value="all_charges">Every charge</option>
                    <option value="dues_only">Dues only</option>
                    <option value="assessments_only">Assessments only</option>
                  </select>
                </Row>
                <Row label="Grace Period (days)" required help="Number of days after due date before the late fee posts.">
                  <input name="late_fee_grace_days_override" type="number" min="0" defaultValue="5" className={`${input()} max-w-[120px]`} />
                </Row>
              </div>
            </div>
          </div>
        </Card>

        {/* ============================================================
            BUDGET VARIANCE THRESHOLD
           ============================================================ */}
        <Card>
          <CardTitle>Budget Variance Threshold</CardTitle>
          <div className="space-y-3 px-5 py-4">
            <p className="text-sm text-gray-500">
              Enables color coding on the Variance / Financials page when actual vs. budget
              exceeds these thresholds.
            </p>
            <div className="grid grid-cols-12 gap-3">
              <label className="col-span-4">
                <div className="mb-1 text-xs text-gray-500">Amount ($)</div>
                <MoneyInput name="budget_variance_threshold_amount" />
              </label>
              <label className="col-span-4">
                <div className="mb-1 text-xs text-gray-500">And/Or</div>
                <select name="budget_variance_threshold_op" defaultValue="or" className={input()}>
                  <option value="and">And</option>
                  <option value="or">Or</option>
                </select>
              </label>
              <label className="col-span-4">
                <div className="mb-1 text-xs text-gray-500">Percentage (%)</div>
                <PercentInput name="budget_variance_threshold_pct" />
              </label>
            </div>
          </div>
        </Card>

        <div className="rounded border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-gray-800">
          <strong>Next:</strong> after saving, you&apos;ll be sent to the <em>New Property</em> page to
          create the first physical building (address, year built, site manager, amenities,
          maintenance info) under this association.
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" size="lg">Save &amp; Continue to Property</Button>
          <Link href="/associations" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// Presentational helpers
// ============================================================================

function Card({ children }: { children: React.ReactNode }) {
  return <section className="overflow-hidden rounded border border-gray-200 bg-white">{children}</section>;
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-900">{children}</h2>;
}
function Row({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-12 items-start gap-4">
      <label className="col-span-4 pt-2 text-right text-sm text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
        {help && (
          <span title={help} className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-gray-300 text-[10px] font-semibold text-white">
            ?
          </span>
        )}
      </label>
      <div className="col-span-8">{children}</div>
    </div>
  );
}
function RadioGroup({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      {options.map((o) => (
        <label key={o.value} className="flex items-center gap-2">
          <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} className="h-4 w-4" />
          {o.label}
        </label>
      ))}
    </div>
  );
}
function MoneyInput({ name, defaultValue }: { name: string; defaultValue?: string }) {
  return (
    <div className="relative max-w-[180px]">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
      <input
        name={name}
        type="number"
        step="0.01"
        min="0"
        defaultValue={defaultValue ?? ''}
        className={`${input()} pl-6`}
      />
    </div>
  );
}
function PercentInput({ name, defaultValue }: { name: string; defaultValue?: string }) {
  return (
    <div className="relative max-w-[140px]">
      <input
        name={name}
        type="number"
        step="0.01"
        min="0"
        max="100"
        defaultValue={defaultValue ?? ''}
        className={`${input()} pr-8`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
    </div>
  );
}
function input(extra = '') {
  return `h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${extra}`;
}
