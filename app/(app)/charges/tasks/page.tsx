import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/input';
import { Alert, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { applyCredits, chargeLateFeesNow } from '@/lib/rpcs/receivables-tasks';
import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function split(v?: string) {
  const [amount, count] = (v ?? '').split('|');
  return { amount: Number(amount) || 0, count: Number(count) || 0 };
}

export default async function ReceivablesTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; applied?: string; fees?: string }>;
}) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;

  // Only associations this user can act on, with full totals (computed in the database).
  const { data: rows } = await db.rpc('receivables_task_associations');
  const associations = ((rows ?? []) as any[]).map((a) => ({ ...a, id: a.association_id }));
  const unappliedTotal = associations.reduce((s, a) => s + Number(a.unapplied ?? 0), 0);
  const applied = sp.applied ? split(sp.applied) : null;
  const fees = sp.fees ? split(sp.fees) : null;

  return (
    <DataWorkspace
      title="Receivables tasks"
      description="Apply homeowner credits to open charges and charge late fees on demand."
      actions={<Link href="/charges"><Button variant="secondary">Back to receivables</Button></Link>}
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger" title="Could not run the task">{sp.error}</Alert>}
        {applied && (
          <Alert tone="success" title="Credits applied">
            {applied.count === 0 ? 'Nothing to apply — no unit had both unapplied money and open charges.' : `${money(applied.amount)} applied from ${applied.count} payment${applied.count === 1 ? '' : 's'}/credit${applied.count === 1 ? '' : 's'}, oldest charges first.`}
          </Alert>
        )}
        {fees && (
          <Alert tone="success" title="Late fees charged">
            {fees.count === 0 ? 'No late fees were due — every overdue charge is already charged, paid, in its grace period or exempt.' : `${fees.count} late fee${fees.count === 1 ? '' : 's'} charged, ${money(fees.amount)} in total.`}
          </Alert>
        )}

        <Surface>
          <SectionTitle
            title="Apply credits"
            description={`Applies homeowners' unapplied payments and credits to their open charges, oldest first. Currently ${money(unappliedTotal)} is unapplied across the units you manage.`}
          />
          <form action={applyCredits} className="flex flex-wrap items-end gap-3">
            <Field label="Association" htmlFor="apply_association" className="min-w-[260px] flex-1">
              <Select id="apply_association" name="association_id" required defaultValue="">
                <option value="">Choose an association</option>
                {associations.map((a) => <option key={a.id} value={a.id}>{a.name}{Number(a.unapplied) > 0 ? ` — ${money(a.unapplied)} unapplied` : ''}</option>)}
              </Select>
            </Field>
            <Button type="submit">Apply credits</Button>
          </form>
        </Surface>

        <Surface>
          <SectionTitle
            title="Charge late fees"
            description="Runs the association's late-fee policy now — the same rules as the nightly run: grace days, owner overrides and exemptions, and never twice for the same charge."
          />
          <form action={chargeLateFeesNow} className="flex flex-wrap items-end gap-3">
            <Field label="Association" htmlFor="fee_association" className="min-w-[260px] flex-1">
              <Select id="fee_association" name="association_id" required defaultValue="">
                <option value="">Choose an association</option>
                {associations.filter((a) => a.late_fee_enabled).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Button type="submit">Charge late fees</Button>
          </form>
          <div className="mt-4">
            <Table>
              <THead>
                <tr><TH>Association</TH><TH>Late fee</TH><TH>Grace days</TH></tr>
              </THead>
              <tbody>
                {associations.map((a) => (
                  <TR key={a.id}>
                    <TD className="text-sm text-gray-900">{a.name}</TD>
                    <TD className="text-sm text-gray-700">
                      {a.late_fee_enabled
                        ? (a.late_fee_is_percent ? `${a.late_fee_amount}% of the balance` : money(a.late_fee_amount))
                        : <span className="text-gray-400">Off</span>}
                    </TD>
                    <TD className="text-sm text-gray-700">{a.late_fee_enabled ? (a.late_fee_grace_days ?? 0) : '—'}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <p className="mt-2 text-xs text-gray-500">Turn late fees on or change the amount on the association&rsquo;s profile.</p>
          </div>
        </Surface>
      </div>
    </DataWorkspace>
  );
}
