import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireVendor } from '@/lib/auth/me';
import { PageHeader, Surface, SectionTitle, Badge, Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const FIELDS = [
  { key: 'workers_comp_expiration', label: 'Workers compensation' },
  { key: 'general_liability_expiration', label: 'General liability' },
  { key: 'auto_insurance_expiration', label: 'Auto insurance' },
  { key: 'epa_certification_expiration', label: 'EPA certification' },
  { key: 'state_license_expiration', label: 'State license' },
  { key: 'contract_expiration', label: 'Contract' },
] as const;

function statusFor(d: string | null): { tone: 'complete' | 'pending' | 'danger' | 'inactive'; label: string } {
  if (!d) return { tone: 'inactive', label: 'Not on file' };
  const t = new Date(d).getTime();
  if (t < Date.now()) return { tone: 'danger', label: 'Expired' };
  if (t < Date.now() + 30 * 86400000) return { tone: 'pending', label: 'Expiring soon' };
  return { tone: 'complete', label: 'Current' };
}

export default async function VendorCompliance({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requireVendor();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: c } = await (supabase as any)
    .from('vendor_compliance')
    .select('*')
    .eq('vendor_id', me.vendor_id)
    .maybeSingle();

  async function save(formData: FormData) {
    'use server';
    const me2 = await requireVendor();
    const supabase2 = await createClient();
    const patch: Record<string, any> = { vendor_id: me2.vendor_id, updated_at: new Date().toISOString() };
    for (const f of FIELDS) {
      const v = (formData.get(f.key) as string) || null;
      patch[f.key] = v;
    }
    const { error } = await (supabase2 as any).from('vendor_compliance').upsert(patch, { onConflict: 'vendor_id' });
    if (error) redirect(`/vendor/compliance?error=${encodeURIComponent(error.message)}`);
    revalidatePath('/vendor/compliance');
    redirect('/vendor/compliance?saved=1');
  }

  return (
    <div>
      <PageHeader
        title="Compliance"
        description="Insurance and license expiration dates. Management companies see these when assigning work."
      />

      {sp.error && <Alert tone="danger" title="Could not save:" className="mb-5">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success" className="mb-5">Compliance dates saved.</Alert>}

      <Surface>
        <SectionTitle title="Certificates & licenses" description="Enter the expiration date from each document." />
        <form action={save} className="space-y-1">
          <ul className="divide-y divide-gray-50">
            {FIELDS.map((f) => {
              const current = c?.[f.key] ?? null;
              const s = statusFor(current);
              return (
                <li key={f.key} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <ShieldCheck className="h-4 w-4 flex-shrink-0 text-gray-300" />
                    <span className="text-[13px] font-medium text-gray-800">{f.label}</span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 sm:w-56">
                    <Input type="date" name={f.key} defaultValue={current ?? ''} aria-label={`${f.label} expiration date`} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="pt-4">
            <Button type="submit">Save compliance dates</Button>
          </div>
        </form>
        {c?.updated_at && <p className="mt-3 text-[12px] text-gray-400">Last updated {date(c.updated_at)}</p>}
      </Surface>
    </div>
  );
}
