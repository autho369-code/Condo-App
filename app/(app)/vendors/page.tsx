import Link from 'next/link';

import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

function firstJsonValue(value: unknown) {
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0] as { value?: string; number?: string; email?: string };
    return first.value ?? first.number ?? first.email ?? '';
  }
  if (typeof value === 'string') return value;
  return '';
}

function buildHref(params: { q?: string; trade?: string; page?: number }) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.trade && params.trade !== 'all') search.set('trade', params.trade);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const query = search.toString();
  return `/vendors${query ? `?${query}` : ''}`;
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; trade?: string; page?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const qLower = q.toLowerCase();
  const trade = sp.trade ?? 'all';
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from('vendors')
    .select('id, name, trade, emails, phone_numbers, address_street, address_city, address_state, archived_at')
    .is('archived_at', null)
    .order('name');

  const allRows = data ?? [];
  const trades: string[] = Array.from(new Set(allRows.map((vendor: any) => vendor.trade).filter(Boolean) as string[])).sort();
  let rows = allRows;

  if (trade !== 'all') rows = rows.filter((vendor: any) => vendor.trade === trade);
  if (qLower) {
    rows = rows.filter((vendor: any) =>
      [vendor.name, vendor.trade, firstJsonValue(vendor.emails), firstJsonValue(vendor.phone_numbers), vendor.address_street].some((value) =>
        value?.toLowerCase().includes(qLower),
      ),
    );
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="px-8 py-6">
      <nav className="mb-7 flex flex-wrap gap-5 text-sm">
        <Link href="/owners" className="border-b-2 border-transparent px-1 pb-2 text-ink-700 hover:text-ink-900">Owners</Link>
        <Link href="/owners?view=directory" className="border-b-2 border-transparent px-1 pb-2 text-ink-700 hover:text-ink-900">Owners</Link>
        <Link href="/vendors" className="border-b-2 border-brand-600 px-1 pb-2 font-semibold text-brand-700">Vendors</Link>
      </nav>

      <h1 className="mb-7 border-b border-ink-100 pb-3 text-3xl font-normal text-ink-900">Vendors</h1>

      <form action="/vendors" className="mb-5 flex flex-wrap items-end gap-4">
        <label className="text-sm text-ink-600">
          Vendor
          <input name="q" defaultValue={q} className="mt-2 h-10 w-72 border border-ink-300 bg-white px-3 text-sm text-ink-900" />
        </label>
        <label className="text-sm text-ink-600">
          Trade
          <select name="trade" defaultValue={trade} className="mt-2 h-10 w-80 border border-ink-300 bg-white px-3 text-sm text-ink-900">
            <option value="all">All trades</option>
            {trades.map((item) => (
              <option key={item} value={item}>{String(item).replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-10 border border-ink-900 px-4 text-sm text-ink-900 hover:bg-cream-50">
          More Filters...
        </button>
        <Link href="/vendors" className="inline-flex h-10 items-center rounded bg-ink-100 px-4 text-sm text-ink-400">
          Clear Filters
        </Link>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-200 bg-[#dde1e5] text-left text-ink-900">
            <th className="px-3 py-2 font-medium">Name ^</th>
            <th className="px-3 py-2 font-medium">Address</th>
            <th className="px-3 py-2 font-medium">Trades</th>
            <th className="px-3 py-2 font-medium">Phone</th>
            <th className="px-3 py-2 font-medium">Email</th>
          </tr>
        </thead>
        <tbody>
          {pagedRows.length === 0 ? (
            <tr>
              <td colSpan={5} className="border-b border-ink-100 px-3 py-10 text-center text-ink-500">
                No vendors match this filter.
              </td>
            </tr>
          ) : (
            pagedRows.map((vendor: any, index: number) => (
              <tr key={vendor.id} className={`border-b border-ink-100 hover:bg-cream-50 ${index % 2 === 1 ? 'bg-[#eef0f2]' : ''}`}>
                <td className="px-3 py-2 align-top">
                  <Link href={`/vendors?selected=${vendor.id}`} className="text-blue-700 hover:underline">{vendor.name}</Link>
                </td>
                <td className="px-3 py-2 align-top">
                  {[vendor.address_street, vendor.address_city, vendor.address_state].filter(Boolean).join(' ')}
                </td>
                <td className="px-3 py-2 align-top capitalize">{vendor.trade?.replace(/_/g, ' ') ?? ''}</td>
                <td className="px-3 py-2 align-top">{firstJsonValue(vendor.phone_numbers)}</td>
                <td className="px-3 py-2 align-top">
                  {firstJsonValue(vendor.emails) ? (
                    <a href={`mailto:${firstJsonValue(vendor.emails)}`} className="text-blue-700 hover:underline">
                      {firstJsonValue(vendor.emails)}
                    </a>
                  ) : ''}
                </td>
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
          {safePage > 1 && <Link href={buildHref({ q, trade, page: safePage - 1 })} className="px-2 py-1 text-ink-700 hover:bg-cream-100">&lt;</Link>}
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((item) => (
            <Link
              key={item}
              href={buildHref({ q, trade, page: item })}
              className={`rounded px-2 py-1 ${item === safePage ? 'bg-blue-100 text-blue-800' : 'text-ink-700 hover:bg-cream-100'}`}
            >
              {item}
            </Link>
          ))}
          {safePage < totalPages && <Link href={buildHref({ q, trade, page: safePage + 1 })} className="px-2 py-1 text-ink-700 hover:bg-cream-100">&gt;</Link>}
        </div>
      </div>
    </div>
  );
}
