import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';

export const dynamic = 'force-dynamic';

const LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

type Row = {
  rowKey: string;       // stable key for React
  owner_id: string;
  name: string;
  last_initial: string;
  associationName: string | null;
  associationAddress: string | null;
  unit_number: string | null;
  phone: string | null;
};

function formatName(first?: string | null, last?: string | null, full?: string | null): string {
  if (last && first) return `${last}, ${first}`;
  return full ?? [last, first].filter(Boolean).join(', ') ?? '—';
}
function firstPhone(phoneNumbers: any, phone: string | null): string | null {
  if (Array.isArray(phoneNumbers) && phoneNumbers.length > 0) {
    return phoneNumbers[0].number ?? phoneNumbers[0].value ?? null;
  }
  return phone ?? null;
}
function assocAddress(a: any): string | null {
  if (!a) return null;
  return [a.address, [a.city, a.state].filter(Boolean).join(', '), a.zip].filter(Boolean).join(' ');
}

export default async function OwnersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; letter?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const view: 'owners' | 'tenants' =
    sp.view === 'tenants' ? 'tenants' : 'owners';
  const letter = sp.letter ?? 'all';

  const supabase = await createClient();

  let rows: Row[] = [];

  if (view === 'owners' || view === 'tenants') {
    // Current occupancies — filter by type.
    // Owners = owners of their unit. Tenants = renters.
    const occType = view === 'tenants' ? 'tenant' : 'owner';
    const { data: occs } = await supabase
      .from('occupancies')
      .select(`
        id,
        owner:owner_id(id, full_name, first_name, last_name, phone, phone_numbers),
        units(unit_number, buildings(associations(id, name, address, city, state, zip)))
      `)
      .eq('status', 'current')
      .eq('occupancy_type', occType);

    rows = (occs ?? [])
      .filter((o: any) => o.owner)
      .map((o: any) => {
        const ownr  = o.owner;
        const assoc = o.units?.buildings?.associations;
        return {
          rowKey:             o.id,
          owner_id:           ownr.id,
          name:               formatName(ownr.first_name, ownr.last_name, ownr.full_name),
          last_initial:       (ownr.last_name?.[0] ?? ownr.full_name?.[0] ?? '').toUpperCase(),
          associationName:    assoc?.name ?? null,
          associationAddress: assocAddress(assoc),
          unit_number:        o.units?.unit_number ?? null,
          phone:              firstPhone(ownr.phone_numbers, ownr.phone),
        };
      });
  } else {
    // Full owners directory — includes owners without current occupancies (non-resident investors)
    const { data: owners } = await supabase
      .from('owners')
      .select('id, full_name, first_name, last_name, phone, phone_numbers')
      .is('archived_at', null);

    rows = (owners ?? []).map((ownr: any) => ({
      rowKey:             ownr.id,
      owner_id:           ownr.id,
      name:               formatName(ownr.first_name, ownr.last_name, ownr.full_name),
      last_initial:       (ownr.last_name?.[0] ?? ownr.full_name?.[0] ?? '').toUpperCase(),
      associationName:    null,
      associationAddress: null,
      unit_number:        null,
      phone:              firstPhone(ownr.phone_numbers, ownr.phone),
    }));
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));

  const availableLetters = new Set(rows.map((r) => r.last_initial).filter(Boolean));
  if (letter !== 'all') {
    rows = rows.filter((r) => r.last_initial === letter);
  }

  const buildLetterHref = (l: string) => `/owners?view=${view}${l === 'all' ? '' : `&letter=${l}`}`;

  return (
    <div className="px-8 py-4">
      {/* Tabs row */}
      <nav className="mb-4 flex gap-6 border-b border-gray-200">
        <Link href="/owners"
          className={`border-b-2 px-1 pb-2 text-sm transition ${view === 'owners' ? 'border-brand-600 font-semibold text-brand-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
          Owners
        </Link>
        <Link href="/owners?view=tenants"
          className={`border-b-2 px-1 pb-2 text-sm transition ${view === 'tenants' ? 'border-brand-600 font-semibold text-brand-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
          Tenants
        </Link>
        <Link href="/vendors"
          className="border-b-2 border-transparent px-1 pb-2 text-sm text-gray-600 hover:text-gray-900">
          Vendors
        </Link>
      </nav>

      <h1 className="mb-3 text-2xl font-semibold text-gray-900">
        {view === 'tenants' ? 'Tenants' : 'Owners'}
      </h1>

      {/* Alphabet filter */}
      <nav className="mb-3 flex flex-wrap items-center justify-center gap-1 text-sm">
        {LETTERS.map((l) => {
          const on = letter === l;
          const has = availableLetters.has(l);
          return (
            <Link
              key={l}
              href={buildLetterHref(l)}
              className={`rounded px-2 py-0.5 text-blue-700 hover:underline ${on ? 'bg-blue-100 font-semibold' : ''} ${!has ? 'pointer-events-none text-gray-400' : ''}`}
            >
              {l}
            </Link>
          );
        })}
        <Link href={buildLetterHref('all')}
          className={`rounded px-2 py-0.5 text-blue-700 hover:underline ${letter === 'all' ? 'bg-blue-100 font-semibold' : ''}`}>
          All
        </Link>
      </nav>

      {/* Table */}
      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-white text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Name <span className="text-gray-400">↑</span></th>
              <th className="px-4 py-2 text-left font-semibold">Association</th>
              <th className="px-4 py-2 text-left font-semibold">Unit</th>
              <th className="px-4 py-2 text-left font-semibold">Phone</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">No {view} match this filter.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.rowKey} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/owners/${r.owner_id}`} className="text-blue-700 hover:underline">{r.name}</Link>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {r.associationName ? (
                    <>
                      {r.associationName}
                      {r.associationAddress && <> - {r.associationAddress}</>}
                    </>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-700">{r.unit_number ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700">{r.phone ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
