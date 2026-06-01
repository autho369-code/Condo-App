import Link from 'next/link';

import { Card, CardBody } from '@/components/ui/card';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { WorkspaceHeader } from '@/components/workspace/shell';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';
import {
  Heart,
  TrendingUp,
  AlertTriangle,
  Clock,
  MessageSquare,
  FileText,
  Wrench,
  ShieldAlert,
  Activity,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

type PortfolioRow = Record<string, any>;
type AssociationRow = Record<string, any>;
type ServiceRequestRow = Record<string, any>;
type ViolationRow = Record<string, any>;
type ApprovalRequestRow = Record<string, any>;
type OwnerMessageRow = Record<string, any>;
type WorkOrderRow = Record<string, any>;
type ProfileRow = Record<string, any>;

type HealthTier = 'Excellent' | 'Good' | 'Warning' | 'Critical';

interface AssociationHealth {
  id: string;
  name: string;
  companyName: string;
  portfolioId: string;
  units: number;
  openSRs: number;
  overdueSRs: number;
  openViolations: number;
  archReviewsOpen: number;
  unansweredMessages: number;
  vendorTicketsPending: number;
  lastManagerActivity: string | null;
  daysSinceActivity: number | null;
  totalScore: number;
  healthTier: HealthTier;
}

// ─── Health Tier Helpers ─────────────────────────────────────────────────────

const HEALTH_TIER_STYLES: Record<HealthTier, { badge: string; dot: string }> = {
  Excellent: {
    badge: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/40',
    dot: 'bg-emerald-400',
  },
  Good: {
    badge: 'bg-sky-400/15 text-sky-300 ring-sky-400/40',
    dot: 'bg-sky-400',
  },
  Warning: {
    badge: 'bg-amber-400/15 text-amber-300 ring-amber-400/40',
    dot: 'bg-amber-400',
  },
  Critical: {
    badge: 'bg-rose-400/15 text-rose-300 ring-rose-400/40',
    dot: 'bg-rose-400',
  },
};

function HealthBadge({ tier }: { tier: HealthTier }) {
  const style = HEALTH_TIER_STYLES[tier];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {tier}
    </span>
  );
}

function computeHealthScore(
  openSRs: number,
  overdueSRs: number,
  openViolations: number,
  archReviewsOpen: number,
  unansweredMessages: number,
  vendorTicketsPending: number,
  daysSinceActivity: number | null,
): { totalScore: number; tier: HealthTier } {
  // Each metric contributes weighted points
  let score = 0;
  score += openSRs * 1;
  score += overdueSRs * 2;
  score += openViolations * 1;
  score += archReviewsOpen * 1;
  score += unansweredMessages * 2;
  score += vendorTicketsPending * 1;

  // Days since manager activity
  if (daysSinceActivity !== null) {
    if (daysSinceActivity > 30) score += 8;
    else if (daysSinceActivity > 14) score += 4;
    else if (daysSinceActivity > 7) score += 2;
  }

  let tier: HealthTier;
  if (score <= 2) tier = 'Excellent';
  else if (score <= 5) tier = 'Good';
  else if (score <= 10) tier = 'Warning';
  else tier = 'Critical';

  return { totalScore: score, tier };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const companyFilter = typeof sp.company === 'string' ? sp.company : '';
  const healthFilter = typeof sp.health === 'string' ? sp.health : '';

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
  const { data: associations } = await (supabase as any)
    .from('associations')
    .select('id, name, portfolio_id, unit_count')
    .is('archived_at', null)
    .order('name');

  const allAssociations: AssociationRow[] = associations ?? [];
  const associationIds = allAssociations.map((a: AssociationRow) => a.id);

  if (associationIds.length === 0) {
    return (
      <div className="-mx-8 -my-8 min-h-[calc(100vh-64px)] bg-gray-950">
        <div className="shrink-0 border-b border-gray-800 bg-gray-950 px-8 py-5">
          <WorkspaceHeader
            eyebrow="Portier369 Command Center"
            title="Association Health Scores"
            subtitle="Real-time health assessment for every association. Monitors service requests, violations, messages, vendor tickets, and manager engagement."
          />
        </div>
        <div className="px-8 py-6">
          <Card className="border-gray-800 bg-gray-900">
            <CardBody>
              <p className="py-10 text-center text-gray-500">No associations exist yet. Create associations to monitor their health.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  // ── Fetch related data in parallel ────────────────────────────────────────
  const portfolioIds = new Set(allAssociations.map((a) => a.portfolio_id));

  const [
    srResult,
    violationsResult,
    approvalsResult,
    messagesResult,
    workOrdersResult,
    profilesResult,
  ] = await Promise.all([
    // Service requests
    (supabase as any)
      .from('service_requests')
      .select('id, association_id, status')
      .in('association_id', associationIds)
      .in('status', ['open', 'pending', 'in_progress', 'assigned', 'overdue'])
      .limit(5000),

    // Violations
    (supabase as any)
      .from('violations')
      .select('id, association_id, status')
      .in('association_id', associationIds)
      .in('status', ['open', 'pending', 'active'])
      .limit(5000),

    // Approval requests (architectural reviews)
    (supabase as any)
      .from('approval_requests')
      .select('id, association_id, status')
      .in('association_id', associationIds)
      .in('status', ['pending', 'under_review', 'submitted'])
      .limit(5000),

    // Owner messages — attempt to get unanswered; try with association_id
    (supabase as any)
      .from('owner_messages')
      .select('id, association_id, status, created_at')
      .in('association_id', associationIds)
      .eq('status', 'unanswered')
      .limit(5000),

    // Work orders (vendor tickets)
    (supabase as any)
      .from('work_orders')
      .select('id, association_id, status')
      .in('association_id', associationIds)
      .in('status', ['pending', 'open', 'assigned', 'in_progress'])
      .limit(5000),

    // Profiles — managers for each portfolio
    (supabase as any)
      .from('profiles')
      .select('id, portfolio_id, hoa_role, last_login_at')
      .in('portfolio_id', [...portfolioIds])
      .in('hoa_role', ['manager', 'company_admin', 'admin'])
      .limit(5000),
  ]);

  const serviceRequests: ServiceRequestRow[] = srResult?.data ?? [];
  const violations: ViolationRow[] = violationsResult?.data ?? [];
  const approvals: ApprovalRequestRow[] = approvalsResult?.data ?? [];
  const messages: OwnerMessageRow[] = messagesResult?.data ?? [];
  const workOrders: WorkOrderRow[] = workOrdersResult?.data ?? [];
  const profiles: ProfileRow[] = profilesResult?.data ?? [];

  // ── Aggregate data per association ────────────────────────────────────────

  // Service requests: open vs overdue
  const openSRsByAssoc = new Map<string, number>();
  const overdueSRsByAssoc = new Map<string, number>();
  serviceRequests.forEach((sr: ServiceRequestRow) => {
    const id = sr.association_id;
    if (sr.status === 'overdue') {
      overdueSRsByAssoc.set(id, (overdueSRsByAssoc.get(id) ?? 0) + 1);
    } else {
      openSRsByAssoc.set(id, (openSRsByAssoc.get(id) ?? 0) + 1);
    }
  });

  // Violations
  const violationsByAssoc = new Map<string, number>();
  violations.forEach((v: ViolationRow) => {
    violationsByAssoc.set(v.association_id, (violationsByAssoc.get(v.association_id) ?? 0) + 1);
  });

  // Approval requests
  const approvalsByAssoc = new Map<string, number>();
  approvals.forEach((ar: ApprovalRequestRow) => {
    approvalsByAssoc.set(ar.association_id, (approvalsByAssoc.get(ar.association_id) ?? 0) + 1);
  });

  // Owner messages > 48h
  const now = Date.now();
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;
  const messagesByAssoc = new Map<string, number>();
  messages.forEach((m: OwnerMessageRow) => {
    if (m.created_at) {
      const age = now - new Date(m.created_at).getTime();
      if (age > fortyEightHoursMs && m.association_id) {
        messagesByAssoc.set(m.association_id, (messagesByAssoc.get(m.association_id) ?? 0) + 1);
      }
    }
  });

  // Work orders
  const workOrdersByAssoc = new Map<string, number>();
  workOrders.forEach((wo: WorkOrderRow) => {
    workOrdersByAssoc.set(wo.association_id, (workOrdersByAssoc.get(wo.association_id) ?? 0) + 1);
  });

  // Last manager activity per portfolio
  const lastActivityByPortfolio = new Map<string, string>();
  profiles.forEach((p: ProfileRow) => {
    if (p.last_login_at) {
      const current = lastActivityByPortfolio.get(p.portfolio_id);
      if (!current || p.last_login_at > current) {
        lastActivityByPortfolio.set(p.portfolio_id, p.last_login_at);
      }
    }
  });

  // ── Build health rows ─────────────────────────────────────────────────────
  let healthRows: AssociationHealth[] = allAssociations.map((a: AssociationRow) => {
    const portfolio = portfolioMap.get(a.portfolio_id);
    const openSRs = openSRsByAssoc.get(a.id) ?? 0;
    const overdueSRs = overdueSRsByAssoc.get(a.id) ?? 0;
    const openViolations = violationsByAssoc.get(a.id) ?? 0;
    const archReviewsOpen = approvalsByAssoc.get(a.id) ?? 0;
    const unansweredMessages = messagesByAssoc.get(a.id) ?? 0;
    const vendorTicketsPending = workOrdersByAssoc.get(a.id) ?? 0;

    const lastActivity = lastActivityByPortfolio.get(a.portfolio_id) ?? null;
    let daysSinceActivity: number | null = null;
    if (lastActivity) {
      daysSinceActivity = Math.floor(
        (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    const { totalScore, tier } = computeHealthScore(
      openSRs,
      overdueSRs,
      openViolations,
      archReviewsOpen,
      unansweredMessages,
      vendorTicketsPending,
      daysSinceActivity,
    );

    return {
      id: a.id,
      name: a.name ?? 'Unnamed Association',
      companyName: portfolio?.company_name ?? 'Unknown',
      portfolioId: a.portfolio_id,
      units: a.unit_count ?? 0,
      openSRs,
      overdueSRs,
      openViolations,
      archReviewsOpen,
      unansweredMessages,
      vendorTicketsPending,
      lastManagerActivity: lastActivity,
      daysSinceActivity,
      totalScore,
      healthTier: tier,
    };
  });

  // ── Apply filters ─────────────────────────────────────────────────────────
  if (companyFilter) {
    healthRows = healthRows.filter((r) => r.portfolioId === companyFilter);
  }
  if (healthFilter) {
    healthRows = healthRows.filter((r) => r.healthTier === healthFilter);
  }

  // ── Sort: critical first, then warning, good, excellent ───────────────────
  const tierOrder: Record<HealthTier, number> = {
    Critical: 0,
    Warning: 1,
    Good: 2,
    Excellent: 3,
  };
  healthRows = healthRows.sort((a, b) => tierOrder[a.healthTier] - tierOrder[b.healthTier]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const summary = {
    total: healthRows.length,
    excellent: healthRows.filter((r) => r.healthTier === 'Excellent').length,
    good: healthRows.filter((r) => r.healthTier === 'Good').length,
    warning: healthRows.filter((r) => r.healthTier === 'Warning').length,
    critical: healthRows.filter((r) => r.healthTier === 'Critical').length,
    totalOpenSRs: healthRows.reduce((s, r) => s + r.openSRs, 0),
    totalOverdueSRs: healthRows.reduce((s, r) => s + r.overdueSRs, 0),
    totalViolations: healthRows.reduce((s, r) => s + r.openViolations, 0),
    totalUnanswered: healthRows.reduce((s, r) => s + r.unansweredMessages, 0),
  };

  const HEALTH_TIERS: HealthTier[] = ['Excellent', 'Good', 'Warning', 'Critical'];

  return (
    <div className="-mx-8 -my-8 min-h-[calc(100vh-64px)] bg-gray-950">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-gray-800 bg-gray-950 px-8 py-5">
        <WorkspaceHeader
          eyebrow="Portier369 Command Center"
          title="Association Health Scores"
          subtitle="Real-time health assessment for every association. Monitors service requests, violations, messages, vendor tickets, and manager engagement."
        />
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="px-8 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
          <StatDark label="Total" value={summary.total} sub="Associations" />
          <StatDark label="Excellent" value={summary.excellent} sub="Score ≤ 2" accent="emerald" />
          <StatDark label="Good" value={summary.good} sub="Score 3-5" accent="sky" />
          <StatDark label="Warning" value={summary.warning} sub="Score 6-10" accent="amber" />
          <StatDark label="Critical" value={summary.critical} sub="Score 11+" accent="rose" />
          <StatDark label="Open SRs" value={summary.totalOpenSRs + summary.totalOverdueSRs} sub={`${summary.totalOverdueSRs} overdue`} accent="amber" />
          <StatDark label="Violations" value={summary.totalViolations} sub="Open cases" accent="rose" />
          <StatDark label="Unanswered" value={summary.totalUnanswered} sub="Messages &gt;48h" accent="amber" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Company filter */}
          <form method="GET" action="/platform/health" className="flex items-center gap-2">
            {healthFilter && <input type="hidden" name="health" value={healthFilter} />}
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
          </form>

          {/* Health tier filter tabs */}
          <div className="flex gap-1 rounded-lg bg-gray-800 p-1">
            {HEALTH_TIERS.map((tier) => {
              const params = new URLSearchParams();
              if (companyFilter) params.set('company', companyFilter);
              if (tier) params.set('health', tier);
              const isActive = healthFilter === tier || (!healthFilter && tier === 'Critical');
              return (
                <Link
                  key={tier}
                  href={`/platform/health?${params.toString()}`}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-gray-700 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tier}
                </Link>
              );
            })}
            {(companyFilter || healthFilter) && (
              <Link
                href="/platform/health"
                className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:text-gray-300 transition"
              >
                Clear
              </Link>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Card className="overflow-hidden border-gray-800 bg-gray-900 shadow-none min-w-[1200px]">
            <CardBody className="p-0">
              <Table className="border-0">
                <THead className="text-xs uppercase tracking-wider text-gray-400" style={{ backgroundColor: '#141720' }}>
                  <TR className="border-gray-800">
                    <TH className="min-w-[140px]">Association</TH>
                    <TH className="min-w-[120px]">Company</TH>
                    <TH className="text-right w-[60px]">Units</TH>
                    <TH className="text-right w-[70px]">Open SRs</TH>
                    <TH className="text-right w-[80px]">Overdue SRs</TH>
                    <TH className="text-right w-[80px]">Violations</TH>
                    <TH className="text-right w-[80px]">Arch reviews</TH>
                    <TH className="text-right w-[100px]">Unanswered</TH>
                    <TH className="text-right w-[80px]">Vendor tix</TH>
                    <TH className="w-[130px]">Last mgr activity</TH>
                    <TH className="w-[100px]">Health</TH>
                  </TR>
                </THead>
                <tbody>
                  {healthRows.length === 0 ? (
                    <TR className="border-gray-800">
                      <TD colSpan={11} className="py-14 text-center text-gray-500">
                        {companyFilter || healthFilter
                          ? 'No associations match the current filters.'
                          : 'No health data available.'}
                      </TD>
                    </TR>
                  ) : (
                    healthRows.map((row) => {
                      const tierStyle = HEALTH_TIER_STYLES[row.healthTier];
                      const rowBg =
                        row.healthTier === 'Critical' ? 'bg-rose-500/5' :
                        row.healthTier === 'Warning' ? 'bg-amber-500/5' :
                        '';
                      return (
                        <TR key={row.id} className={`border-gray-800 transition hover:bg-gray-800/50 ${rowBg}`}>
                          <TD>
                            <span className="font-semibold text-gray-200">{row.name}</span>
                          </TD>
                          <TD>
                            <Link
                              href={`/platform/portfolios/${row.portfolioId}`}
                              className="text-blue-400 hover:text-blue-300 hover:underline text-sm"
                            >
                              {row.companyName}
                            </Link>
                          </TD>
                          <TD className="text-right tabular-nums text-gray-300">{row.units}</TD>
                          <TD className={`text-right tabular-nums ${row.openSRs > 0 ? 'font-medium text-amber-300' : 'text-gray-400'}`}>
                            {row.openSRs}
                          </TD>
                          <TD className={`text-right tabular-nums ${row.overdueSRs > 0 ? 'font-semibold text-rose-300' : 'text-gray-400'}`}>
                            {row.overdueSRs > 0 ? row.overdueSRs : '—'}
                          </TD>
                          <TD className={`text-right tabular-nums ${row.openViolations > 0 ? 'font-medium text-rose-300' : 'text-gray-400'}`}>
                            {row.openViolations > 0 ? row.openViolations : '—'}
                          </TD>
                          <TD className={`text-right tabular-nums ${row.archReviewsOpen > 0 ? 'font-medium text-amber-300' : 'text-gray-400'}`}>
                            {row.archReviewsOpen > 0 ? row.archReviewsOpen : '—'}
                          </TD>
                          <TD className={`text-right tabular-nums ${row.unansweredMessages > 0 ? 'font-semibold text-rose-300' : 'text-gray-400'}`}>
                            {row.unansweredMessages > 0 ? row.unansweredMessages : '—'}
                          </TD>
                          <TD className={`text-right tabular-nums ${row.vendorTicketsPending > 0 ? 'font-medium text-amber-300' : 'text-gray-400'}`}>
                            {row.vendorTicketsPending > 0 ? row.vendorTicketsPending : '—'}
                          </TD>
                          <TD className="text-sm text-gray-400">
                            {row.lastManagerActivity ? (
                              <span className={row.daysSinceActivity !== null && row.daysSinceActivity > 14 ? 'text-rose-300 font-medium' : ''}>
                                {date(row.lastManagerActivity)}
                                {row.daysSinceActivity !== null && row.daysSinceActivity > 0 && (
                                  <span className="ml-1 text-xs text-gray-500">
                                    ({row.daysSinceActivity}d ago)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-600">Never</span>
                            )}
                          </TD>
                          <TD>
                            <HealthBadge tier={row.healthTier} />
                          </TD>
                        </TR>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </CardBody>
          </Card>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Showing {healthRows.length} of {allAssociations.length} association{allAssociations.length !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-600">
            Score = open SRs (×1) + overdue SRs (×2) + violations (×1) + arch reviews (×1) + unanswered &gt;48h (×2) + vendor tix (×1) + stale activity
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Dark-themed Stat with optional accent ───────────────────────────────────

function StatDark({
  label,
  value,
  sub,
  accent = 'gray',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: 'gray' | 'emerald' | 'sky' | 'amber' | 'rose';
}) {
  const borderColorMap: Record<string, string> = {
    gray: 'border-gray-800',
    emerald: 'border-emerald-500/30',
    sky: 'border-sky-500/30',
    amber: 'border-amber-500/30',
    rose: 'border-rose-500/30',
  };
  const bgColorMap: Record<string, string> = {
    gray: 'bg-gray-900',
    emerald: 'bg-emerald-500/5',
    sky: 'bg-sky-500/5',
    amber: 'bg-amber-500/5',
    rose: 'bg-rose-500/5',
  };
  const valueColorMap: Record<string, string> = {
    gray: 'text-gray-100',
    emerald: 'text-emerald-300',
    sky: 'text-sky-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
  };

  return (
    <div className={`rounded-lg border ${borderColorMap[accent]} ${bgColorMap[accent]} p-4`}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${valueColorMap[accent]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
