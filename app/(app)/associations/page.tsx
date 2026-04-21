import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10;

export default async function AssociationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; order?: string; hidden?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;

  const page     = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const sortCol  = sp.sort  === 'units' ? 'unit_count' : 'name';
  const sortOrder = sp.order === 'desc' ? 'desc' : 'asc';
  const showHidden = sp.hidden === '1';

  const supabase = await createClient();

  let q = supabase
    .from('associations')
    .select('id, name, address, address_line_2, city, state, zip, unit_count, archived_at', { count: 'exact' });
  if (!showHidden) q = q.is('archived_at', null);

  q = q.order(sortCol, { ascending: sortOrder === 'asc', nullsFirst: false });

  const from = (page - 1) * PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1;

  const { data: rows, count } = await q.range(from, to);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const nextOrder = sortCol === 'name' && sortOrder === 'asc' ? 'desc' : 'asc';
  const sortHref = (col: 'name' | 'units') => {
    const p = new URLSearchParams();
    p.set('sort', col);
    p.set('order', col === sortCol ? nextOrder : 'asc');
    if (showHidden) p.set('hidden', '1');
    return `?${p.toString()}`;
  };

  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    if (n > 1) p.set('page', String(n));
    if (sp.sort)  p.set('sort', sp.sort);
    if (sp.order) p.set('order', sp.order);
    if (showHidden) p.set('hidden', '1');
    const qs = p.toString();
    return qs ? `?${qs}` : '/associations';
  };

  const displayFrom = total === 0 ? 0 : from + 1;
  const displayTo   = Math.min(from + (rows?.length ?? 0), total);

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-4">
          <nav className="mb-2 border-b border-gray-200">
            <span className="inline-block border-b-2 border-brand-600 pb-2 text-sm font-semibold text-brand-700">
              Associations
            </span>
          </nav>

          <h1 className="mb-2 text-2xl font-semibold text-gray-900">Associations</h1>
          <p className="mb-4 text-sm text-gray-600">Click on any row to view association information.</p>

          <div className="overflow-hidden rounded border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">
                    <Link href={sortHref('name')} className="inline-flex items-center gap-1 hover:text-brand-600">
                      Name {sortCol === 'name' && <span className="text-gray-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                    </Link>
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">
                    <Link href={sortHref('units')} className="inline-flex items-center gap-1 hover:text-brand-600">
                      Units {sortCol === 'unit_count' && <span className="text-gray-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                    </Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-10 text-center text-sm text-gray-500">
                      {showHidden ? 'No hidden associations.' : 'No associations yet. Use "New Association" in the Tasks panel →'}
                    </td>
                  </tr>
                ) : (rows ?? []).map((a: any) => (
                  <tr
                    key={a.id}
                    className={`border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${a.archived_at ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/associations/${a.id}`} className="text-blue-700 hover:underline">
                        {a.name}
                      </Link>
                      {a.address && <div className="mt-0.5 text-gray-700">{a.address}</div>}
                      {a.address_line_2 && <div className="text-gray-700">{a.address_line_2}</div>}
                      {(a.city || a.state || a.zip) && (
                        <div className="text-gray-700">
                          {[a.city, a.state].filter(Boolean).join(', ')}{a.zip ? ` ${a.zip}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-gray-700">{a.unit_count ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-600">Displaying: {displayFrom}-{displayTo} of {total}</span>

            {totalPages > 1 && (
              <nav className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 3) }).map((_, i) => {
                  const n = i + 1;
                  const on = n === page;
                  return (
                    <Link key={n} href={pageHref(n)}
                      className={`flex h-8 w-8 items-center justify-center rounded border text-sm ${on ? 'border-blue-300 bg-blue-100 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
                      {n}
                    </Link>
                  );
                })}
                {totalPages > 3 && <span className="px-2 text-gray-500">…</span>}
                {page < totalPages && (
                  <Link href={pageHref(page + 1)} className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-sm hover:bg-gray-50">›</Link>
                )}
                {page < totalPages && (
                  <Link href={pageHref(totalPages)} className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-sm hover:bg-gray-50">»</Link>
                )}
              </nav>
            )}
          </div>

          <div className="mt-4">
            {showHidden ? (
              <Link href="/associations" className="text-sm text-blue-700 hover:underline">← Back to active associations</Link>
            ) : (
              <Link href="/associations?hidden=1" className="text-sm text-blue-700 hover:underline">Show Hidden Associations</Link>
            )}
          </div>
        </div>
      </div>

      {/* Right panel — Associations LIST view (not detail) */}
      <ContextPanel title="Tasks">
        <PanelSection title="Calendar" icon="📅">
          <PanelLink href="/calendar">View Calendar</PanelLink>
        </PanelSection>
        <PanelSection title="Tasks" icon="★">
          <PanelLink href="/units/new">New Property</PanelLink>
          <PanelLink href="/associations/new">New Association</PanelLink>
          <PanelLink href="/calendar/new?type=board_meeting">Meeting Sign-In</PanelLink>
          <PanelLink href="/compliance">Violations Field Entry</PanelLink>
          <PanelLink href="/scheduled-reports">Bulk Update Board Reports</PanelLink>
        </PanelSection>
        <PanelSection title="Reports" icon="▤">
          <PanelLink href="/reports/owner_directory">Owner Directory</PanelLink>
          <PanelLink href="/units">Unit Directory</PanelLink>
          <PanelLink href="/owners?view=tenants">Tenant Directory</PanelLink>
          <PanelLink href="/reports/dues_roll">Dues Roll</PanelLink>
          <PanelLink href="/reports/general_ledger">General Ledger</PanelLink>
        </PanelSection>
        <PanelSection title="Statements" icon="▤">
          <PanelLink href="/bulk-statement-settings/new">Bulk Update Statement Settings</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics" icon="?">
          <PanelLink href="/onboard">Import a New Association</PanelLink>
          <PanelLink href="#">Managing HOAs</PanelLink>
          <PanelLink href="#">Managing Property Groups</PanelLink>
          <PanelLink href="#">Sending Owner Statements</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
