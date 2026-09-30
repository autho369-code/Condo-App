import Link from 'next/link';
import { Briefcase } from 'lucide-react';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Alert, Badge, EmptyState, Surface, SectionTitle } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;
const MONTH = /^\d{4}-\d{2}$/;

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

async function runFees(formData: FormData) {
  'use server';
  await requireFinanceStaff();
  const month = String(formData.get('month') ?? '');
  const back = `/accounting/management-fees?month=${MONTH.test(month) ? month : ''}`;
  const ids = formData.getAll('association_id').map(String).filter((v) => UUID.test(v));
  const vendor = String(formData.get('vendor_id') ?? '');
  const gl = String(formData.get('gl_account_id') ?? '');
  if (!MONTH.test(month)) redirect(`${back}&error=${encodeURIComponent('Choose a month')}`);
  const db = (await createClient()) as any;
  const { data, error } = await db.rpc('run_management_fees', {
    p_month: `${month}-01`,
    p_association_ids: ids,
    p_vendor_id: UUID.test(vendor) ? vendor : null,
    p_gl_account_id: UUID.test(gl) ? gl : null,
    p_bill_date: null,
  });
  if (error) redirect(`${back}&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/accounting/management-fees');
  redirect(`${back}&billed=${data ?? 0}`);
}

export default async function ManagementFeesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; error?: string; billed?: string }>;
}) {
  const me = await requireFinanceStaff();
  const sp = await searchParams;
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = MONTH.test(sp.month ?? '') ? sp.month! : `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  const db = (await createClient()) as any;

  const [{ data: preview, error }, { data: vendors }, { data: gls }, { data: portfolio }] = await Promise.all([
    db.rpc('management_fee_preview', { p_month: `${month}-01` }),
    db.from('vendors').select('id, name').is('archived_at', null).order('name'),
    db.from('gl_accounts').select('id, number, name').eq('active', true).is('association_id', null)
      .in('account_type', ['expense', 'other_expense']).order('number'),
    db.from('portfolios').select('management_fee_vendor_id, management_fee_gl_account_id, company_name').eq('id', me.portfolio?.id).maybeSingle(),
  ]);
  if (error) throw new Error(`Could not calculate management fees: ${error.message}`);
  const rows = (preview ?? []) as any[];
  const open = rows.filter((r) => !r.already_billed && Number(r.fee) > 0);
  const billed = rows.filter((r) => r.already_billed);
  const total = open.reduce((s, r) => s + Number(r.fee), 0);
  const billedTotal = billed.reduce((s, r) => s + Number(r.fee), 0);
  const defaultGl = portfolio?.management_fee_gl_account_id
    ?? (gls ?? []).find((g: any) => /management fee/i.test(g.name))?.id ?? '';

  return (
    <DataWorkspace
      title="Pay management fees"
      description="Calculate each association's management fee from its fee policy and bill it to the association, ready for the check run."
      actions={<Link href="/bills/check-run"><Button variant="secondary">Check run</Button></Link>}
    >
      <div className="space-y-4">
        {sp.billed && <Alert tone="success" title={`${sp.billed} management fee bill${sp.billed === '1' ? '' : 's'} created`}>They are approved and posted to Accounts Payable. Pay them from the check run.</Alert>}
        {sp.error && <Alert tone="danger" title="Could not bill fees">{sp.error}</Alert>}

        <Surface>
          <form className="flex flex-wrap items-end gap-3">
            <Field label="Month" htmlFor="month">
              <Input id="month" name="month" type="month" defaultValue={month} />
            </Field>
            <Button type="submit" variant="secondary">Calculate</Button>
          </form>
        </Surface>

        <MetricStrip
          metrics={[
            { label: `To bill · ${monthLabel(month)}`, value: money(total), sublabel: `${open.length} association${open.length === 1 ? '' : 's'}` },
            { label: 'Already billed', value: money(billedTotal), sublabel: `${billed.length} association${billed.length === 1 ? '' : 's'}` },
            { label: 'Associations with a fee policy', value: rows.length },
          ]}
        />

        {rows.length === 0 ? (
          <Surface padded={false}>
            <EmptyState
              icon={Briefcase}
              title="No management fee policies yet"
              description="Set a fee (per door, flat monthly or % of assessments) on each association's profile, then come back here each month."
              action={<Link href="/associations"><Button>Go to associations</Button></Link>}
            />
          </Surface>
        ) : (
          <form action={runFees} className="space-y-4">
            <input type="hidden" name="month" value={month} />
            <Table>
              <THead>
                <tr>
                  <TH><span className="sr-only">Select</span></TH>
                  <TH>Association</TH>
                  <TH>Policy</TH>
                  <TH>Basis</TH>
                  <TH className="text-right">Fee</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <tbody>
                {rows.map((r) => {
                  const canBill = !r.already_billed && Number(r.fee) > 0;
                  return (
                    <TR key={r.association_id}>
                      <TD>
                        <input type="checkbox" name="association_id" value={r.association_id} defaultChecked={canBill} disabled={!canBill}
                          aria-label={`Bill ${r.association_name}`} className="h-4 w-4" />
                      </TD>
                      <TD className="font-medium text-gray-950">{r.association_name}</TD>
                      <TD className="text-sm text-gray-600">
                        {r.fee_type === 'per_door' ? `${money(r.rate)} per door` : r.fee_type === 'flat_monthly' ? `${money(r.rate)} flat` : `${r.rate}% of assessments`}
                      </TD>
                      <TD className="text-sm text-gray-600">
                        {r.fee_type === 'per_door' ? `${r.door_count} units` : r.fee_type === 'percentage' ? `${money(r.basis)} billed` : '—'}
                      </TD>
                      <TD className="text-right tabular-nums">{money(r.fee)}</TD>
                      <TD>
                        {r.already_billed
                          ? <Link href={`/bills/${r.bill_id}`}><Badge tone="complete">Billed</Badge></Link>
                          : Number(r.fee) > 0 ? <Badge tone="pending">Not billed</Badge> : <Badge tone="inactive">Nothing due</Badge>}
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>

            {open.length > 0 && (
              <Surface>
                <SectionTitle title="Bill the selected fees" description={`One approved bill per association, dated the last day of ${monthLabel(month)}.`} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Pay to (management company vendor)" htmlFor="vendor_id" required>
                    <Select id="vendor_id" name="vendor_id" required defaultValue={portfolio?.management_fee_vendor_id ?? ''}>
                      <option value="">Choose a vendor</option>
                      {(vendors ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Expense account" htmlFor="gl_account_id" required>
                    <Select id="gl_account_id" name="gl_account_id" required defaultValue={defaultGl}>
                      <option value="">Choose an account</option>
                      {(gls ?? []).map((g: any) => <option key={g.id} value={g.id}>{g.number} · {g.name}</option>)}
                    </Select>
                  </Field>
                  <div className="flex items-end">
                    <Button type="submit">Create {open.length} fee bill{open.length === 1 ? '' : 's'}</Button>
                  </div>
                </div>
                {!(vendors ?? []).length && (
                  <p className="mt-3 text-sm text-gray-500">Add your management company as a vendor first. <Link href="/vendors/new" className="font-medium text-gray-900 underline">New vendor</Link></p>
                )}
              </Surface>
            )}
          </form>
        )}
      </div>
    </DataWorkspace>
  );
}
