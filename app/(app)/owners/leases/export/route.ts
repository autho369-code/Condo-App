// CSV export of all rented units with lease start/end dates.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth/me';
import { csvCell } from '@/lib/csv/cell';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await getMe();
  if (!me.auth_user_id || (!me.is_staff && !me.is_platform_operator)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const supabase = await createClient();
  // Paged past PostgREST's 1,000-row cap so the file is complete.
  const { rows: tenants, error } = await fetchAllRows<any>(() => (supabase as any)
    .from('tenants')
    .select(`
      id, first_name, last_name, email, phone, lease_start, lease_end, status,
      units(unit_number, buildings(name, associations(name))),
      owners(full_name, first_name, last_name, email)
    `)
    .is('archived_at', null)
    .order('lease_end', { ascending: true, nullsFirst: false })
    .order('id'));

  if (error) return new NextResponse(`Export failed: ${error}`, { status: 500 });

  const header = ['Association', 'Unit', 'Tenant', 'Tenant Email', 'Tenant Phone', 'Lease Start', 'Lease End', 'Status', 'Owner', 'Owner Email'];
  const lines = [header.join(',')];
  for (const t of tenants) {
    const ownerName = t.owners?.full_name || [t.owners?.first_name, t.owners?.last_name].filter(Boolean).join(' ');
    lines.push([
      csvCell(t.units?.buildings?.associations?.name),
      csvCell(t.units?.unit_number),
      csvCell(`${t.first_name} ${t.last_name}`),
      csvCell(t.email),
      csvCell(t.phone),
      csvCell(t.lease_start),
      csvCell(t.lease_end),
      csvCell(t.status),
      csvCell(ownerName),
      csvCell(t.owners?.email),
    ].join(','));
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leases-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
