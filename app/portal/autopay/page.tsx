import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { revalidatePath } from 'next/cache';
import { money, date } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function enroll(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.rpc('enroll_autopay', {
    p_unit_id:                formData.get('unit_id') as string,
    p_payment_method_id:      formData.get('payment_method_id') as string,
    p_authorized_max_cents:   Math.round(parseFloat(formData.get('max_amount') as string) * 100),
    p_frequency:              (formData.get('frequency') as any) || 'on_charge_posted',
  });
  if (error) return { error: error.message };
  revalidatePath('/portal/autopay');
}

async function cancel(mandateId: string) {
  'use server';
  const supabase = await createClient();
  await supabase.rpc('cancel_autopay', { p_mandate_id: mandateId, p_reason: 'user requested' });
  revalidatePath('/portal/autopay');
}

export default async function AutopayPage() {
  const me = await requireAuth();
  const supabase = await createClient();

  const [{ data: mandates }, { data: methods }, { data: units }] = await Promise.all([
    supabase.from('autopay_mandates').select('*, units(unit_number), payment_methods(brand, last_four, method_type, bank_name)').eq('owner_id', me.owner_id ?? '').order('created_at', { ascending: false }),
    supabase.from('payment_methods').select('id, brand, last_four, method_type, bank_name, is_default').eq('owner_id', me.owner_id ?? '').is('archived_at', null),
    supabase.from('v_unit_account_summary').select('*'),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Autopay</h1>
        <Link href="/portal"><Button variant="secondary">Back</Button></Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Active autopay</CardTitle></CardHeader>
        <CardBody>
          {mandates && mandates.length > 0 ? (
            <Table>
              <THead><TR>
                <TH>Unit</TH><TH>Method</TH><TH>Frequency</TH>
                <TH className="text-right">Authorized max</TH><TH>Status</TH><TH></TH>
              </TR></THead>
              <tbody>
                {mandates.map((m: any) => (
                  <TR key={m.id}>
                    <TD>{m.units?.unit_number}</TD>
                    <TD>{m.payment_methods?.method_type === 'bank_account_ach'
                          ? `Bank ${m.payment_methods?.bank_name ?? ''} ending ${m.payment_methods?.last_four}`
                          : `${m.payment_methods?.brand} card ending ${m.payment_methods?.last_four}`}</TD>
                    <TD className="capitalize">{m.frequency.replace('_', ' ')}</TD>
                    <TD className="text-right">{money((m.authorized_amount_max_cents ?? 0) / 100)}</TD>
                    <TD><span className={`rounded px-2 py-0.5 text-xs ${
                      m.status === 'active' ? 'bg-green-100 text-green-700'
                      : m.status === 'paused' ? 'bg-amber-100 text-amber-800'
                      : 'bg-gray-100 text-gray-700'}`}>{m.status}</span></TD>
                    <TD className="text-right">
                      {m.status !== 'canceled' && (
                        <form action={cancel.bind(null, m.id) as any}>
                          <button type="submit" className="text-xs text-red-600 hover:underline">Cancel autopay</button>
                        </form>
                      )}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-sm text-gray-500">No autopay set up yet.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Set up autopay</CardTitle>
          <p className="text-sm text-gray-500">Pay your assessments automatically when they post. No more late fees.</p>
        </CardHeader>
        <CardBody>
          {(!methods || methods.length === 0) ? (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm">
              You don&apos;t have any saved bank accounts yet. Make a one-time ACH payment first via
              <Link href="/portal/pay" className="ml-1 text-brand-600 hover:underline">Pay assessment</Link>
              and choose &quot;Save for autopay&quot; at checkout â€” your bank will be saved here automatically.
            </div>
          ) : (
            <form action={enroll as any} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="unit_id">Unit</Label>
                <select id="unit_id" name="unit_id" required
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                  {(units ?? []).map((u: any) => (
                    <option key={u.unit_id} value={u.unit_id}>
                      {u.association_name} Â· Unit {u.unit_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="payment_method_id">Pay from</Label>
                <select id="payment_method_id" name="payment_method_id" required
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                  {methods.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.method_type === 'bank_account_ach'
                        ? `Bank ${m.bank_name ?? ''} ending ${m.last_four}`
                        : `${m.brand} ending ${m.last_four}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="max_amount">Max amount per charge ($)</Label>
                <Input id="max_amount" name="max_amount" type="number" step="0.01" min="1" defaultValue="500" required />
                <p className="mt-1 text-xs text-gray-500">Safety cap. Anything above this won&apos;t be auto-paid.</p>
              </div>
              <div>
                <Label htmlFor="frequency">Schedule</Label>
                <select id="frequency" name="frequency" defaultValue="on_charge_posted"
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                  <option value="on_charge_posted">When a new charge posts</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit">Enroll in autopay</Button>
              </div>
              <p className="md:col-span-2 text-xs text-gray-500">
                By enrolling you authorize {me.portfolio?.company_name ?? 'us'} to debit your selected payment method up to the maximum amount above for each posted assessment. You can cancel any time.
              </p>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
