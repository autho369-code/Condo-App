import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { updateChargeCategory, archiveChargeCategory } from '@/lib/rpcs/charges';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EditChargeCategory({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: cat }, { data: gls }] = await Promise.all([
    (supabase as any).from('charge_categories').select('*').eq('id', id).maybeSingle(),
    (supabase as any).from('gl_accounts').select('id, number, name, account_type').eq('active', true).order('number'),
  ]);
  if (!cat) notFound();

  const update = updateChargeCategory.bind(null, id);
  const archive = archiveChargeCategory.bind(null, id);

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-6">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{cat.name}</h1>
        <div className="flex gap-2">
          {!cat.is_system && (
            <form action={archive as any}>
              <Button type="submit" variant="danger">Archive</Button>
            </form>
          )}
          <Link href="/charge-categories"><Button variant="secondary">Back</Button></Link>
        </div>
      </div>

      {cat.is_system && (
        <div className="rounded-md bg-champagne-50 border border-amber-200 p-3 text-sm text-amber-900">
          This is a system-seeded category. You can rename, re-amount, and re-wire it â€” but it can&apos;t be archived because other parts of the system reference its code ({cat.code}).
        </div>
      )}

      <Card>
        <CardBody>
          <form action={update as any} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
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
                <span className="absolute left-3 top-2.5 text-ink-400">$</span>
                <Input id="default_amount" name="default_amount" type="number" step="0.01" min="0"
                  defaultValue={cat.default_amount} className="pl-6" />
              </div>
            </div>
            <div>
              <Label htmlFor="default_frequency">Default frequency</Label>
              <select id="default_frequency" name="default_frequency" defaultValue={cat.default_frequency}
                className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option>monthly</option><option>quarterly</option><option>annually</option>
                <option>weekly</option><option>daily</option>
              </select>
            </div>
            <div>
              <Label htmlFor="charge_type">Charge type</Label>
              <select id="charge_type" name="charge_type" defaultValue={cat.charge_type}
                className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="assessment">assessment</option>
                <option value="special_assessment">special_assessment</option>
                <option value="late_fee">late_fee</option>
                <option value="nsf_fee">nsf_fee</option>
                <option value="fine">fine</option>
                <option value="amenity_fee">amenity_fee</option>
                <option value="move_fee">move_fee</option>
                <option value="other">other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="gl_account_id">Income GL account</Label>
              <select id="gl_account_id" name="gl_account_id" defaultValue={cat.gl_account_id ?? ''}
                className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">â€”</option>
                {(gls ?? []).map((g: any) => (
                  <option key={g.id} value={g.id}>{g.number} â€” {g.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea id="description" name="description" rows={2} defaultValue={cat.description ?? ''}
                className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm" />
            </div>

            <div className="md:col-span-2 flex gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="is_assessment" defaultChecked={cat.is_assessment} /> Counts as an assessment
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="is_fee" defaultChecked={cat.is_fee} /> Is a fee (penalty)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="active" defaultChecked={cat.active} /> Active
              </label>
            </div>

            <div className="md:col-span-2 flex justify-end"><Button type="submit">Save changes</Button></div>
          </form>
        </CardBody>
      </Card>
      </div>
    </div>
  );
}
