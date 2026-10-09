import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Surface, SectionTitle } from '@/components/ui/shell';
import { saveRecurringBill } from '@/lib/rpcs/recurring';
import { todayInZone } from '@/lib/time/zoned';
import { VendorSelect, type VendorOption } from '@/components/vendors/vendor-select';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

export type RecurringBillValues = {
  id?: string;
  name?: string;
  vendor_id?: string;
  association_id?: string | null;
  gl_account_id?: string | null;
  bank_account_id?: string | null;
  memo?: string | null;
  amount?: number | null;
  frequency?: string;
  interval_count?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  due_days?: number | null;
  auto_generate?: boolean | null;
};

type Option = { id: string; name: string; number?: string | null; association_id?: string | null };

export function RecurringBillForm({
  values,
  vendors,
  associations,
  gls,
  banks,
}: {
  values: RecurringBillValues;
  vendors: VendorOption[];
  associations: Option[];
  gls: Option[];
  banks: Option[];
}) {
  const today = todayInZone();
  return (
    <form action={saveRecurringBill} className="space-y-6">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Surface>
        <SectionTitle title="Bill" description="A bill is created automatically on each scheduled date and appears in Payables." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" required className="sm:col-span-2">
            <Input id="name" name="name" required maxLength={120} defaultValue={values.name ?? ''} placeholder="Monthly janitorial service" />
          </Field>
          <Field label="Association" htmlFor="association_id" required>
            <Select id="association_id" name="association_id" required defaultValue={values.association_id ?? ''}>
              <option value="">Choose an association</option>
              {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Vendor" htmlFor="vendor_id" required>
            <VendorSelect id="vendor_id" name="vendor_id" required defaultValue={values.vendor_id ?? ''} vendors={vendors} placeholder="Choose a vendor" />
          </Field>
          <Field label="Expense account" htmlFor="gl_account_id" required>
            <Select id="gl_account_id" name="gl_account_id" required defaultValue={values.gl_account_id ?? ''}>
              <option value="">Choose a GL account</option>
              {gls.map((g) => <option key={g.id} value={g.id}>{g.number ? `${g.number} · ` : ''}{g.name}</option>)}
            </Select>
          </Field>
          <Field label="Pay from" htmlFor="bank_account_id" hint="Optional — can be chosen at the check run.">
            <Select id="bank_account_id" name="bank_account_id" defaultValue={values.bank_account_id ?? ''}>
              <option value="">Decide when paying</option>
              {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Amount" htmlFor="amount" required>
            <Input id="amount" name="amount" inputMode="decimal" required defaultValue={values.amount ?? ''} placeholder="700.00" />
          </Field>
          <Field label="Memo on each bill" htmlFor="memo" hint="The month is added automatically, e.g. “— Oct 2026”.">
            <Input id="memo" name="memo" maxLength={200} defaultValue={values.memo ?? ''} />
          </Field>
        </div>
      </Surface>

      <Surface>
        <SectionTitle title="Schedule" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Repeats" htmlFor="frequency" required>
            <Select id="frequency" name="frequency" defaultValue={values.frequency ?? 'monthly'}>
              {values.frequency === 'daily' && <option value="daily">Daily</option>}
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </Select>
          </Field>
          <Field label="Every" htmlFor="interval_count" hint="1 = every period, 2 = every other">
            <Input id="interval_count" name="interval_count" type="number" min={1} max={12} defaultValue={values.interval_count ?? 1} />
          </Field>
          <Field label="Due" htmlFor="due_days" hint="Days after the bill date">
            <Input id="due_days" name="due_days" type="number" min={0} max={120} defaultValue={values.due_days ?? 0} />
          </Field>
          <Field label={values.id ? 'Start date' : 'First bill on'} htmlFor="start_date" required>
            <Input id="start_date" name="start_date" type="date" required defaultValue={values.start_date ?? today} />
          </Field>
          <Field label="End date" htmlFor="end_date" hint="Leave blank to continue indefinitely">
            <Input id="end_date" name="end_date" type="date" defaultValue={values.end_date ?? ''} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
            <input type="checkbox" name="active" defaultChecked={values.auto_generate !== false} />
            Active
          </label>
        </div>
      </Surface>

      <div className="flex flex-wrap justify-end gap-2">
        <Link href="/bills/recurring"><Button type="button" variant="secondary">Cancel</Button></Link>
        <Button type="submit">{values.id ? 'Save changes' : 'Create recurring bill'}</Button>
      </div>
    </form>
  );
}

/** Dropdown sources for the recurring bill form (RLS-scoped). */
export async function loadRecurringBillOptions(db: any) {
  const [{ data: vendors }, { data: associations }, { data: gls }, { data: banks }] = await Promise.all([
    fetchAllRows<any>(() => db.from('vendors').select('id, name, association_id, is_management_company, portfolio_id').is('archived_at', null).order('name').order('id')).then((r) => ({ data: r.rows, error: r.error ? { message: r.error } : null })),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('gl_accounts').select('id, number, name').eq('active', true)
      .in('account_type', ['expense', 'cost_of_goods_sold', 'other_expense']).order('number'),
    db.from('bank_accounts').select('id, name').is('archived_at', null).order('name'),
  ]);
  return { vendors: vendors ?? [], associations: associations ?? [], gls: gls ?? [], banks: banks ?? [] };
}

