import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/utils';
import {
  Building2,
  Users,
  DoorOpen,
  Wrench,
  AlertTriangle,
  FileText,
  CircleDollarSign,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowRight,
  Activity,
  Bell,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  MessageSquare,
  BarChart3,
  Shield,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function fmtCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || cents === 0) return '$0';
  return money(cents / 100);
}

function pct(val: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((val / total) * 100)}%`;
}

function timeAgo(ts: string | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* -------------------------------------------------------------------------- */
/*  Components                                                                */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'emerald',
  delta,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'slate';
  delta?: { value: string; up: boolean };
  href?: string;
}) {
  const gradient: Record<string, string> = {
    emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20',
    blue: 'from-blue-500/15 to-blue-500/5 border-blue-500/20',
    amber: 'from-amber-500/15 to-amber-500/5 border-amber-500/20',
    red: 'from-red-500/15 to-red-500/5 border-red-500/20',
    purple: 'from-purple-500/15 to-purple-500/5 border-purple-500/20',
    slate: 'from-slate-600/15 to-slate-600/5 border-slate-700/30',
  };
  const iconBg: Record<string, string> = {
    emerald: 'bg-emerald-400/10 text-emerald-400',
    blue: 'bg-blue-400/10 text-blue-400',
    amber: 'bg-amber-400/10 text-amber-400',
    red: 'bg-red-400/10 text-red-400',
    purple: 'bg-purple-400/10 text-purple-400',
    slate: 'bg-slate-400/10 text-slate-400',
  };

  const card = (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${gradient[accent]} p-5 transition hover:bg-white/[0.03] ${
        href ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-white tabular-nums">{value}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
          {delta && (
            <div className="flex items-center gap-1">
              {delta.up ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              )}
              <span className={`text-xs font-medium ${delta.up ? 'text-emerald-400' : 'text-red-400'}`}>
                {delta.value}
              </span>
            </div>
          )}
        </div>
        <div className={`rounded-lg p-2 ${iconBg[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );

  if (href) return <Link href={href}>{card}</Link>;
  return card;
}

function ExecCard({
  title,
  icon: Icon,
  accent = 'slate',
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'slate';
  children: React.ReactNode;
}) {
  const borders: Record<string, string> = {
    emerald: 'border-t-emerald-500/50',
    blue: 'border-t-blue-500/50',
    amber: 'border-t-amber-500/50',
    red: 'border-t-red-500/50',
    purple: 'border-t-purple-500/50',
    slate: 'border-t-slate-600/50',
  };
  const icons: Record<string, string> = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    purple: 'text-purple-400',
    slate: 'text-slate-400',
  };
  return (
    <div className={`rounded-xl border border-white/[0.06] border-t-2 ${borders[accent]} bg-white/[0.02]`}>
      <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
        <Icon className={`h-4 w-4 ${icons[accent]}`} />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      </div>
      <div className="space-y-1 px-5 py-3">{children}</div>
    </div>
  );
}

function ExecRow({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <div
      className={`flex items-center justify-between py-1.5 ${
        href ? 'group cursor-pointer' : ''
      }`}
    >
      <span className="text-sm text-slate-300">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold tabular-nums text-white">{value}</span>
        {sub && <span className="ml-1.5 text-xs text-slate-400">{sub}</span>}
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}

function QuickAction({
  label,
  sub,
  icon: Icon,
  href,
}: {
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition hover:border-emerald-500/30 hover:bg-emerald-500/5"
    >
      <div className="rounded-lg bg-emerald-400/10 p-2 text-emerald-400 group-hover:bg-emerald-400/20">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
    </Link>
  );
}

function AlertPill({
  label,
  severity,
  href,
}: {
  label: string;
  severity: 'critical' | 'warning' | 'info';
  href: string;
}) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/20',
  };
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${colors[severity]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

function HealthBadge({ score }: { score: number }) {
  let color = 'text-emerald-400 bg-emerald-400/10';
  let label = 'Healthy';
  if (score >= 3) { color = 'text-amber-400 bg-amber-400/10'; label = 'Warning'; }
  if (score >= 6) { color = 'text-orange-400 bg-orange-400/10'; label = 'Attention'; }
  if (score >= 9) { color = 'text-red-400 bg-red-400/10'; label = 'Critical'; }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function CompanyAdminOverviewPage() {
  const me = await requireCompanyAdmin();
  const supabase = await createClient();
  const db = supabase as any;
  const portfolioId = me.portfolio?.id;

  if (!portfolioId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white">No company assigned</h2>
          <p className="text-sm text-slate-400 mt-1">Contact the platform operator to set up your company.</p>
        </div>
      </div>
    );
  }

  // Parallel queries for dashboard data
  const [
    { data: associations },
    { data: units },
    { data: managers },
    { data: workOrders },
    { data: violations },
    { data: architecturalRequests },
    { data: subscription },
    { data: recentActivity },
    { data: emailStats },
    { data: revenueTotal },
    { data: ownerCount },
    { data: vendorCount },
    { data: ownerDelinquency },
  ] = await Promise.all([
    supabase.from('associations').select('id, name, status, city, unit_count').eq('portfolio_id', portfolioId).is('archived_at', null),
    supabase.from('units').select('id').eq('building_id', null as any).not('archived_at', 'is', null),
    supabase.from('profiles').select('id, full_name, email, hoa_role, last_login_at').eq('portfolio_id', portfolioId).eq('hoa_role', 'manager'),
    supabase.from('work_orders').select('id, status, priority, created_at').eq('portfolio_id', portfolioId).in('status', ['new', 'assigned', 'in_progress']),
    db.from('violations').select('id, status').eq('portfolio_id', portfolioId).in('status', ['open', 'hearing_pending']),
    db.from('architectural_requests').select('id').not('id', 'is', null).limit(0), // probe if table exists
    supabase.from('subscriptions').select('id, tier, status, units_limit, price_monthly_cents, current_period_end').eq('portfolio_id', portfolioId).maybeSingle(),
    db.from('audit_logs').select('id, action, actor_email, created_at, entity_type').order('created_at', { ascending: false }).limit(10),
    db.from('email_queue').select('id, status').eq('portfolio_id', portfolioId),
    db.from('management_fees').select('id').not('id', 'is', null).limit(0),
    supabase.from('owners').select('id').eq('portfolio_id', portfolioId).is('archived_at', null),
    supabase.from('vendors').select('id').eq('portfolio_id', portfolioId),
    supabase.from('owners').select('id').eq('portfolio_id', portfolioId).is('archived_at', null),
  ]);

  const associationList = associations ?? [];
  const totalAssociations = associationList.length;
  const totalUnits = associationList.reduce((sum, a) => sum + (a.unit_count ?? 0), 0);
  const activeAssociations = associationList.filter((a) => a.status === 'active').length;
  const workOrderList = workOrders ?? [];
  const openWorkOrders = workOrderList.filter((w) => w.status === 'new' || w.status === 'assigned').length;
  const overdueWorkOrders = workOrderList.filter((w) => {
    if (w.status === 'completed' || w.status === 'closed') return false;
    const age = Date.now() - new Date(w.created_at).getTime();
    return age > 7 * 24 * 60 * 60 * 1000;
  }).length;
  const violationList = violations ?? [];
  const openViolations = violationList.length;
  const managerList = managers ?? [];
  const activeManagers = managerList.filter((m) => m.last_login_at).length;
  const emailList = emailStats ?? [];
  const sentEmails = emailList.filter((e: any) => e.status === 'sent').length;
  const failedEmails = emailList.filter((e: any) => e.status === 'failed').length;
  const totalOwners = (ownerCount ?? []).length;
  const totalVendors = (vendorCount ?? []).length;
  const monthlyRevenue = subscription?.price_monthly_cents ?? 0;
  const delinquencyCount = 0; // Need proper query, placeholder for now

  // Compute alerts
  const alerts: { label: string; severity: 'critical' | 'warning' | 'info'; href: string }[] = [];
  if (overdueWorkOrders > 5) alerts.push({ label: `${overdueWorkOrders} overdue work orders`, severity: 'critical', href: '/company-admin/work-orders' });
  else if (overdueWorkOrders > 0) alerts.push({ label: `${overdueWorkOrders} overdue work orders`, severity: 'warning', href: '/company-admin/work-orders' });
  if (openViolations > 3) alerts.push({ label: `${openViolations} open violations`, severity: 'warning', href: '/company-admin/violations' });
  if (failedEmails > 0) alerts.push({ label: `${failedEmails} failed emails`, severity: 'warning', href: '/company-admin/communications' });
  if (subscription?.status === 'past_due') alerts.push({ label: 'Subscription past due', severity: 'critical', href: '/company-admin/billing' });
  if (activeManagers === 0 && managerList.length > 0) alerts.push({ label: 'No recent manager activity', severity: 'warning', href: '/company-admin/managers' });

  // Compute average health score (simplified — based on open issues per association)
  const avgHealthIssues = totalAssociations > 0
    ? ((openWorkOrders + openViolations + overdueWorkOrders) / totalAssociations).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Company Admin</p>
          <h1 className="mt-1 text-xl font-bold text-white">Control Center</h1>
          <p className="mt-1 text-sm text-slate-400">
            {me.portfolio?.company_name ?? 'Company'} — {totalAssociations} associations, {totalUnits} doors
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/company-admin/managers">
            <Button variant="secondary" size="sm" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
              <Plus className="h-4 w-4" />
              Invite Manager
            </Button>
          </Link>
          <Link href="/company-admin/platform-requests">
            <Button size="sm" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
              <MessageSquare className="h-4 w-4" />
              Contact Platform
            </Button>
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-white">Alerts</span>
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
              {alerts.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.map((a, i) => (
              <AlertPill key={i} {...a} />
            ))}
          </div>
        </div>
      )}

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Associations" value={totalAssociations} sub={`${activeAssociations} active`} icon={Building2} accent="emerald" href="/company-admin/associations" />
        <StatCard label="Total Doors" value={totalUnits} sub={`limit: ${subscription?.units_limit ?? '—'}`} icon={DoorOpen} accent="blue" href="/company-admin/billing" />
        <StatCard label="Managers" value={`${activeManagers}/${managerList.length}`} sub="active / total" icon={Users} accent="purple" href="/company-admin/managers" />
        <StatCard label="Open WOs" value={openWorkOrders} sub={overdueWorkOrders > 0 ? `${overdueWorkOrders} overdue` : 'all current'} icon={Wrench} accent={overdueWorkOrders > 3 ? 'amber' : 'emerald'} href="/company-admin/work-orders" />
        <StatCard label="Open Violations" value={openViolations} icon={AlertTriangle} accent={openViolations > 3 ? 'red' : 'slate'} href="/company-admin/violations" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Open Arch. Requests" value="—" sub="not tracked" icon={FileText} accent="slate" href="/company-admin/architectural" />
        <StatCard label="Monthly Revenue" value={fmtCents(monthlyRevenue)} icon={CircleDollarSign} accent="emerald" href="/company-admin/revenue" />
        <StatCard label="Delinquencies" value={delinquencyCount} icon={ShieldAlert} accent={delinquencyCount > 0 ? 'red' : 'slate'} href="/company-admin/revenue" />
        <StatCard label="Avg Health Score" value={avgHealthIssues} sub="issues/assoc." icon={Activity} accent="blue" href="/company-admin/health" />
        <StatCard label="Owners / Vendors" value={`${totalOwners} / ${totalVendors}`} icon={Users} accent="slate" />
      </div>

      {/* Executive columns + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Operations column */}
        <ExecCard title="Operations" icon={Activity} accent="emerald">
          <ExecRow label="Active Associations" value={activeAssociations} />
          <ExecRow label="Total Doors" value={totalUnits} />
          <ExecRow label="Open Work Orders" value={openWorkOrders} sub={overdueWorkOrders > 0 ? `⚠${overdueWorkOrders} overdue` : undefined} href="/company-admin/work-orders" />
          <ExecRow label="Open Violations" value={openViolations} href="/company-admin/violations" />
          <ExecRow label="Avg Issues / Assoc." value={avgHealthIssues} />
        </ExecCard>

        {/* People column */}
        <ExecCard title="People" icon={Users} accent="blue">
          <ExecRow label="Active Managers" value={`${activeManagers} of ${managerList.length}`} href="/company-admin/managers" />
          <ExecRow label="Total Owners" value={totalOwners} href="/company-admin/owners" />
          <ExecRow label="Total Vendors" value={totalVendors} href="/company-admin/vendors" />
          <ExecRow label="Emails This Month" value={sentEmails} sub={failedEmails > 0 ? `${failedEmails} failed` : undefined} href="/company-admin/communications" />
          <ExecRow label="SMS Sent" value="—" sub="not tracked" />
        </ExecCard>

        {/* Billing column */}
        <ExecCard title="Billing" icon={CircleDollarSign} accent="amber">
          <ExecRow label="Plan" value={subscription?.tier ?? '—'} />
          <ExecRow label="Monthly Charge" value={fmtCents(monthlyRevenue)} />
          <ExecRow label="Door Limit" value={subscription?.units_limit ?? '—'} />
          <ExecRow label="Doors Used" value={totalUnits} sub={subscription?.units_limit && totalUnits > subscription.units_limit ? '⚠over limit' : undefined} />
          <ExecRow label="Next Invoice" value={subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'} />
        </ExecCard>
      </div>

      {/* Recent Activity + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
            <Clock className="h-4 w-4 text-slate-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Recent Activity</h3>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {(recentActivity ?? []).length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">No recent activity</div>
            ) : (
              (recentActivity ?? []).slice(0, 8).map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${entry.action?.includes('fail') || entry.action?.includes('disabled') ? 'bg-red-400' : 'bg-emerald-400'}`} />
                    <div>
                      <p className="text-sm text-slate-300">{entry.action}</p>
                      <p className="text-xs text-slate-400">{entry.actor_email} · {entry.entity_type}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{timeAgo(entry.created_at)}</span>
                </div>
              ))
            )}
          </div>
          {(recentActivity ?? []).length > 0 && (
            <div className="border-t border-white/[0.04] px-5 py-2">
              <Link href="/company-admin/audit-logs" className="text-xs text-emerald-400 hover:text-emerald-300">
                View all audit logs →
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">Quick Actions</h3>
          <QuickAction label="Invite Manager" sub="Add a new property manager" icon={Plus} href="/company-admin/managers" />
          <QuickAction label="Add Association" sub="Onboard a new HOA/Condo" icon={Building2} href="/company-admin/associations" />
          <QuickAction label="Request More Doors" sub="Increase door capacity" icon={DoorOpen} href="/company-admin/platform-requests" />
          <QuickAction label="View Billing" sub="Subscription & invoices" icon={CircleDollarSign} href="/company-admin/billing" />
          <QuickAction label="Contact Platform" sub="Message platform operator" icon={MessageSquare} href="/company-admin/platform-requests" />
          <QuickAction label="Reassign Manager" sub="Transfer associations" icon={Users} href="/company-admin/managers" />
        </div>
      </div>
    </div>
  );
}
