import Link from 'next/link';

import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const PAGE_SIZE = 20;

type OwnerRow = {
  id: string;
  name: string;
  lastInitial: string;
  email: string | null;
  phone: string | null;
  associationName: string | null;
  associationAddress: string | null;
  unitNumber: string | null;
  occupancyType: string | null;
};

function formatName(first?: string | null, last?: string | null, full?: string | null) {
  if (last && first) return `${last}, ${first}`;
  return full ?? ([last, first].filter(Boolean).join(', ') || 'Unknown owner');
}

function firstPhone(phoneNumbers: unknown, phone: string | null) {
  if (Array.isArray(phoneNumbers) && phoneNumbers.length > 0) {
    const first = phoneNumbers[0] as { number?: string; value?: string };
    return first.number ?? first.value ?? phone;
  }
  return phone;
}

function assocAddress(association: any) {
  if (!association) return null;
  return [association.address, [association.city, association.state].filter(Boolean).join(', '), association.zip]
    .filter(Boolean)
    .join(' ');
}

function buildHref(view: string, letter: string, page = 1) {
  const params = new URLSearchParams();
  if (view === 'directory') params.set('view', 'directory');
  if (letter !== 'all') params.set('letter', letter);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return `/owners${query ? `?${query}` : ''}`;
}

export default async function OwnersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; letter?: string; page?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const view = sp.view === 'directory' ? 'directory' : 'homeowners';
  const letter = sp.letter ?? 'all';
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const supabase = await createClient();

  const [{ data: owners }, { data: occupancies }] = await Promise.all([
    (supabase as any)
      .from('owners')
      .select('id, full_name, first_name, last_name, email, phone, phone_numbers, archived_at')
      .is('archived_at', null)
      .order('last_name', { ascending: true }),
    (supabase as any)
      .from('occupancies')
      .select(`
        id,
        owner_id,
        occupancy_type,
        status,
        units(unit_number, buildings(associations(id, name, address, city, state, zip)))
      `)
      .eq('status', 'current'),
  ]);

  const occupancyByOwner = new Map<string, any>();
  for (const occupancy of occupancies ?? []) {
    if (!occupancyByOwner.has((occupancy as any).owner_id)) {
      occupancyByOwner.set((occupancy as any).owner_id, occupancy);
    }
  }

  let rows: OwnerRow[] = (owners ?? []).map((owner: any) => {
    const occupancy = occupancyByOwner.get(owner.id);
    const association = occupancy?.units?.buildings?.associations;
    return {
      id: owner.id,
      name: formatName(owner.first_name, owner.last_name, owner.full_name),
      lastInitial: (owner.last_name?.[0] ?? owner.full_name?.[0] ?? '').toUpperCase(),
      email: owner.email,
      phone: firstPhone(owner.phone_numbers, owner.phone),
      associationName: association?.name ?? null,
      associationAddress: assocAddress(association),
      unitNumber: occupancy?.units?.unit_number ?? null,
      occupancyType: occupancy?.occupancy_type ?? null,
    };
  });

  if (view === 'homeowners') rows = rows.filter((row) => row.occupancyType === 'owner');
  if (letter !== 'all') rows = rows.filter((row) => row.lastInitial === letter);

  const availableLetters = new Set(rows.map((row) => row.lastInitial).filter(Boolean));
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const title = view === 'directory' ? 'Owners' : 'Homeowners';

  return (
    <div className="px-8 py-6">
      <nav className="mb-7 flex flex-wrap gap-5 text-sm">
        <Link href="/owners" className={`border-b-2 px-1 pb-2 ${view === 'homeowners' ? 'border-brand-600 font-semibold text-brand-700' : 'border-transparent text-ink-700 hover:text-ink-900'}`}>
          Homeowners
        </Link>
        <Link href="/owners?view=directory" className={`border-b-2 px-1 pb-2 ${view === 'directory' ? 'border-brand-600 font-semibold text-brand-700' : 'border-transparent text-ink-700 hover:text-ink-900'}`}>
          Owners
        </Link>
        <Link href="/vendors" className="border-b-2 border-transparent px-1 pb-2 text-ink-700 hover:text-ink-900">
          Vendors
        </Link>
      </nav>

      <h1 className="mb-8 text-3xl font-normal text-ink-900">{title}</h1>

      <div className="mb-4 flex flex-wrap justify-end gap-1 text-sm">
        {LETTERS.map((item) => (
          <Link
            key={item}
            href={buildHref(view, item)}
            className={`px-2 py-1 ${letter === item ? 'border border-blue-200 bg-blue-100 text-blue-800' : availableLetters.has(item) ? 'text-blue-700 hover:underline' : 'pointer-events-none text-ink-300'}`}
          >
            {item}
          </Link>
        ))}
        <Link href={buildHref(view, 'all')} className={`px-2 py-1 ${letter === 'all' ? 'border border-blue-200 bg-blue-100 text-blue-800' : 'text-blue-700 hover:underline'}`}>
          All
        </Link>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-200 bg-[#dde1e5] text-left text-ink-900">
            {view === 'directory' ? (
              <>
                <th className="px-3 py-2 font-medium">Name ^</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Email</th>
              </>
            ) : (
              <>
                <th className="px-3 py-2 font-medium">Name ^</th>
                <th className="px-3 py-2 font-medium">Association</th>
                <th className="px-3 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 font-medium">Phone</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {pagedRows.length === 0 ? (
            <tr>
              <td colSpan={4} className="border-b border-ink-100 px-3 py-10 text-center text-ink-500">
                No records match this filter.
              </td>
            </tr>
          ) : (
            pagedRows.map((row) => (
              <tr key={row.id} className="border-b border-ink-100 hover:bg-cream-50">
                {view === 'directory' ? (
                  <>
                    <td className="px-3 py-3 align-top">
                      <Link href={`/owners/${row.id}`} className="text-blue-700 hover:underline">{row.associationName ?? row.name}</Link>
                    </td>
                    <td className="px-3 py-3 align-top">{row.associationName ?? row.name}</td>
                    <td className="px-3 py-3 align-top">{row.phone ?? ''}</td>
                    <td className="px-3 py-3 align-top">
                      {row.email ? <a href={`mailto:${row.email}`} className="text-blue-700 hover:underline">{row.email}</a> : ''}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-3 align-top">
                      <Link href={`/owners/${row.id}`} className="text-blue-700 hover:underline">{row.name}</Link>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div>{row.associationName ?? ''}</div>
                      {row.associationAddress && <div>{row.associationAddress}</div>}
                    </td>
                    <td className="px-3 py-3 align-top">{row.unitNumber ?? ''}</td>
                    <td className="px-3 py-3 align-top">{row.phone ?? ''}</td>
                  </>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-7 flex items-center justify-between text-sm text-ink-700">
        <span>
          Displaying: {rows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, rows.length)} of {rows.length}
        </span>
        <div className="flex items-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((item) => (
            <Link
              key={item}
              href={buildHref(view, letter, item)}
              className={`rounded px-2 py-1 ${item === safePage ? 'bg-blue-100 text-blue-800' : 'text-ink-700 hover:bg-cream-100'}`}
            >
              {item}
            </Link>
          ))}
          {safePage < totalPages && <Link href={buildHref(view, letter, safePage + 1)} className="px-2 py-1 text-ink-700 hover:bg-cream-100">&gt;</Link>}
        </div>
      </div>
    </div>
  );
}
