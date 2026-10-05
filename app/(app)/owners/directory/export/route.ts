// CSV export of the owner directory (name, association/unit, contact info).
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth/me';
import { csvCell } from '@/lib/csv/cell';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone } from '@/lib/time/zoned';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await getMe();
  if (!me.auth_user_id || (!me.is_staff && !me.is_platform_operator)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const supabase = await createClient();
  const db = supabase as any;
  // Paged: a company with more than 1,000 owners got a silently cut-off file.
  const [ownersResult, occsResult, scopedResult] = await Promise.all([
    fetchAllRows<any>(() => db
      .from('owners')
      .select('id, full_name, first_name, last_name, email, phone, phone_numbers, portal_activated')
      .is('archived_at', null)
      .order('last_name')
      .order('id')),
    fetchAllRows<any>(() => db
      .from('occupancies')
      .select('id, owner_id, units(unit_number, buildings(name, associations(name)))')
      .eq('status', 'current')
      .order('id')),
    db.rpc('manager_is_scoped'),
  ]);
  const error = ownersResult.error ?? occsResult.error ?? scopedResult.error?.message ?? null;
  if (error) return new NextResponse(`Export failed: ${error}`, { status: 500 });

  const occByOwner = new Map<string, any>();
  for (const o of occsResult.rows) {
    if (!occByOwner.has(o.owner_id)) occByOwner.set(o.owner_id, o);
  }
  // Owners carry no association, so RLS shows a scoped manager every owner in
  // the company; export only owners in the associations they manage.
  const owners = scopedResult.data === true
    ? ownersResult.rows.filter((o: any) => occByOwner.has(o.id))
    : ownersResult.rows;

  const header = ['Owner', 'Association', 'Building', 'Unit', 'Email', 'Phone', 'Portal Active'];
  const lines = [header.join(',')];
  for (const o of owners) {
    const occ = occByOwner.get(o.id);
    const name = o.last_name && o.first_name ? `${o.last_name}, ${o.first_name}` : (o.full_name ?? '');
    const phone = o.phone ?? (Array.isArray(o.phone_numbers) ? (o.phone_numbers[0]?.number ?? o.phone_numbers[0] ?? '') : '');
    lines.push([
      csvCell(name),
      csvCell(occ?.units?.buildings?.associations?.name),
      csvCell(occ?.units?.buildings?.name),
      csvCell(occ?.units?.unit_number),
      csvCell(o.email),
      csvCell(typeof phone === 'object' ? JSON.stringify(phone) : phone),
      csvCell(o.portal_activated ? 'Yes' : 'No'),
    ].join(','));
  }

  return new NextResponse(lines.join('\n') + '\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="owner-directory-${todayInZone()}.csv"`,
    },
  });
}
