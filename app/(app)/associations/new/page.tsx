import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getMe, requireStaff } from '@/lib/auth/me';
import { Section } from '@/components/workspace/shell';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

export default async function NewPropertyPage() {
  await requireStaff();
  const supabase = await createClient();

  const [
    { data: glAccounts },
    { data: bankAccounts },
    { data: propertyGroups },
    { data: feeSchedules },
    { data: ownersList },
  ] = await Promise.all([
    (supabase as any).from('gl_accounts').select('id, number, name, account_type').eq('active', true).order('number'),
    (supabase as any).from('bank_accounts').select('id, name, bank_name, account_type').is('archived_at', null).order('name'),
    (supabase as any).from('property_groups').select('id, name').order('name'),
    (supabase as any).from('management_fee_schedules').select('id, name, fee_type, percentage, amount').is('archived_at', null).order('name'),
    (supabase as any).from('owners').select('id, full_name').is('archived_at', null).order('full_name'),
  ]);

  const cashGLAccounts = (glAccounts ?? []).filter((g: any) => {
    const t = String(g.account_type ?? '').toLowerCase();
    return t === 'asset' || t === 'bank' || t === 'cash';
  });

  async function createProperty(formData: FormData) {
    'use server';
    const supabase = await createClient();
    const m = await getMe();

    const name = String(formData.get('name') ?? '').trim();
    const address = String(formData.get('address') ?? '').trim();
    if (!name) throw new Error('Property Name is required.');
    if (!address) throw new Error('Address is required.');
    if (!m?.portfolio?.id) throw new Error('Could not determine portfolio.');

    const { data: assoc, error: aErr } = await (supabase as any)
      .from('associations')
      .insert({
        portfolio_id: m.portfolio.id,
        name,
        property_type: (formData.get('property_type') as string) || null,
        address,
        address_line_2: (formData.get('address_line_2') as string) || null,
        city: (formData.get('city') as string) || null,
        state: (formData.get('state') as string) || null,
        zip: (formData.get('zip') as string) || null,
        county: (formData.get('county') as string) || null,
        description: (formData.get('description') as string) || null,
        site_manager_first_name: (formData.get('site_manager_first_name') as string) || null,
        site_manager_last_name: (formData.get('site_manager_last_name') as string) || null,
        site_manager_phone: (formData.get('site_manager_phone') as string) || null,
        year_built: numOrNull(formData.get('year_built')),
        management_start_date: (formData.get('management_start_date') as string) || null,
        nsf_fee_amount_override: numOrNull(formData.get('nsf_fee_amount_override')),
        reserve_funds: numOrNull(formData.get('reserve_funds')),
        payment_frequency: (formData.get('payment_frequency') as string) || 'net_income',
        vendor_1099_payer: (formData.get('vendor_1099_payer') as string) || null,
        fiscal_year_start: yearEndMonthToStartMonth(formData.get('fiscal_year_end')),
        basis_for_owner_packets: (formData.get('basis_for_owner_packets') as string) || null,
        management_fee_schedule_id: (formData.get('management_fee_schedule_id') as string) || null,
        lease_fee_type: (formData.get('lease_fee_type') as string) || null,
        lease_fee_pct: numOrNull(formData.get('lease_fee_pct')),
        renewal_fee_type: (formData.get('renewal_fee_type') as string) || null,
        renewal_fee_pct: numOrNull(formData.get('renewal_fee_pct')),
        late_fee_type: (formData.get('late_fee_type') as string) || 'flat',
        late_fee_amount_override: numOrNull(formData.get('late_fee_amount_override')),
        late_fee_eligible_charges: (formData.get('late_fee_eligible_charges') as string) || 'every_charge',
        late_fee_grace_days_override: numOrNull(formData.get('late_fee_grace_days_override')),
        late_fee_grace_day_of_following_month: numOrNull(formData.get('late_fee_grace_day_of_following_month')),
        budget_variance_threshold_amount: numOrNull(formData.get('budget_variance_threshold_amount')),
        budget_variance_threshold_op: (formData.get('budget_variance_threshold_op') as string) || null,
        budget_variance_threshold_pct: numOrNull(formData.get('budget_variance_threshold_pct')),
        maintenance_limit: numOrNull(formData.get('maintenance_limit')),
        insurance_expiration: (formData.get('insurance_expiration') as string) || null,
        home_warranty_covered: formData.get('home_warranty_covered') === 'on',
        unit_entry_pre_authorized: formData.get('unit_entry_pre_authorized') === 'on',
        maintenance_notes: (formData.get('maintenance_notes') as string) || null,
        online_maintenance_request_instructions: (formData.get('online_maintenance_request_instructions') as string) || null,
        property_group_id: (formData.get('property_group_id') as string) || null,
        operating_bank_account_id: (formData.get('operating_bank_account_id') as string) || null,
      })
      .select('id')
      .single();

    if (aErr) throw new Error(`Could not create property: ${aErr.message}`);
    const newId = assoc!.id;

    revalidatePath('/associations');
    redirect(`/associations/${newId}/units`);
  }

  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto px-8 py-6">
      <h1 className="text-2xl font-semibold text-gray-900">New Property</h1>

      <form action={createProperty as any} className="mt-6 space-y-5">

        <Section title="Property Name and Address" padded>
          <FormRow label="Property Type" required>
            <select name="property_type" required className="w-full max-w-md rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
              <option value="">— Select —</option>
              <option value="condominium">Condominium</option>
              <option value="townhome">Townhome</option>
              <option value="single_family">Single Family</option>
              <option value="duplex">Duplex</option>
              <option value="multi_family">Multi Family</option>
              <option value="hoa">HOA</option>
            </select>
          </FormRow>
          <FormRow label="Property Name">
            <input type="text" name="name" required className="w-full max-w-lg rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          </FormRow>
          <FormRow label="Address" required>
            <input type="text" name="address" required placeholder="Address 1" className="mb-2 w-full max-w-lg rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            <input type="text" name="address_line_2" placeholder="Address 2" className="w-full max-w-lg rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          </FormRow>
          <FormRow label="">
            <div className="grid max-w-lg grid-cols-[1fr_120px_140px] gap-2">
              <input type="text" name="city" placeholder="City" className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <select name="state" className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                <option value="">State</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="text" name="zip" placeholder="Zip" className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
          </FormRow>
          <FormRow label="County">
            <input type="text" name="county" className="w-full max-w-md rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          </FormRow>
        </Section>

        <Section title="Property Information" padded>
          <FormRow label="Description">
            <textarea name="description" rows={3} className="w-full max-w-lg resize-y rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          </FormRow>
          <FormRow label="Site Manager">
            <div className="mb-2 grid max-w-md grid-cols-2 gap-2">
              <input type="text" name="site_manager_first_name" placeholder="First Name" className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <input type="text" name="site_manager_last_name" placeholder="Last Name" className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <input type="tel" name="site_manager_phone" placeholder="Phone Number" className="w-full max-w-xs rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          </FormRow>
          <FormRow label="Year Built">
            <input type="number" name="year_built" min="1800" max={new Date().getFullYear() + 1} className="w-32 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          </FormRow>
          <FormRow label="Management Start Date">
            <input type="date" name="management_start_date" className="w-44 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          </FormRow>
        </Section>

        <Section title="Maintenance Information" padded>
          <FormRow label="Maintenance Limit">
            <CurrencyInput name="maintenance_limit" defaultValue="0.00" />
          </FormRow>
          <FormRow label="Insurance Expiration">
            <input type="date" name="insurance_expiration" className="w-44 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          </FormRow>
          <FormRow label="Maintenance Notes">
            <textarea name="maintenance_notes" rows={3} className="w-full max-w-lg resize-y rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          </FormRow>
        </Section>

        <Section title="Bank Accounts" padded>
          <FormRow label="Operating Bank Account">
            <select name="operating_bank_account_id" className="w-full max-w-md rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
              <option value="">— Select —</option>
              {(bankAccounts ?? []).map((b: any) => (
                <option key={b.id} value={b.id}>{b.name} {b.bank_name ? `(${b.bank_name})` : ''}</option>
              ))}
            </select>
          </FormRow>
        </Section>

        <div className="flex items-center gap-2 pt-2">
          <Button type="submit" size="sm">Save</Button>
          <Link href="/associations">
            <Button type="button" size="sm" variant="secondary">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

function FormRow({
  label, required, children,
}: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="mb-3 grid grid-cols-[200px_1fr] items-start gap-x-3 gap-y-1">
      <label className="pt-1.5 text-sm text-gray-600">
        {label}{label && required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      <div>{children}</div>
    </div>
  );
}

function CurrencyInput({ name, defaultValue }: { name: string; defaultValue?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-gray-500">$</span>
      <input
        type="number"
        step="0.01"
        min="0"
        name={name}
        defaultValue={defaultValue}
        className="w-40 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function yearEndMonthToStartMonth(v: FormDataEntryValue | null): number | null {
  const n = numOrNull(v);
  if (n == null) return null;
  return (n % 12) + 1;
}
