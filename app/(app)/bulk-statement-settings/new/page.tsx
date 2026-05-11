// Bulk Update Statement Settings — mirrors AppFolio's /bulk_statement_settings/new
// Screenshot reference: 9 fields applied at once across one or many associations.
// Leave "Update Settings for" blank → updates every association in the portfolio.
import Link from 'next/link';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { updateBulkStatementSettings } from '@/lib/rpcs/entities';

export const dynamic = 'force-dynamic';

export default async function BulkStatementSettingsPage() {
  await requirePortfolioAdmin();
  const supabase = await createClient();

  // Pull live associations so the user can pick a subset. RLS scopes to their portfolio.
  const { data: assocs } = await (supabase as any)
    .from('associations')
    .select('id, name, address, city, state, use_enhanced_statement')
    .is('archived_at', null)
    .order('name');

  const associations = assocs ?? [];

  return (
    <div className="mx-auto max-w-4xl px-8 py-6">
      <h1 className="mb-4 text-2xl font-semibold text-ink-900">Bulk Update Statement Settings</h1>

      {/* Info banner — mirrors AppFolio's teal/green callout */}
      <div className="mb-4 flex items-start gap-3 rounded border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-gray-800">
        <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-teal-600 text-xs font-semibold text-white">i</span>
        <p>
          If you leave the <strong>Update Settings for</strong> field blank, we will update the
          statement settings for all your properties and associations at once. You can also select
          a mixture of individual properties or associations by checking them.
        </p>
      </div>

      <form action={updateBulkStatementSettings as any} className="space-y-4">
        <Card>
          <div className="space-y-5 px-6 py-5">
            {/* -------- Update Settings for (scope picker) -------- */}
            <Row label="Update Settings for">
              <div className="space-y-2">
                {associations.length === 0 ? (
                  <p className="text-sm text-ink-500">No associations found. Create one first.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded border border-ink-100 bg-white">
                    {associations.map((a: any) => (
                      <label key={a.id} className="flex items-center gap-2 border-b border-ink-100 px-3 py-2 text-sm last:border-b-0 hover:bg-cream-50">
                        <input type="checkbox" name="association_ids" value={a.id} className="h-4 w-4" />
                        <span className="text-ink-900">{a.name}</span>
                        {(a.address || a.city) && (
                          <span className="text-xs text-ink-500">
                            — {[a.address, [a.city, a.state].filter(Boolean).join(', ')].filter(Boolean).join(' ')}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-ink-500">By default, all properties and associations will be updated.</p>
              </div>
            </Row>

            {/* -------- Use Enhanced Statement -------- */}
            <CheckboxRow name="use_enhanced_statement" label="Use Enhanced Statement" defaultChecked />

            {/* -------- Include Current & Upcoming Charges -------- */}
            <CheckboxRow
              name="include_current_and_upcoming_charges"
              label="Include Current & Upcoming Charges"
              help="Includes charges that are scheduled to post within the statement period."
            />

            {/* -------- Include Custom Message -------- */}
            <CheckboxRow
              name="include_custom_message"
              label="Include Custom Message"
              help="If enabled, the custom statement message you set on the association will print on the statement."
            />

            {/* -------- Include Logo -------- */}
            <CheckboxRow
              name="include_logo_on_statement"
              label="Include Logo"
              help="Prints the portfolio logo at the top of each statement."
            />

            {/* -------- Include Payment Due Date -------- */}
            <CheckboxRow
              name="include_payments_due_date"
              label="Include Payment Due Date"
              help="Prints a due date on every charge on the statement."
            />

            {/* -------- Charge History Includes -------- */}
            <Row label="Charge History Includes">
              <select
                name="charge_history_includes"
                defaultValue="all_past_due_charges"
                className="h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="all_past_due_charges">All Past Due Charges</option>
                <option value="current_month_only">Current Month Only</option>
                <option value="past_three_months">Past Three Months</option>
              </select>
            </Row>

            {/* -------- Include Payment History and Balance Forward -------- */}
            <CheckboxRow
              name="include_payments_history_and_balance_forward"
              label="Include Payment History and Balance Forward"
              help="Shows prior period payments as a running balance forward line at the top of the statement."
            />

            {/* -------- Show Remaining Amount Due for Past Due Charges -------- */}
            <CheckboxRow
              name="show_remaining_amount_for_past_due_charges"
              label="Show Remaining Amount Due for Past Due Charges"
              help="For partially-paid past-due charges, shows only the remaining balance instead of the original amount."
            />

            {/* -------- Include Payment Coupon on Statements -------- */}
            <CheckboxRow
              name="include_payment_coupon_on_statement"
              label="Include Payment Coupon on Statements"
              help="Prints a tear-off payment coupon at the bottom of the statement."
            />
          </div>
        </Card>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" size="lg">Update Settings</Button>
          <Link href="/associations" className="text-sm text-ink-600 hover:text-ink-900">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="overflow-hidden rounded border border-ink-100 bg-white">{children}</section>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-12 items-start gap-4">
      <label className="col-span-4 pt-2 text-right text-sm text-ink-700">{label}</label>
      <div className="col-span-8">{children}</div>
    </div>
  );
}

function CheckboxRow({
  name,
  label,
  help,
  defaultChecked = false,
}: {
  name: string;
  label: string;
  help?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="grid grid-cols-12 items-start gap-4">
      <div className="col-span-4 pt-0.5 text-right text-sm text-ink-700">
        {label}
        {help && (
          <span
            title={help}
            className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-gray-300 text-[10px] font-semibold text-white"
            aria-label={help}
          >
            ?
          </span>
        )}
      </div>
      <div className="col-span-8">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-ink-200" />
      </div>
    </div>
  );
}
