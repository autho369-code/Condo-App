import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

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

  // Every current occupancy (paged past PostgREST's 1,000-row cap): bulk
  // charges and statements must reach every unit. Ordering by an embedded
  // table does not order the parent rows, so sort by unit number below.
  const { rows: occs, error, truncated } = await fetchAllRows<any>(() => db
    .from('occupancies')
    .select('id, unit_id, owner_id, dues_amount, units!inner(unit_number, buildings!inner(associations!inner(name))), owners(full_name)')
    .eq('association_id', associationId)
    .eq('status', 'current')
    .order('id'));

  if (error) return NextResponse.json({ error }, { status: 500 });
  if (truncated) return NextResponse.json({ error: 'This association has too many units to load at once.' }, { status: 413 });

  occs.sort((a: any, b: any) => String(a.units?.unit_number ?? '').localeCompare(String(b.units?.unit_number ?? ''), undefined, { numeric: true }));

  const units = occs.map((occ: any) => ({
    unit_id: occ.unit_id,
    unit_number: occ.units?.unit_number ?? '?',
    association_name: occ.units?.buildings?.associations?.name ?? '',
    owner_name: occ.owners?.full_name ?? null,
    current_dues: occ.dues_amount ?? 0,
    occupancy_id: occ.id,
  }));

  return NextResponse.json({ units });
}
