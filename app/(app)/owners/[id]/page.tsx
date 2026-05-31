import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { money, date } from '@/lib/utils';
import { updateOwner, linkOccupancy, endOccupancy } from '@/lib/rpcs/entities';

export const dynamic = 'force-dynamic';

function formatName(first?: string | null, last?: string | null, full?: string | null) {
  if (last && first) return `${last}, ${first}`;
  return full ?? [last, first].filter(Boolean).join(', ') ?? 'â€”';
}

export default async function OwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: owner },
    { data: occs },
    { data: srs },
    { data: violations },
    { data: units },
  ] = await Promise.all([
    (supabase as any).from('owners')
      .select('id, full_name, first_name, last_name, email, emails, phone, phone_numbers, address_street, address_city, address_state, address_zip, preferred_comm, notes, portal_activated, portal_login_last_at, created_at')
      .eq('id', id).is('archived_at', null).maybeSingle(),
    (supabase as any).from('occupancies')
      .select('id, occupancy_type, status, is_primary, share_pct, move_in_date, move_out_date, dues_amount, dues_frequency, online_portal_activated, units(id, unit_number, buildings(name, associations(id, name)))')
      .eq('owner_id', id)
      .order('status').order('move_in_date', { ascending: false }),
    (supabase as any).from('service_requests')
      .select('id, number, description, priority, status, created_at, units(unit_number)')
      .eq('owner_id', id).is('archived_at', null).order('created_at', { ascending: false }).limit(10),
    (supabase as any).from('violations')
      .select('id, title, status, date_observed, fine_amount, associations(name)')
      .eq('owner_id', id).is('archived_at', null).order('date_observed', { ascending: false }).limit(10),
    // All active units for the "Link to unit" dropdown
    (supabase as any).from('units')
      .select('id, unit_number, buildings(name, associations(name))')
      .is('archived_at', null)
      .order('unit_number'),
  ]);
  if (!owner) notFound();

  const currentOccs = (occs ?? []).filter((o: any) => o.status === 'current');
  const pastOccs    = (occs ?? []).filter((o: any) => o.status === 'past');
  const displayName = formatName(owner.first_name, owner.last_name, owner.full_name);
  const phones: any[] = Array.isArray(owner.phone_numbers) ? owner.phone_numbers : [];
  const emails: any[] = Array.isArray(owner.emails) ? owner.emails : [];

  return (
    <div className="mx-auto max-w-5xl px-8 py-6 space-y-4">
      {/* Breadcrumb */}
      <nav className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        <Link href="/owners" className="hover:text-brand-600">Owners</Link> Â· {displayName}
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{displayName}</h1>
          <div className="mt-1 text-sm text-gray-500">
            {owner.portal_activated
              ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Portal active</span>
              : <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Portal not activated</span>}
            {owner.portal_login_last_at && (
              <span className="ml-2">Last login: {date(owner.portal_login_last_at)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Contact */}
      <Section title="Contact">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-gray-500">Email</dt>
            <dd className="mt-0.5">
              {owner.email ? <a href={`mailto:${owner.email}`} className="text-blue-700 hover:underline">{owner.email}</a> : 'â€”'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-gray-500">Phone</dt>
            <dd className="mt-0.5">
              {phones.length > 0
                ? phones.map((p: any, i: number) => (
                    <div key={i}>
                      <a href={`tel:${p.number ?? p.value}`} className="text-blue-700 hover:underline">{p.number ?? p.value}</a>
                      {p.type && <span className="ml-1 text-xs text-gray-500">({p.type})</span>}
                    </div>
                  ))
                : owner.phone ? <a href={`tel:${owner.phone}`} className="text-blue-700 hover:underline">{owner.phone}</a> : 'â€”'}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wider text-gray-500">Mailing address</dt>
            <dd className="mt-0.5">
              {[owner.address_street, owner.address_city, owner.address_state, owner.address_zip].filter(Boolean).join(', ') || 'â€”'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-gray-500">Preferred comm</dt>
            <dd className="mt-0.5 capitalize">{owner.preferred_comm ?? 'â€”'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-gray-500">Added</dt>
            <dd className="mt-0.5">{date(owner.created_at)}</dd>
          </div>
          {owner.notes && (
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wider text-gray-500">Notes</dt>
              <dd className="mt-0.5 whitespace-pre-wrap">{owner.notes}</dd>
            </div>
          )}
        </dl>

        {/* Inline edit */}
        <details className="border-t border-gray-100 px-5 py-4">
          <summary className="cursor-pointer select-none text-sm font-medium text-blue-700 hover:underline">Edit contact</summary>
          <form action={updateOwner.bind(null, id) as any} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" name="first_name" defaultValue={owner.first_name ?? ''} />
            </div>
            <div>
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" name="last_name" defaultValue={owner.last_name ?? ''} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={owner.email ?? ''} />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" defaultValue={owner.phone ?? ''} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address_street">Street</Label>
              <Input id="address_street" name="address_street" defaultValue={owner.address_street ?? ''} />
            </div>
            <div>
              <Label htmlFor="address_city">City</Label>
              <Input id="address_city" name="address_city" defaultValue={owner.address_city ?? ''} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="address_state">State</Label>
                <Input id="address_state" name="address_state" maxLength={2} className="uppercase" defaultValue={owner.address_state ?? ''} />
              </div>
              <div>
                <Label htmlFor="address_zip">ZIP</Label>
                <Input id="address_zip" name="address_zip" defaultValue={owner.address_zip ?? ''} />
              </div>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea id="notes" name="notes" rows={3} defaultValue={owner.notes ?? ''}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        </details>
      </Section>

      {/* Occupancies â€” unit links */}
      <Section title="Units owned / occupied"
        right={<span className="text-xs text-gray-500">{currentOccs.length} current Â· {pastOccs.length} past</span>}>
        {(occs ?? []).length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-gray-500">Not yet linked to any units. Use the form below.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Unit</th>
                <th className="px-4 py-2 text-left font-semibold">Association</th>
                <th className="px-4 py-2 text-left font-semibold">Type</th>
                <th className="px-4 py-2 text-left font-semibold">Moved in</th>
                <th className="px-4 py-2 text-right font-semibold">Dues</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(occs ?? []).map((o: any) => (
                <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/units/${o.units?.id}`} className="font-medium text-blue-700 hover:underline">Unit {o.units?.unit_number ?? 'â€”'}</Link>
                    {o.is_primary && <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">primary</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{o.units?.buildings?.associations?.name ?? 'â€”'}</td>
                  <td className="px-4 py-2 text-sm capitalize">{o.occupancy_type}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{date(o.move_in_date)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{o.dues_amount ? money(o.dues_amount) : 'â€”'}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs capitalize ${
                      o.status === 'current' ? 'bg-green-100 text-green-700' :
                      o.status === 'future'  ? 'bg-blue-100 text-blue-700'  :
                      'bg-gray-100 text-gray-500'
                    }`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {o.status === 'current' && (
                      <form action={endOccupancy.bind(null, o.id, id) as any}>
                        <button type="submit" className="text-xs text-red-600 hover:underline">End</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <details className="border-t border-gray-100 px-5 py-4" {...((occs ?? []).length === 0 ? { open: true } : {})}>
          <summary className="cursor-pointer select-none text-sm font-medium text-blue-700 hover:underline">+ Link to a unit</summary>
          <form action={linkOccupancy.bind(null, id) as any} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-3">
              <Label htmlFor="unit_id">Unit <span className="text-red-500">*</span></Label>
              <select id="unit_id" name="unit_id" required
                className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
                <option value="">Choose a unitâ€¦</option>
                {(units ?? []).map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.buildings?.associations?.name} Â· Unit {u.unit_number}
                    {u.buildings?.name ? ` (${u.buildings.name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="occupancy_type">Type</Label>
              <select id="occupancy_type" name="occupancy_type" defaultValue="owner"
                className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
                <option value="owner">Owner</option>
              </select>
            </div>
            <div>
              <Label htmlFor="move_in_date">Move-in date</Label>
              <Input id="move_in_date" name="move_in_date" type="date" />
            </div>
            <div>
              <Label htmlFor="dues_amount">Monthly dues ($)</Label>
              <Input id="dues_amount" name="dues_amount" type="number" step="0.01" min="0" />
            </div>
            <div>
              <Label htmlFor="dues_frequency">Dues frequency</Label>
              <select id="dues_frequency" name="dues_frequency" defaultValue="monthly"
                className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <Label htmlFor="share_pct">Share %</Label>
              <Input id="share_pct" name="share_pct" type="number" step="0.01" min="0" max="100" defaultValue="100" />
            </div>
            <div className="md:col-span-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_primary" defaultChecked />
                Primary occupant
              </label>
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit">Link to unit</Button>
            </div>
          </form>
        </details>
      </Section>

      {/* Recent activity */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Section title={`Service requests (${srs?.length ?? 0})`}>
          {srs && srs.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {srs.map((s: any) => (
                <li key={s.id} className="px-4 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">SR {s.number ?? s.id.slice(0, 8)}</span>
                    <span className={`rounded px-2 py-0.5 text-xs capitalize ${
                      s.status === 'completed' ? 'bg-green-100 text-green-700' :
                      s.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                      'bg-amber-100 text-amber-800'
                    }`}>{s.status}</span>
                  </div>
                  <div className="truncate text-xs text-gray-500">{(s.description ?? '').split('\n')[0]}</div>
                  <div className="text-xs text-gray-400">Unit {s.units?.unit_number} Â· {date(s.created_at)}</div>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-6 text-center text-sm text-gray-500">No service requests on file.</p>}
        </Section>

        <Section title={`Violations (${violations?.length ?? 0})`}>
          {violations && violations.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {violations.map((v: any) => (
                <li key={v.id} className="px-4 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{v.title}</span>
                    {v.fine_amount != null && <span className="text-xs tabular-nums text-gray-700">{money(v.fine_amount)}</span>}
                  </div>
                  <div className="text-xs text-gray-500">{v.associations?.name} Â· {date(v.date_observed)}</div>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-6 text-center text-sm text-gray-500">No violations on file.</p>}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
