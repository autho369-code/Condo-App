// CSV export of all rented units with lease start/end dates.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth/me';

export const dynamic = 'force-dynamic';

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const me = await getMe();
  if (!me.auth_user_id || (!me.is_staff && !me.is_platform_operator)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const supabase = await createClient();
  const { data: tenants, error } = await (supabase as any)
    .from('tenants')
    .select(`
      first_name, last_name, email, phone, lease_start, lease_end, status,
      units(unit_number, buildings(name, associations(name))),
      owners(full_name, first_name, last_name, email)
    `)
    .is('archived_at', null)
    .order('lease_end', { ascending: true, nullsFirst: false });

  if (error) return new NextResponse(`Export failed: ${error.message}`, { status: 500 });

  const header = ['Association', 'Unit', 'Tenant', 'Tenant Email', 'Tenant Phone', 'Lease Start', 'Lease End', 'Status', 'Owner', 'Owner Email'];
  const lines = [header.join(',')];
  for (const t of tenants ?? []) {
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
