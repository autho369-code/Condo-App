import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Alert, PageHeader, PageShell, Surface } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { updateChargeCategory, archiveChargeCategory } from '@/lib/rpcs/charges';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EditChargeCategory({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: cat }, { data: gls }] = await Promise.all([
    (supabase as any).from('charge_categories').select('*').eq('id', id).maybeSingle(),
    (supabase as any).from('gl_accounts').select('id, number, name, account_type').eq('active', true).order('number'),
  ]);
  if (!cat) notFound();

  const update = updateChargeCategory.bind(null, id);
  const archive = archiveChargeCategory.bind(null, id);

  return (
    <PageShell className="max-w-4xl">
      <PageHeader
        title={cat.name}
        eyebrow="Charge category"
        actions={
          <>
            {!cat.is_system && (
              <form action={archive as any}>
                <Button type="submit" variant="danger">Archive</Button>
              </form>
            )}
            <Link href="/charge-categories"><Button variant="secondary">Back</Button></Link>
          </>
        }
      />

      {sp.error && (
        <Alert tone="danger" title="Could not save category" className="mb-6">{sp.error}</Alert>
      )}

      {cat.is_system && (
        <Alert tone="warning" className="mb-6">
          This is a system-seeded category. You can rename, re-amount, and re-wire it — but it
          can&apos;t be archived because other parts of the system reference its code ({cat.code}).
        </Alert>
      )}

      <Surface>
          <form action={update as any} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={cat.name} required />
            </div>
            <div>
              <Label htmlFor="code">Short code</Label>
              <Input id="code" name="code" defaultValue={cat.code ?? ''} maxLength={20}
                style={{ textTransform: 'uppercase' }} disabled={cat.is_system} />
            </div>
            <div>
              <Label htmlFor="default_amount">Default amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                <Input id="default_amount" name="default_amount" type="number" step="0.01" min="0"
                  defaultValue={cat.default_amount} className="pl-6" />
              </div>
            </div>
            <div>
              <Label htmlFor="default_frequency">Default frequency</Label>
              <Select id="default_frequency" name="default_frequency" defaultValue={cat.default_frequency}>
                <option>monthly</option><option>quarterly</option><option>annually</option>
                <option>weekly</option><option>daily</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="charge_type">Charge type</Label>
              <Select id="charge_type" name="charge_type" defaultValue={cat.charge_type}>
                <option value="assessment">assessment</option>
                <option value="special_assessment">special_assessment</option>
                <option value="late_fee">late_fee</option>
                <option value="nsf_fee">nsf_fee</option>
                <option value="fine">fine</option>
                <option value="amenity_fee">amenity_fee</option>
                <option value="move_fee">move_fee</option>
                <option value="other">other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="gl_account_id">Income GL account</Label>
              <Select id="gl_account_id" name="gl_account_id" defaultValue={cat.gl_account_id ?? ''}>
                <option value="">—</option>
                {(gls ?? []).map((g: any) => (
                  <option key={g.id} value={g.id}>{g.number} — {g.name}</option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={cat.description ?? ''} />
            </div>

            <div className="flex gap-6 text-sm sm:col-span-2">
              <label className="flex items-center gap-2 text-gray-700">
                <input type="checkbox" name="is_assessment" defaultChecked={cat.is_assessment} className="h-4 w-4 rounded border-gray-300" /> Counts as an assessment
              </label>
              <label className="flex items-center gap-2 text-gray-700">
                <input type="checkbox" name="is_fee" defaultChecked={cat.is_fee} className="h-4 w-4 rounded border-gray-300" /> Is a fee (penalty)
              </label>
              <label className="flex items-center gap-2 text-gray-700">
                <input type="checkbox" name="active" defaultChecked={cat.active} className="h-4 w-4 rounded border-gray-300" /> Active
              </label>
            </div>

            <div className="sm:col-span-2"><Button type="submit">Save changes</Button></div>
          </form>
      </Surface>
    </PageShell>
  );
}
