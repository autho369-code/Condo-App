import Link from 'next/link';
import { ReportingTabs } from '@/components/reports/reporting-tabs';
import { MetricsTabs } from '@/components/reports/metrics-tabs';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Alert, SectionTitle } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;
// A U.S. number with optional country code, punctuation and extension; any
// other text in the field (a name, a note) makes it unusable for texting.
const VALID_PHONE = /^\+?1?[\s.-]*\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}(\s*(x|ext\.?)\s*\d+)?$/i;

type Row = { key: string; name: string; type: 'Owner' | 'Tenant'; phone: string; href: string };

function entries(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw === 'string') return raw.trim() ? [raw.trim()] : [];
  if (Array.isArray(raw)) return raw.flatMap(entries);
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return entries(o.number ?? o.phone ?? o.value ?? null);
  }
  return [String(raw)];
}

export default async function DataDiagnosticPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;

  const [owners, tenants] = await Promise.all([
    fetchAllRows<any>(() => db.from('owners').select('id, full_name, phone, phone_numbers').is('archived_at', null).order('id')),
    fetchAllRows<any>(() => db.from('tenants').select('id, first_name, last_name, phone, unit_id').is('archived_at', null).order('id')),
  ]);
  const loadError = owners.error ?? tenants.error ?? (owners.truncated || tenants.truncated ? 'There are more records than this page can check.' : null);

  const rows: Row[] = [];
  for (const o of owners.rows) {
    // phone_numbers can repeat the main phone; list each distinct bad value once.
    const bad = new Set([...entries(o.phone), ...entries(o.phone_numbers)].filter((p) => !VALID_PHONE.test(p)));
    for (const p of bad) rows.push({ key: `o-${o.id}-${p}`, name: o.full_name ?? 'Owner', type: 'Owner', phone: p, href: `/owners/${o.id}` });
  }
  for (const t of tenants.rows) {
    for (const p of new Set(entries(t.phone).filter((v) => !VALID_PHONE.test(v)))) {
      rows.push({
        key: `t-${t.id}-${p}`,
        name: [t.first_name, t.last_name].filter(Boolean).join(' ') || 'Tenant',
        type: 'Tenant',
        phone: p,
        href: t.unit_id ? `/units/${t.unit_id}` : '/units',
      });
    }
  }
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.phone.localeCompare(b.phone));

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const link = (p: number) => `/metrics/diagnostics?page=${p}`;

  return (
    <DataWorkspace title="Metrics" description="Records with data problems that block texting and calling, so they can be fixed at the source.">
      <ReportingTabs current="metrics" />
      <MetricsTabs current="diagnostics" />
      <div className="space-y-4">
        {loadError && <Alert tone="danger" title="Some records could not be checked">{loadError}</Alert>}
        <SectionTitle title="Invalid phone numbers" description="Phone fields that are not a ten-digit U.S. number, such as a number with a name or note added." />
        {rows.length === 0 && !loadError ? (
          <p className="text-sm text-gray-500">Every owner and tenant phone number is valid.</p>
        ) : (
          <>
            <Table>
              <THead><TR><TH>Name</TH><TH>Type</TH><TH>Phone number</TH><TH>Action</TH></TR></THead>
              <tbody>
                {shown.map((r) => (
                  <TR key={r.key}>
                    <TD className="font-medium text-gray-900">{r.name}</TD>
                    <TD>{r.type}</TD>
                    <TD className="tabular-nums">{r.phone}</TD>
                    <TD><Link href={r.href} className="font-medium text-gray-950 underline">Fix</Link></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Displaying {rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}</span>
              <span className="flex gap-3">
                {page > 1 && <Link href={link(page - 1)} className="underline">Previous</Link>}
                {page < pages && <Link href={link(page + 1)} className="underline">Next</Link>}
              </span>
            </div>
          </>
        )}
      </div>
    </DataWorkspace>
  );
}
