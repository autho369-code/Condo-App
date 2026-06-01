import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { WorkspaceHeader } from '@/components/workspace/shell';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

type PortfolioRow = Record<string, any>;
type AssociationRow = Record<string, any>;

interface AssociationViewModel {
  id: string;
  name: string;
  companyName: string;
  portfolioId: string;
  city: string;
  state: string;
  units: number;
  status: string;
  createdAt: string;
}

// ─── Status Badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-emerald-400/15 text-emerald-300 ring-emerald-400/40',
  inactive:  'bg-gray-500/20 text-gray-400 ring-gray-500/30',
  suspended: 'bg-rose-400/15 text-rose-300 ring-rose-400/40',
  pending:   'bg-amber-400/15 text-amber-300 ring-amber-400/40',
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES['active'];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function AssociationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const search = typeof sp.search === 'string' ? sp.search.trim() : '';
  const companyFilter = typeof sp.company === 'string' ? sp.company : '';

  const supabase = await createClient();

  // ── Fetch portfolios ──────────────────────────────────────────────────────
  const { data: portfolios } = await (supabase as any)
    .from('portfolios')
    .select('id, company_name')
    .is('archived_at', null)
    .order('company_name');

  const portfolioMap = new Map<string, PortfolioRow>(
    (portfolios ?? []).map((p: PortfolioRow) => [p.id, p])
  );

  // ── Fetch associations ────────────────────────────────────────────────────
  let query = (supabase as any)
    .from('associations')
    .select('id, name, portfolio_id, city, state, status, unit_count, created_at')
    .is('archived_at', null)
    .order('name');

  const { data: associations } = await query;

  const allAssociations: AssociationRow[] = associations ?? [];

  // ── Build view models ─────────────────────────────────────────────────────
  let rows: AssociationViewModel[] = allAssociations.map((a: AssociationRow) => {
    const portfolio = portfolioMap.get(a.portfolio_id);
    return {
      id: a.id,
      name: a.name ?? 'Unnamed Association',
      companyName: portfolio?.company_name ?? 'Unknown',
      portfolioId: a.portfolio_id,
      city: a.city ?? '',
      state: a.state ?? '',
      units: a.unit_count ?? 0,
      status: a.status ?? 'active',
      createdAt: a.created_at,
    };
  });

  // ── Apply company filter ──────────────────────────────────────────────────
  if (companyFilter) {
    rows = rows.filter((r) => r.portfolioId === companyFilter);
  }

  // ── Apply search ──────────────────────────────────────────────────────────
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.companyName.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.state.toLowerCase().includes(q)
    );
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalUnits = rows.reduce((s, r) => s + r.units, 0);
  const activeCount = rows.filter((r) => r.status === 'active').length;

  return (
    <div className="-mx-8 -my-8 min-h-[calc(100vh-64px)] bg-gray-950">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-gray-800 bg-gray-950 px-8 py-5">
        <WorkspaceHeader
          eyebrow="Portier369 Command Center"
          title="Associations"
          subtitle="Browse and manage every association across all management companies."
        />
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="px-8 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid gap-3 md:grid-cols-3">
          <StatDark label="Associations" value={rows.length} sub={`${activeCount} active`} />
          <StatDark label="Total Units" value={totalUnits.toLocaleString()} sub="Across all associations" />
          <StatDark label="Companies" value={portfolioMap.size} sub="Active management companies" />
        </div>

        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-4">
          <form className="flex-1 min-w-[280px]" method="GET" action="/platform/associations">
            {companyFilter && <input type="hidden" name="company" value={companyFilter} />}
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <Input
                name="search"
                placeholder="Search by name, company, or location..."
                defaultValue={search}
                className="border-gray-700 bg-gray-900 pl-10 text-gray-200 placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </form>

          {/* Company filter */}
          <form method="GET" action="/platform/associations" className="flex items-center gap-2">
            {search && <input type="hidden" name="search" value={search} />}
            <select
              name="company"
              defaultValue={companyFilter}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Companies</option>
              {(portfolios ?? []).map((p: PortfolioRow) => (
                <option key={p.id} value={p.id}>
                  {p.company_name}
                </option>
              ))}
            </select>
            {(search || companyFilter) && (
              <Link href="/platform/associations" className="text-xs text-blue-400 hover:text-blue-300">
                Clear filters
              </Link>
            )}
          </form>
        </div>

        {/* Table */}
        <Card className="overflow-hidden border-gray-800 bg-gray-900 shadow-none">
          <CardBody className="p-0">
            <Table className="border-0">
              <THead className="text-xs uppercase tracking-wider text-gray-400" style={{ backgroundColor: '#141720' }}>
                <TR className="border-gray-800">
                  <TH>Association name</TH>
                  <TH>Management company</TH>
                  <TH>City / State</TH>
                  <TH className="text-right">Units</TH>
                  <TH>Status</TH>
                  <TH>Created</TH>
                </TR>
              </THead>
              <tbody>
                {rows.length === 0 ? (
                  <TR className="border-gray-800">
                    <TD colSpan={6} className="py-14 text-center text-gray-500">
                      {search || companyFilter
                        ? 'No associations match the current filters. Try adjusting your search or company filter.'
                        : 'No associations found.'}
                    </TD>
                  </TR>
                ) : (
                  rows.map((row) => (
                    <TR key={row.id} className="border-gray-800 transition hover:bg-gray-800/50">
                      <TD>
                        <span className="font-semibold text-gray-200">
                          {row.name}
                        </span>
                      </TD>
                      <TD>
                        <Link
                          href={`/platform/portfolios/${row.portfolioId}`}
                          className="text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          {row.companyName}
                        </Link>
                      </TD>
                      <TD className="text-sm text-gray-400">
                        {row.city && row.state ? `${row.city}, ${row.state}` : row.city || row.state || '-'}
                      </TD>
                      <TD className="text-right tabular-nums text-gray-300">{row.units}</TD>
                      <TD>
                        <StatusBadge status={row.status} />
                      </TD>
                      <TD className="text-sm text-gray-400">{date(row.createdAt)}</TD>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Showing {rows.length} of {allAssociations.length} association{allAssociations.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Dark-themed Stat ────────────────────────────────────────────────────────

function StatDark({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-100">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
