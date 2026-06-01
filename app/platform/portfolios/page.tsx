import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { WorkspaceHeader } from '@/components/workspace/shell';
import { ContextPanel, PanelLink, PanelSection } from '@/components/workspace/context-panel';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

type PortfolioRow = Record<string, any>;
type SubscriptionRow = Record<string, any>;
type ProfileRow = Record<string, any>;
type AssociationRow = Record<string, any>;
type BuildingRow = Record<string, any>;
type UnitRow = Record<string, any>;

interface ClientRow {
  portfolio: PortfolioRow;
  primaryAdmin: ProfileRow | null;
  adminEmail: string;
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  totalAssociations: number;
  totalDoors: number;
  tier: string;
  monthlyBilling: number | null;
  lastLogin: string | null;
}

type SortColumn =
  | 'company_name'
  | 'admin'
  | 'email'
  | 'phone'
  | 'status'
  | 'associations'
  | 'doors'
  | 'tier'
  | 'billing'
  | 'last_login'
  | 'created_at';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'trial' | 'suspended';

// ─── Badge ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ClientRow['status'], string> = {
  active:    'bg-emerald-400/15 text-emerald-300 ring-emerald-400/40',
  trial:     'bg-sky-400/15 text-sky-300 ring-sky-400/40',
  suspended: 'bg-rose-400/15 text-rose-300 ring-rose-400/40',
  cancelled: 'bg-gray-500/20 text-gray-400 ring-gray-500/30',
};

const STATUS_LABELS: Record<ClientRow['status'], string> = {
  active:    'Active',
  trial:     'Trial',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
};

function Badge({ status }: { status: ClientRow['status'] }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'active' ? 'bg-emerald-400' : status === 'trial' ? 'bg-sky-400' : status === 'suspended' ? 'bg-rose-400' : 'bg-gray-500'}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Status helpers ──────────────────────────────────────────────────────────

function deriveStatus(portfolio: PortfolioRow, subscription: SubscriptionRow | null): ClientRow['status'] {
  if (portfolio.suspended_at) return 'suspended';
  if (subscription?.status === 'trialing') return 'trial';
  if (subscription?.status === 'active') return 'active';
  if (subscription?.status === 'canceled' || subscription?.status === 'past_due' || subscription?.status === 'unpaid') return 'cancelled';
  // fallback: trial if trial_ends_at is present and not expired
  if (subscription?.trial_ends_at) return 'trial';
  return 'active';
}

function statusMatchesFilter(status: ClientRow['status'], filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  return status === filter;
}

// ─── Sort helpers ────────────────────────────────────────────────────────────

const SORT_COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'company_name',  label: 'Company name' },
  { key: 'admin',         label: 'Primary admin' },
  { key: 'email',         label: 'Admin email' },
  { key: 'phone',         label: 'Phone' },
  { key: 'status',        label: 'Status' },
  { key: 'associations',  label: 'Total associations' },
  { key: 'doors',         label: 'Total doors' },
  { key: 'tier',          label: 'Pricing tier' },
  { key: 'billing',       label: 'Monthly billing' },
  { key: 'last_login',    label: 'Last login' },
  { key: 'created_at',    label: 'Date created' },
];

function sortClients(rows: ClientRow[], sort: SortColumn, order: SortOrder): ClientRow[] {
  return [...rows].sort((a, b) => {
    let va: any, vb: any;
    switch (sort) {
      case 'company_name':  va = a.portfolio.company_name?.toLowerCase() ?? ''; vb = b.portfolio.company_name?.toLowerCase() ?? ''; break;
      case 'admin':         va = a.primaryAdmin?.full_name?.toLowerCase() ?? ''; vb = b.primaryAdmin?.full_name?.toLowerCase() ?? ''; break;
      case 'email':         va = a.adminEmail?.toLowerCase() ?? ''; vb = b.adminEmail?.toLowerCase() ?? ''; break;
      case 'phone':         va = a.portfolio.phone_number ?? ''; vb = b.portfolio.phone_number ?? ''; break;
      case 'status':        va = a.status; vb = b.status; break;
      case 'associations':  va = a.totalAssociations; vb = b.totalAssociations; break;
      case 'doors':         va = a.totalDoors; vb = b.totalDoors; break;
      case 'tier':          va = a.tier?.toLowerCase() ?? ''; vb = b.tier?.toLowerCase() ?? ''; break;
      case 'billing':       va = a.monthlyBilling ?? 0; vb = b.monthlyBilling ?? 0; break;
      case 'last_login':    va = a.lastLogin ?? ''; vb = b.lastLogin ?? ''; break;
      case 'created_at':    va = a.portfolio.created_at ?? ''; vb = b.portfolio.created_at ?? ''; break;
      default: return 0;
    }
    if (va < vb) return order === 'asc' ? -1 : 1;
    if (va > vb) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

function nextOrder(current: SortOrder): SortOrder {
  return current === 'asc' ? 'desc' : 'asc';
}

// ─── SortLink (inline for URL-based sorting) ─────────────────────────────────

function SortLink({
  column,
  currentSort,
  currentOrder,
  search,
  status,
  children,
  className,
}: {
  column: SortColumn;
  currentSort: SortColumn;
  currentOrder: SortOrder;
  search: string;
  status: StatusFilter;
  children: React.ReactNode;
  className?: string;
}) {
  const isActive = currentSort === column;
  const order = isActive ? nextOrder(currentOrder) : 'asc';
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  params.set('sort', column);
  params.set('order', order);
  return (
    <Link
      href={`/platform/portfolios?${params.toString()}`}
      className={`group inline-flex items-center gap-1 hover:text-blue-400 ${className ?? ''}`}
    >
      {children}
      {isActive && (
        <span className="text-xs text-blue-400">{currentOrder === 'asc' ? '↑' : '↓'}</span>
      )}
    </Link>
  );
}

// ─── Actions Dropdown (inline; server-rendered via details/summary) ──────────

function ActionsDropdown({ portfolioId }: { portfolioId: string }) {
  return (
    <details className="relative inline-block">
      <summary className="cursor-pointer list-none rounded-md px-2 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-gray-800 hover:text-gray-200">
        Actions ▾
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-gray-700 bg-gray-850 py-1 shadow-xl" style={{ background: '#1c1f2a' }}>
        <Link
          href={`/platform/portfolios/${portfolioId}`}
          className="block px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-700 hover:text-white"
        >
          View
        </Link>
        <Link
          href={`/platform/portfolios/${portfolioId}?edit=1`}
          className="block px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-700 hover:text-white"
        >
          Edit
        </Link>
        <button
          type="submit"
          name="action"
          value="suspend"
          className="block w-full px-4 py-2 text-left text-sm text-amber-300 transition hover:bg-gray-700 hover:text-amber-200"
        >
          Suspend
        </button>
        <button
          type="submit"
          name="action"
          value="reactivate"
          className="block w-full px-4 py-2 text-left text-sm text-emerald-300 transition hover:bg-gray-700 hover:text-emerald-200"
        >
          Reactivate
        </button>
      </div>
    </details>
  );
}

// ─── Filter Tabs ─────────────────────────────────────────────────────────────

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'active',    label: 'Active' },
  { key: 'trial',     label: 'Trial' },
  { key: 'suspended', label: 'Suspended' },
];

function FilterTabs({
  current,
  search,
  sort,
  order,
}: {
  current: StatusFilter;
  search: string;
  sort: SortColumn;
  order: SortOrder;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-800 p-1">
      {FILTER_TABS.map((tab) => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (tab.key !== 'all') params.set('status', tab.key);
        if (sort !== 'company_name') params.set('sort', sort);
        if (order !== 'asc') params.set('order', order);
        const isActive = current === tab.key;
        return (
          <Link
            key={tab.key}
            href={`/platform/portfolios?${params.toString()}`}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              isActive
                ? 'bg-gray-700 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function PortfoliosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const search = typeof sp.search === 'string' ? sp.search.trim() : '';
  const statusFilter: StatusFilter = (['all', 'active', 'trial', 'suspended'] as const).includes(sp.status as any)
    ? (sp.status as StatusFilter)
    : 'all';
  const sort: SortColumn = (SORT_COLUMNS.some((c) => c.key === sp.sort) ? sp.sort : 'company_name') as SortColumn;
  const order: SortOrder = sp.order === 'desc' ? 'desc' : 'asc';

  const supabase = await createClient();

  // ── 1. Fetch portfolios ──────────────────────────────────────────────────
  const { data: portfolios } = await (supabase as any)
    .from('portfolios')
    .select('*')
    .order('company_name');

  const allPortfolios: PortfolioRow[] = portfolios ?? [];
  const portfolioIds = allPortfolios.map((p: PortfolioRow) => p.id);

  if (portfolioIds.length === 0) {
    return (
      <div className="space-y-7">
        <WorkspaceHeader
          eyebrow="Portier369 Command Center"
          title="Clients / Companies"
          subtitle="Manage every management company, subscription, and billing state from one place."
        />
        <Card className="border-gray-800 bg-gray-900">
          <CardBody>
            <p className="py-10 text-center text-gray-500">
              No clients exist yet. Provision a client to get started.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  // ── 2. Fetch related data in parallel ────────────────────────────────────
  let subscriptions: any[] = [];
  let profiles: any[] = [];
  let associations: any[] = [];
  
  try {
    const results = await Promise.all([
      (supabase as any).from('subscriptions').select('*').in('portfolio_id', portfolioIds),
      (supabase as any)
        .from('profiles')
        .select('id, portfolio_id, email, full_name, hoa_role, mvp_role, last_login_at')
        .in('portfolio_id', portfolioIds)
        .order('last_login_at', { ascending: false }),
      (supabase as any).from('associations').select('id, portfolio_id').in('portfolio_id', portfolioIds),
    ]);
    subscriptions = results[0]?.data ?? [];
    profiles = results[1]?.data ?? [];
    associations = results[2]?.data ?? [];
  } catch (e) {
    console.error('Failed to fetch portfolio relations:', e);
  }

  const subMap = new Map<string, SubscriptionRow>((subscriptions ?? []).map((s: SubscriptionRow) => [s.portfolio_id, s]));
  const profilesByPortfolio = new Map<string, ProfileRow[]>();
  (profiles ?? []).forEach((p: ProfileRow) => {
    const list = profilesByPortfolio.get(p.portfolio_id) ?? [];
    list.push(p);
    profilesByPortfolio.set(p.portfolio_id, list);
  });
  const assocByPortfolio = new Map<string, AssociationRow[]>();
  (associations ?? []).forEach((a: AssociationRow) => {
    const list = assocByPortfolio.get(a.portfolio_id) ?? [];
    list.push(a);
    assocByPortfolio.set(a.portfolio_id, list);
  });

  // ── 3. Fetch buildings + units for door counts ───────────────────────────
  const allAssocIds = (associations ?? []).map((a: AssociationRow) => a.id);
  let assocDoorCounts: Map<string, number> = new Map();
  if (allAssocIds.length > 0) {
    const { data: buildings } = await (supabase as any)
      .from('buildings')
      .select('id, association_id')
      .in('association_id', allAssocIds);
    const buildingIds = (buildings ?? []).map((b: BuildingRow) => b.id);
    const bldgAssocMap = new Map<string, string>((buildings ?? []).map((b: BuildingRow) => [b.id, b.association_id]));
    if (buildingIds.length > 0) {
      const { data: units } = await (supabase as any)
        .from('units')
        .select('id, building_id, archived_at')
        .in('building_id', buildingIds);
      const activeUnits = (units ?? []).filter((u: UnitRow) => u.archived_at === null);
      assocDoorCounts = new Map<string, number>();
      activeUnits.forEach((u: UnitRow) => {
        const assocId = bldgAssocMap.get(u.building_id);
        if (assocId) {
          assocDoorCounts.set(assocId, (assocDoorCounts.get(assocId) ?? 0) + 1);
        }
      });
    }
  }

  // ── 4. Build client rows ─────────────────────────────────────────────────
  let clientRows: ClientRow[] = allPortfolios.map((portfolio: PortfolioRow) => {
    const sub = subMap.get(portfolio.id) ?? null;
    const profileList = profilesByPortfolio.get(portfolio.id) ?? [];

    // Primary admin: prioritize company_admin, then manager, then any
    const primaryAdmin =
      profileList.find((p: ProfileRow) => p.mvp_role === 'company_admin') ??
      profileList.find((p: ProfileRow) => p.hoa_role === 'manager') ??
      profileList[0] ??
      null;

    const adminEmail = primaryAdmin?.email ?? '-';
    const status = deriveStatus(portfolio, sub);
    const tier = sub?.tier ?? portfolio.tier ?? '-';

    // Total associations
    const portfolioAssocs = assocByPortfolio.get(portfolio.id) ?? [];
    const totalAssociations = portfolioAssocs.length;

    // Total doors
    const totalDoors = portfolioAssocs.reduce((sum, a) => sum + (assocDoorCounts.get(a.id) ?? 0), 0);

    // Monthly billing
    const monthlyBilling = sub?.price_monthly_cents ?? null;

    // Last login: most recent among all profiles for this portfolio
    const lastLogin = profileList.length > 0 ? profileList[0].last_login_at ?? null : null;

    return {
      portfolio,
      primaryAdmin,
      adminEmail,
      status,
      totalAssociations,
      totalDoors,
      tier,
      monthlyBilling,
      lastLogin,
    };
  });

  // ── 5. Apply filters ─────────────────────────────────────────────────────
  if (search) {
    const q = search.toLowerCase();
    clientRows = clientRows.filter(
      (r) =>
        r.portfolio.company_name?.toLowerCase().includes(q) ||
        (r.primaryAdmin?.full_name ?? '').toLowerCase().includes(q) ||
        r.adminEmail.toLowerCase().includes(q),
    );
  }
  clientRows = clientRows.filter((r) => statusMatchesFilter(r.status, statusFilter));

  // ── 6. Apply sort ────────────────────────────────────────────────────────
  clientRows = sortClients(clientRows, sort, order);

  // ── 7. Summary stats ─────────────────────────────────────────────────────
  const summary = {
    total: clientRows.length,
    active: clientRows.filter((r) => r.status === 'active').length,
    trial: clientRows.filter((r) => r.status === 'trial').length,
    suspended: clientRows.filter((r) => r.status === 'suspended').length,
    totalAssociations: clientRows.reduce((s, r) => s + r.totalAssociations, 0),
    totalDoors: clientRows.reduce((s, r) => s + r.totalDoors, 0),
    totalMRR: clientRows.reduce((s, r) => s + (r.monthlyBilling ?? 0), 0),
  };

  return (
    <div className="flex">
      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-gray-800 bg-gray-950 px-8 py-5">
          <WorkspaceHeader
            eyebrow="Portier369 Command Center"
            title="Clients / Companies"
            subtitle="Manage every management company, subscription tier, and billing state from one place."
            actions={
              <Link href="/platform/portfolios?provision=1">
                <Button size="sm" variant="default" className="bg-blue-600 hover:bg-blue-500">
                  + Provision Client
                </Button>
              </Link>
            }
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-gray-950 px-8 py-6">
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
              <StatDark label="Clients" value={summary.total} sub={`${summary.active} active · ${summary.trial} trial · ${summary.suspended} suspended`} />
              <StatDark label="Associations" value={summary.totalAssociations} sub="Across all clients" />
              <StatDark label="Total Doors" value={summary.totalDoors} sub="Active units" />
              <StatDark label="MRR" value={money(summary.totalMRR)} sub="Aggregate monthly" />
            </div>

            {/* Search + filters */}
            <div className="flex flex-wrap items-center gap-4">
              <form className="flex-1 min-w-[280px]" method="GET" action="/platform/portfolios">
                {statusFilter !== 'all' && <input type="hidden" name="status" value={statusFilter} />}
                {sort !== 'company_name' && <input type="hidden" name="sort" value={sort} />}
                {order !== 'asc' && <input type="hidden" name="order" value={order} />}
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
                    placeholder="Search by company, admin, or email..."
                    defaultValue={search}
                    className="border-gray-700 bg-gray-900 pl-10 text-gray-200 placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </form>
              <FilterTabs current={statusFilter} search={search} sort={sort} order={order} />
            </div>

            {/* Table */}
            <Card className="overflow-hidden border-gray-800 bg-gray-900 shadow-none">
              <CardBody className="p-0">
                <Table className="border-0">
                  <THead className="bg-gray-850 text-xs uppercase tracking-wider text-gray-400" style={{ backgroundColor: '#141720' }}>
                    <TR className="border-gray-800">
                      <TH>
                        <SortLink column="company_name" currentSort={sort} currentOrder={order} search={search} status={statusFilter}>
                          Company name
                        </SortLink>
                      </TH>
                      <TH>
                        <SortLink column="admin" currentSort={sort} currentOrder={order} search={search} status={statusFilter}>
                          Primary admin
                        </SortLink>
                      </TH>
                      <TH>
                        <SortLink column="email" currentSort={sort} currentOrder={order} search={search} status={statusFilter}>
                          Email
                        </SortLink>
                      </TH>
                      <TH>
                        <SortLink column="phone" currentSort={sort} currentOrder={order} search={search} status={statusFilter}>
                          Phone
                        </SortLink>
                      </TH>
                      <TH>
                        <SortLink column="status" currentSort={sort} currentOrder={order} search={search} status={statusFilter}>
                          Status
                        </SortLink>
                      </TH>
                      <TH className="text-right">
                        <SortLink column="associations" currentSort={sort} currentOrder={order} search={search} status={statusFilter}>
                          Associations
                        </SortLink>
                      </TH>
                      <TH className="text-right">
                        <SortLink column="doors" currentSort={sort} currentOrder={order} search={search} status={statusFilter}>
                          Doors
                        </SortLink>
                      </TH>
                      <TH>
                        <SortLink column="tier" currentSort={sort} currentOrder={order} search={search} status={statusFilter}>
                          Tier
                        </SortLink>
                      </TH>
                      <TH className="text-right">
                        <SortLink column="billing" currentSort={sort} currentOrder={order} search={search} status={statusFilter}>
                          Monthly
                        </SortLink>
                      </TH>
                      <TH>
                        <SortLink column="last_login" currentSort={sort} currentOrder={order} search={search} status={statusFilter}>
                          Last login
                        </SortLink>
                      </TH>
                      <TH>
                        <SortLink column="created_at" currentSort={sort} currentOrder={order} search={search} status={statusFilter}>
                          Created
                        </SortLink>
                      </TH>
                      <TH className="w-10" />
                    </TR>
                  </THead>
                  <tbody>
                    {clientRows.length === 0 ? (
                      <TR className="border-gray-800">
                        <TD colSpan={13} className="py-14 text-center text-gray-500">
                          {search || statusFilter !== 'all'
                            ? 'No clients match the current filters. Try adjusting your search or status filter.'
                            : 'No clients are visible to this platform operator.'}
                        </TD>
                      </TR>
                    ) : (
                      clientRows.map((row) => (
                        <TR key={row.portfolio.id} className="border-gray-800 transition hover:bg-gray-800/50">
                          <TD>
                            <Link
                              href={`/platform/portfolios/${row.portfolio.id}`}
                              className="font-semibold text-blue-400 hover:text-blue-300 hover:underline"
                            >
                              {row.portfolio.company_name ?? 'Unnamed client'}
                            </Link>
                            {row.portfolio.address_city && (
                              <div className="mt-0.5 text-xs text-gray-500">
                                {row.portfolio.address_city}{row.portfolio.address_state ? `, ${row.portfolio.address_state}` : ''}
                              </div>
                            )}
                          </TD>
                          <TD>
                            <div className="font-medium text-gray-200">
                              {row.primaryAdmin?.full_name ?? row.primaryAdmin?.display_name ?? '-'}
                            </div>
                            {row.primaryAdmin?.hoa_role && (
                              <div className="text-xs capitalize text-gray-500">{row.primaryAdmin.hoa_role}</div>
                            )}
                          </TD>
                          <TD className="text-sm text-gray-400">{row.adminEmail}</TD>
                          <TD className="text-sm font-mono text-gray-400">{row.portfolio.phone_number ?? '-'}</TD>
                          <TD>
                            <Badge status={row.status} />
                          </TD>
                          <TD className="text-right tabular-nums text-gray-300">{row.totalAssociations}</TD>
                          <TD className="text-right tabular-nums text-gray-300">{row.totalDoors}</TD>
                          <TD>
                            <span className="inline-flex items-center rounded bg-gray-800 px-2 py-0.5 text-xs font-semibold uppercase text-gray-300">
                              {row.tier}
                            </span>
                          </TD>
                          <TD className="text-right tabular-nums text-gray-300">
                            {row.monthlyBilling !== null ? money(row.monthlyBilling) : '-'}
                          </TD>
                          <TD className="text-sm text-gray-400">{date(row.lastLogin)}</TD>
                          <TD className="text-sm text-gray-400">{date(row.portfolio.created_at)}</TD>
                          <TD>
                            <ActionsDropdown portfolioId={row.portfolio.id} />
                          </TD>
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
                Showing {clientRows.length} of {allPortfolios.length} client{allPortfolios.length !== 1 ? 's' : ''}
              </span>
              {search && (
                <Link href="/platform/portfolios" className="text-blue-400 hover:underline">
                  Clear search
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right rail / ContextPanel ─────────────────────────────────────── */}
      <ContextPanel title="Quick Actions">
        <PanelSection title="Manage" icon={<span>⚙️</span>}>
          <PanelLink href="/platform/portfolios?provision=1">+ Provision new client</PanelLink>
          <PanelLink href="/platform/billing">Billing overview</PanelLink>
          <PanelLink href="/platform/system-health">System health</PanelLink>
        </PanelSection>

        <PanelSection title="Reports" icon={<span>📊</span>}>
          <PanelLink href="/platform/portfolios">Active clients ({summary.active})</PanelLink>
          <PanelLink href="/platform/portfolios?status=trial">Trial clients ({summary.trial})</PanelLink>
          <PanelLink href="/platform/portfolios?status=suspended">Suspended clients ({summary.suspended})</PanelLink>
        </PanelSection>

        <PanelSection title="Bulk Actions" icon={<span>📋</span>}>
          <PanelLink href="/platform/portfolios">Export all clients</PanelLink>
          <PanelLink href="/platform/portfolios">Send billing reminders</PanelLink>
          <PanelLink href="/platform/portfolios">Audit log</PanelLink>
        </PanelSection>
      </ContextPanel>
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
