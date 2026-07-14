import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FieldCaptureForm } from '@/components/violations/field-capture-form';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Phone-first violation capture for managers walking the property: snap
 * photos, auto-GPS, pick a unit, done. Single column, big touch targets —
 * the desktop-grade form lives at /violations/new.
 */
export default async function ViolationFieldCapturePage() {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  // RLS scopes both lists to the associations this staffer manages.
  const [{ data: associations }, { data: units }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('units')
      .select('id, unit_number, buildings!inner(association_id)')
      .is('archived_at', null)
      .order('unit_number')
      .limit(2000),
  ]);

  const unitOptions = (units ?? []).map((u: any) => ({
    id: u.id as string,
    unit_number: u.unit_number as string,
    association_id: (u.buildings as any)?.association_id as string,
  }));

  return (
    <DataWorkspace
      title="Field capture"
      description="File a violation from the property — photos and GPS attach automatically."
      actions={<Link href="/violations" className="text-sm font-medium text-gray-600 hover:text-gray-950">Cancel</Link>}
    >
      <FieldCaptureForm
        associations={(associations ?? []).map((a: any) => ({ id: a.id as string, name: a.name as string }))}
        units={unitOptions}
      />
    </DataWorkspace>
  );
}
