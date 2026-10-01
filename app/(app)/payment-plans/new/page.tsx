import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createPaymentPlan } from '@/lib/rpcs/payment-plans';
import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function NewPaymentPlanPage({ searchParams }: { searchParams: Promise<{ error?: string; unit?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;

  // Units that owe money (RLS: associations this staffer manages), largest balance first.
  const { data: balances } = await db
    .from('unit_balances')
    .select('unit_id, unit_number, association_id, balance')
    .gt('balance', 0)
    .order('balance', { ascending: false })
    .limit(500);
  const rows = (balances ?? []) as { unit_id: string; unit_number: string; association_id: string; balance: number }[];
  const assocIds = [...new Set(rows.map((r) => r.association_id))];
  const unitIds = rows.map((r) => r.unit_id);
  const [{ data: assocs }, { data: occs }, { data: activePlans }] = await Promise.all([
    assocIds.length ? db.from('associations').select('id, name').in('id', assocIds) : { data: [] },
    unitIds.length ? db.from('occupancies').select('unit_id, is_primary, owners(full_name)').in('unit_id', unitIds).eq('status', 'current') : { data: [] },
    unitIds.length ? db.from('payment_plans').select('unit_id').in('unit_id', unitIds).eq('status', 'active') : { data: [] },
  ]);
  const assocName = new Map<string, string>(((assocs ?? []) as any[]).map((a) => [a.id, a.name]));
  const ownerName = new Map<string, string>();
  for (const o of ((occs ?? []) as any[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary))) {
    if (!ownerName.has(o.unit_id) && o.owners?.full_name) ownerName.set(o.unit_id, o.owners.full_name);
  }
  const hasPlan = new Set(((activePlans ?? []) as any[]).map((p) => p.unit_id));
  const options = rows.filter((r) => !hasPlan.has(r.unit_id));
  const selected = options.find((r) => r.unit_id === sp.unit) ?? null;

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1, 1);

  return (
    <DataWorkspace
      title="New payment plan"
      description="Split a homeowner's past-due balance into installments. Their collection case pauses while the plan is current."
      actions={<Link href="/payment-plans"><Button variant="secondary">Back to payment plans</Button></Link>}
    >
      <div className="max-w-3xl space-y-4">
        {sp.error && <Alert tone="danger" title="Could not create the plan">{sp.error}</Alert>}
        {options.length === 0 ? (
          <Alert tone="info" title="No units owe money right now">Payment plans are for units with a past-due balance (units that already have an active plan aren&rsquo;t listed).</Alert>
        ) : (
          <form action={createPaymentPlan}>
            <Surface>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Unit" htmlFor="unit_id" className="sm:col-span-2">
                  <Select id="unit_id" name="unit_id" required defaultValue={selected?.unit_id ?? ''}>
                    <option value="">Choose a unit with a balance</option>
                    {options.map((r) => (
                      <option key={r.unit_id} value={r.unit_id}>
                        {assocName.get(r.association_id) ?? 'Association'} · Unit {r.unit_number}
                        {ownerName.get(r.unit_id) ? ` · ${ownerName.get(r.unit_id)}` : ''} — owes {money(r.balance)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Plan amount" htmlFor="total" hint="Usually the past-due balance.">
                  <Input id="total" name="total" type="number" min="0.01" step="0.01" required defaultValue={selected ? Number(selected.balance).toFixed(2) : ''} />
                </Field>
                <Field label="Number of installments" htmlFor="installments">
                  <Input id="installments" name="installments" type="number" min="1" max="60" step="1" required defaultValue="6" />
                </Field>
                <Field label="Frequency" htmlFor="frequency">
                  <Select id="frequency" name="frequency" defaultValue="monthly">
                    <option value="monthly">Monthly</option>
                    <option value="biweekly">Every two weeks</option>
                    <option value="weekly">Weekly</option>
                  </Select>
                </Field>
                <Field label="First installment due" htmlFor="first_due_date">
                  <Input id="first_due_date" name="first_due_date" type="date" required defaultValue={isoDate(nextMonth)} />
                </Field>
                <Field label="Notes (optional)" htmlFor="notes" className="sm:col-span-2">
                  <Textarea id="notes" name="notes" rows={3} placeholder="e.g. Agreed by phone with the owner on 10/1" />
                </Field>
              </div>
            </Surface>
            <p className="mt-3 text-xs text-gray-500">
              Regular dues keep billing as usual — the plan covers the past-due amount. Payments the owner makes count toward the plan automatically.
            </p>
            <div className="mt-4">
              <Button type="submit">Create payment plan</Button>
            </div>
          </form>
        )}
      </div>
    </DataWorkspace>
  );
}
