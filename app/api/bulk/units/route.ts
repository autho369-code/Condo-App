import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Staff-only: server actions/route handlers are callable endpoints, so the
  // guard lives in the handler itself (middleware alone is not sufficient).
  try {
    await (await import('@/lib/auth/me')).requireStaff();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const associationId = searchParams.get('association_id');
  if (!associationId) return NextResponse.json({ error: 'association_id required' }, { status: 400 });

  const supabase = await createClient();
  const db = supabase as any;

  const { data: occs, error } = await db
    .from('occupancies')
    .select('unit_id, owner_id, dues_amount, units!inner(unit_number, associations!inner(name)), owners(full_name)')
    .eq('association_id', associationId)
    .eq('status', 'current')
    .is('archived_at', null)
    .order('unit_number', { foreignTable: 'units' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const units = (occs ?? []).map((occ: any) => ({
    unit_id: occ.unit_id,
    unit_number: occ.units?.unit_number ?? '?',
    association_name: occ.units?.associations?.name ?? '',
    owner_name: occ.owners?.full_name ?? null,
    current_dues: occ.dues_amount ?? 0,
    occupancy_id: occ.id,
  }));

  return NextResponse.json({ units });
}
