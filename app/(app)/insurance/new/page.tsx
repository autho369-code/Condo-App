import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Section } from '@/components/workspace/shell';

export const dynamic = 'force-dynamic';

async function addPolicy(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const db = supabase as any;

  const { error } = await db.from('insurance_policies').insert({
    owner_id: formData.get('owner_id') as string,
    association_id: (formData.get('association_id') as string) || null,
    policy_number: formData.get('policy_number') as string,
    insurance_company: formData.get('insurance_company') as string,
    coverage_amount: parseFloat(formData.get('coverage_amount') as string) || null,
    liability_amount: parseFloat(formData.get('liability_amount') as string) || null,
    deductible_amount: parseFloat(formData.get('deductible_amount') as string) || null,
    effective_date: formData.get('effective_date') as string,
    expiration_date: formData.get('expiration_date') as string,
    notes: (formData.get('notes') as string) || null,
    extraction_status: 'manual',
  });

  if (error) return { error: error.message };
  revalidatePath('/insurance');
  redirect('/insurance');
}

export default async function NewInsurancePage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: owners }, { data: associations }] = await Promise.all([
    db.from('owners').select('id, full_name').is('archived_at', null).order('full_name'),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-8 py-6">
      <div>
        <nav className="text-xs font-semibold uppercase tracking-wider text-ink-500">
          <Link href="/insurance" className="hover:text-ink-700">Insurance</Link>
          <span className="mx-2">/</span>
          New policy
        </nav>
        <h1 className="mt-2 text-2xl font-semibold text-ink-900">Add insurance policy</h1>
        <p className="mt-1 text-sm text-ink-500">
          Enter HO6 certificate details. Upload the certificate for AI extraction, or enter manually.
        </p>
      </div>

      {/* AI Upload zone */}
      <section className="rounded-lg border-2 border-dashed border-ink-200 bg-cream-50 p-8 text-center">
        <div className="text-3xl mb-2">📄</div>
        <h3 className="font-medium text-ink-900">Upload certificate for AI extraction</h3>
        <p className="mt-1 text-sm text-ink-500">
          Drop a PDF or image of the HO6 certificate. AI will extract policy number, coverage, dates, and insurance company automatically.
        </p>
        <div className="mt-4">
          <Button variant="secondary" disabled>AI extraction coming soon</Button>
        </div>
      </section>

      {/* Manual entry form */}
      <form action={addPolicy as any} className="space-y-6">
        <Section title="Policy details" padded>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="owner_id">Owner <span className="text-red-500">*</span></Label>
              <select id="owner_id" name="owner_id" required className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">Select owner</option>
                {(owners ?? []).map((o: any) => (
                  <option key={o.id} value={o.id}>{o.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="association_id">Association</Label>
              <select id="association_id" name="association_id" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">Select association</option>
                {(associations ?? []).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="policy_number">Policy number <span className="text-red-500">*</span></Label>
              <Input id="policy_number" name="policy_number" required placeholder="HO6-2026-001234" />
            </div>

            <div>
              <Label htmlFor="insurance_company">Insurance company <span className="text-red-500">*</span></Label>
              <Input id="insurance_company" name="insurance_company" required placeholder="State Farm, Allstate, etc." />
            </div>

            <div>
              <Label htmlFor="coverage_amount">Coverage amount ($)</Label>
              <Input id="coverage_amount" name="coverage_amount" type="number" step="0.01" min="0" placeholder="100000" />
            </div>

            <div>
              <Label htmlFor="liability_amount">Liability amount ($)</Label>
              <Input id="liability_amount" name="liability_amount" type="number" step="0.01" min="0" placeholder="300000" />
            </div>

            <div>
              <Label htmlFor="deductible_amount">Deductible ($)</Label>
              <Input id="deductible_amount" name="deductible_amount" type="number" step="0.01" min="0" placeholder="1000" />
            </div>

            <div>
              <Label htmlFor="effective_date">Effective date <span className="text-red-500">*</span></Label>
              <Input id="effective_date" name="effective_date" type="date" required />
            </div>

            <div>
              <Label htmlFor="expiration_date">Expiration date <span className="text-red-500">*</span></Label>
              <Input id="expiration_date" name="expiration_date" type="date" required />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea id="notes" name="notes" rows={2} className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm" placeholder="Additional coverage details, lender requirements, etc." />
            </div>
          </div>
        </Section>

        <div className="flex items-center gap-3">
          <Button type="submit" size="lg">Save policy</Button>
          <Link href="/insurance" className="text-sm text-ink-500 hover:text-ink-900">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
