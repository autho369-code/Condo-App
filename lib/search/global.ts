// Global record search for the command palette. Runs on the caller's
// RLS-scoped client, so results are limited to what the user can already see.

import { vendorAssociationLabel } from '@/lib/vendors/options';

export type SearchResult = {
  id: string;
  type: 'association' | 'unit' | 'owner' | 'vendor' | 'work_order' | 'violation' | 'bill' | 'architectural_review' | 'meeting';
  title: string;
  subtitle?: string;
  href: string;
};

export const SEARCH_TYPE_LABEL: Record<SearchResult['type'], string> = {
  association: 'Associations',
  unit: 'Units',
  owner: 'Owners',
  vendor: 'Vendors',
  work_order: 'Work orders',
  violation: 'Violations',
  bill: 'Bills',
  architectural_review: 'Architectural reviews',
  meeting: 'Meetings',
};

/**
 * Normalize user input for a PostgREST `ilike`/`or` filter: drop characters
 * that carry meaning in the filter grammar (, ( ) *) or in LIKE (% _ \),
 * collapse whitespace, cap length.
 */
export function sanitizeSearchTerm(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/[,()*%_\\"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

const PER_TYPE = 5;
// Result pages guarded by requireStaff (managers only); a company admin who
// is not also a manager would be bounced to their own home page.
const STAFF_ONLY_TYPES = new Set<SearchResult['type']>(['unit', 'architectural_review']);

export async function searchEverything(db: any, rawQuery: string, options: { finance: boolean; staff?: boolean }): Promise<SearchResult[]> {
  const q = sanitizeSearchTerm(rawQuery);
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const numeric = /^\d{1,9}$/.test(q);

  const queries = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).ilike('name', like).limit(PER_TYPE),
    db.from('units').select('id, unit_number, buildings!inner(name, associations(name))').is('archived_at', null).ilike('unit_number', like).limit(PER_TYPE),
    db.from('owners').select('id, full_name, email, phone').is('archived_at', null)
      .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`).limit(PER_TYPE),
    db.from('vendors').select('id, name, is_management_company, associations(name)').is('archived_at', null).ilike('name', like).limit(PER_TYPE),
    (numeric
      ? db.from('work_orders').select('id, number, title, status, associations(name)').is('archived_at', null).or(`title.ilike.${like},number.eq.${q}`)
      : db.from('work_orders').select('id, number, title, status, associations(name)').is('archived_at', null).ilike('title', like)
    ).order('created_at', { ascending: false }).limit(PER_TYPE),
    db.from('violations').select('id, title, status, associations(name)').is('archived_at', null).ilike('title', like)
      .order('created_at', { ascending: false }).limit(PER_TYPE),
    options.finance
      ? db.from('payable_bills').select('id, bill_number, memo, amount, vendors(name)').is('archived_at', null)
          .or(`bill_number.ilike.${like},memo.ilike.${like}`).order('created_at', { ascending: false }).limit(PER_TYPE)
      : Promise.resolve({ data: [] }),
    db.from('architectural_requests').select('id, title, status, associations(name)').ilike('title', like)
      .order('created_at', { ascending: false }).limit(PER_TYPE),
    db.from('meetings').select('id, title, status, associations(name)').is('archived_at', null).ilike('title', like)
      .order('created_at', { ascending: false }).limit(PER_TYPE),
  ]);

  const [associations, units, owners, vendors, workOrders, violations, bills, reviews, meetings] = queries.map((r: any) => (r?.data ?? []) as any[]);
  const status = (s: string | null | undefined) => (s ? s.replace(/_/g, ' ') : undefined);
  const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ') || undefined;

  return [
    ...associations.map((a): SearchResult => ({ id: a.id, type: 'association', title: a.name, href: `/associations/${a.id}` })),
    ...units.map((u): SearchResult => ({ id: u.id, type: 'unit', title: `Unit ${u.unit_number}`, subtitle: join(u.buildings?.associations?.name, u.buildings?.name), href: `/units/${u.id}` })),
    ...owners.map((o): SearchResult => ({ id: o.id, type: 'owner', title: o.full_name ?? o.email ?? 'Owner', subtitle: join(o.email, o.phone), href: `/owners/${o.id}` })),
    ...vendors.map((v): SearchResult => ({ id: v.id, type: 'vendor', title: v.name, subtitle: vendorAssociationLabel(v), href: `/vendors/${v.id}` })),
    ...workOrders.map((w): SearchResult => ({ id: w.id, type: 'work_order', title: `${w.number ? `#${w.number} ` : ''}${w.title ?? 'Work order'}`, subtitle: join(w.associations?.name, status(w.status)), href: `/work-orders/${w.id}` })),
    ...violations.map((v): SearchResult => ({ id: v.id, type: 'violation', title: v.title, subtitle: join(v.associations?.name, status(v.status)), href: `/violations/${v.id}` })),
    ...bills.map((b): SearchResult => ({ id: b.id, type: 'bill', title: `Bill ${b.bill_number ?? b.id.slice(0, 8)}`, subtitle: join(b.vendors?.name, b.memo), href: `/bills/${b.id}` })),
    ...reviews.map((r): SearchResult => ({ id: r.id, type: 'architectural_review', title: r.title, subtitle: join(r.associations?.name, status(r.status)), href: `/architectural-reviews/${r.id}` })),
    ...meetings.map((m): SearchResult => ({ id: m.id, type: 'meeting', title: m.title, subtitle: join(m.associations?.name, status(m.status)), href: `/meetings/${m.id}` })),
  ].filter((r) => options.staff !== false || !STAFF_ONLY_TYPES.has(r.type));
}
