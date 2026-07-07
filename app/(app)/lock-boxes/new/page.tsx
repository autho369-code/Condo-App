import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewLockBoxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: associations }, { data: buildings }, { data: units }] = await Promise.all([
    (supabase as any).from('associations').select('id, name').is('archived_at', null).order('name'),
    (supabase as any).from('buildings').select('id, name, association_id').order('name'),
    (supabase as any).from('units').select('id, unit_number, building_id').is('archived_at', null).order('unit_number').limit(1000),
  ]);

  async function createLockBox(formData: FormData) {
    'use server';
    const me2 = await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/lock-boxes/new?error=${encodeURIComponent(msg)}`);
    const serial = ((formData.get('serial_number') as string) || '').trim();
    if (!serial) fail('Serial number is required.');
    const keysRaw = ((formData.get('keys_contained') as string) || '').trim();
    const { error } = await (sb as any).from('lock_boxes').insert({
      portfolio_id: me2.portfolio?.id,
      association_id: ((formData.get('association_id') as string) || '').trim() || null,
      building_id: ((formData.get('building_id') as string) || '').trim() || null,
      unit_id: ((formData.get('unit_id') as string) || '').trim() || null,
      serial_number: serial,
      combination: ((formData.get('combination') as string) || '').trim() || null,
      location_description: ((formData.get('location_description') as string) || '').trim() || null,
      location_type: ((formData.get('location_type') as string) || 'building'),
      status: 'active',
      keys_contained: keysRaw ? keysRaw.split(',').map((k) => k.trim()).filter(Boolean) : null,
      key_count: keysRaw ? keysRaw.split(',').map((k) => k.trim()).filter(Boolean).length : 0,
      notes: ((formData.get('notes') as string) || '').trim() || null,
    });
    if (error) fail(error.message);
    revalidatePath('/lock-boxes');
    redirect('/lock-boxes');
  }

  const selectClass = 'mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';

  return (
    <DataWorkspace
      title="Add Lock Box"
      description="Register a lock box: where it lives, its combination, and the keys inside."
      actions={<Link href="/lock-boxes"><Button variant="secondary">Cancel</Button></Link>}
    >
      <div className="max-w-2xl space-y-4">
        {sp.error && <Alert tone="danger" title="Could not add lock box">{sp.error}</Alert>}
        <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <form action={createLockBox} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="serial_number">Serial number *</Label>
              <Input id="serial_number" name="serial_number" required placeholder="e.g. LB-1043" />
            </div>
            <div>
              <Label htmlFor="combination">Combination</Label>
              <Input id="combination" name="combination" autoComplete="off" placeholder="Stored securely, staff-only" />
            </div>
            <div>
              <Label htmlFor="location_type">Location type</Label>
              <select id="location_type" name="location_type" defaultValue="building" className={selectClass}>
                <option value="building">Building</option>
                <option value="unit">Unit</option>
                <option value="gate">Gate</option>
                <option value="entrance">Entrance</option>
                <option value="pool">Pool</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="location_description">Location description</Label>
              <Input id="location_description" name="location_description" placeholder="e.g. North entrance railing" />
            </div>
            <div>
              <Label htmlFor="association_id">Association</Label>
              <select id="association_id" name="association_id" defaultValue="" className={selectClass}>
                <option value="">— None —</option>
                {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="building_id">Building</Label>
              <select id="building_id" name="building_id" defaultValue="" className={selectClass}>
                <option value="">— None —</option>
                {(buildings ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="unit_id">Unit</Label>
              <select id="unit_id" name="unit_id" defaultValue="" className={selectClass}>
                <option value="">— None —</option>
                {(units ?? []).map((u: any) => <option key={u.id} value={u.id}>Unit {u.unit_number}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="keys_contained">Keys contained (comma-separated)</Label>
              <Input id="keys_contained" name="keys_contained" placeholder="e.g. Front door, Mail room, Boiler room" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit">Add lock box</Button>
            </div>
          </form>
        </div>
      </div>
    </DataWorkspace>
  );
}
