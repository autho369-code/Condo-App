import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import GlobalSearch from '@/components/platform/global-search';
import { money } from '@/lib/utils';
import {
  Building2,
  Users,
  DoorOpen,
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  Ticket,
  Plus,
  ArrowRight,
  ShieldCheck,
  Clock,
  Zap,
  BarChart3,
  Mail,
  MessageSquare,
  Server,
  Wrench,
  FileText,
  CreditCard,
  Search,
  CheckCircle2,
  XCircle,
  Bell,
  Smartphone,
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

function timeAgo(ts: string): string {
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

function ExecRow({ label, value, sub, href }: { label: string; value: React.ReactNode; sub?: string; href?: string }) {
  const inner = (
    <div className={`flex items-center justify-between py-1.5 ${href ? 'group cursor-pointer' : ''}`}>
      <span className="text-sm text-slate-300">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold tabular-nums text-white">{value}</span>
        {sub && <span className="ml-1.5 text-xs text-slate-500">{sub}</span>}
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}

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
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${gradient[accent]} p-5 transition hover:border-opacity-60 ${href ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <p className="text-2xl font-bold tabular-nums tracking-tight text-white">{value}</p>
            {delta && (
              <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${delta.up ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'}`}>
                {delta.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {delta.value}
              </span>
            )}
          </div>
          {sub && <p className="mt-1 text-xs text-slate-600">{sub}</p>}
        </div>
        <div className={`ml-3 rounded-xl p-2.5 ${iconBg[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );

  if (href) return <Link href={href}>{card}</Link>;
  return card;
}

function Badge({ label, tone }: { label: string; tone: 'critical' | 'high' | 'warning' | 'info' | 'success' | 'neutral' }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-400/10 text-red-400 border-red-400/20',
    high: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    warning: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    info: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    success: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    neutral: 'bg-slate-400/10 text-slate-400 border-slate-400/20',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[tone]}`}>
      {label}
    </span>
  );
}

function ActivityIcon({ action }: { action: string }) {
  if (action?.includes('created') || action?.includes('added') || action?.includes('registered')) return <Plus className="h-3 w-3" />;
  if (action?.includes('invite') && action?.includes('sent')) return <Mail className="h-3 w-3" />;
  if (action?.includes('invite') && action?.includes('accepted')) return <CheckCircle2 className="h-3 w-3" />;
  if (action?.includes('disabled') || action?.includes('suspended')) return <XCircle className="h-3 w-3" />;
  if (action?.includes('login') || action?.includes('auth')) return <Users className="h-3 w-3" />;
  if (action?.includes('payment') || action?.includes('bill') || action?.includes('invoice')) return <CreditCard className="h-3 w-3" />;
  if (action?.includes('password') || action?.includes('reset')) return <ShieldCheck className="h-3 w-3" />;
  if (action?.includes('door') || action?.includes('unit')) return <DoorOpen className="h-3 w-3" />;
  if (action?.includes('work_order') || action?.includes('maintenance')) return <Wrench className="h-3 w-3" />;
  if (action?.includes('ticket') || action?.includes('support')) return <Ticket className="h-3 w-3" />;
  if (action?.includes('role')) return <Users className="h-3 w-3" />;
  return <Zap className="h-3 w-3" />;
}

function ActivityColor({ action }: { action: string }) {
  if (action?.includes('failed') || action?.includes('disabled') || action?.includes('suspended')) return 'bg-red-400/10 text-red-400';
  if (action?.includes('created') || action?.includes('accepted') || action?.includes('paid')) return 'bg-emerald-400/10 text-emerald-400';
  if (action?.includes('warning') || action?.includes('overdue')) return 'bg-amber-400/10 text-amber-400';
  return 'bg-slate-400/10 text-slate-400';
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function CommandCenterPage() {
  const me = await requirePlatformOperator();
  const supabase = await createClient();

  /* --- Data --------------------------------------------------------------- */

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { data: portfolios },
    { data: subscriptions },
    { data: associations },
    { data: buildings },
    { data: units },
    { data: activity },
    { data: workOrders },
    { data: violations },
    { data: tickets },
    { data: emailQueue },
    { data: invitations },
    { data: profiles },
  ] = await Promise.all([
    (supabase as any).from('portfolios').select('id, company_name, tier, suspended_at, created_at, suspension_reason').is('archived_at', null).order('created_at', { ascending: false }),
    (supabase as any).from('subscriptions').select('id, portfolio_id, tier, status, price_monthly_cents, trial_ends_at, units_limit, canceled_at, cancel_at_period_end').order('created_at', { ascending: false }).limit(1000),
    (supabase as any).from('associations').select('id, name, portfolio_id').is('archived_at', null),
    (supabase as any).from('buildings').select('id, association_id'),
    (supabase as any).from('units').select('id, building_id').is('archived_at', null),
    (supabase as any).from('activity').select('id, action, agent, details, created_at, user_id').order('created_at', { ascending: false }).limit(30),
    (supabase as any).from('work_orders').select('id, status, priority, scheduled_date, portfolio_id, association_id').is('archived_at', null).not('status', 'in', '("completed","closed","cancelled")').limit(5000),
    (supabase as any).from('violations').select('id, status, due_date, portfolio_id').is('archived_at', null).not('status', 'in', '("closed","cured")').limit(5000),
    (supabase as any).from('tickets').select('id, status, priority').neq('status', 'resolved').limit(5000),
    (supabase as any).from('email_queue').select('id, status, error_message, created_at, sent_at').gte('created_at', thisMonthStart).limit(5000),
    (supabase as any).from('user_invitations').select('id, status, email, full_name, hoa_role, portfolio_id, created_at').order('created_at', { ascending: false }).limit(1000),
    (supabase as any).from('profiles').select('id, last_login_at, portfolio_id, hoa_role'),
  ]);

  const portfolioRows = (portfolios ?? []) as any[];
  const subRows = (subscriptions ?? []) as any[];
  const assocRows = (associations ?? []) as any[];
  const buildingRows = (buildings ?? []) as any[];
  const unitRows = (units ?? []) as any[];
  const activityRows = (activity ?? []) as any[];
  const woRows = (workOrders ?? []) as any[];
  const violRows = (violations ?? []) as any[];
  const ticketRows = (tickets ?? []) as any[];
  const emailRows = (emailQueue ?? []) as any[];
  const inviteRows = (invitations ?? []) as any[];
  const profileRows = (profiles ?? []) as any[];

  /* --- Computed metrics --------------------------------------------------- */

  // SaaS lifecycle
  const totalCompanies = portfolioRows.length;
  const activeSubs = subRows.filter((s: any) => s.status === 'active').length;
  const trialSubs = subRows.filter((s: any) => s.status === 'trialing').length;
  const pastDueSubs = subRows.filter((s: any) => s.status === 'past_due' || s.status === 'unpaid').length;
  const canceledSubs = subRows.filter((s: any) => s.canceled_at).length;
  const suspendedCompanies = portfolioRows.filter((p: any) => p.suspended_at).length;
  const pendingInvites = inviteRows.filter((i: any) => i.status === 'pending').length;
  const acceptedInvites = inviteRows.filter((i: any) => i.status === 'accepted').length;
  const conversionRate = (acceptedInvites + pendingInvites) > 0 ? pct(acceptedInvites, acceptedInvites + pendingInvites) : '—';

  // Revenue
  const mrrCents = subRows.filter((s: any) => s.status === 'active').reduce((sum: number, s: any) => sum + (s.price_monthly_cents ?? 0), 0);
  const trialRevCents = subRows.filter((s: any) => s.status === 'trialing').reduce((sum: number, s: any) => sum + (s.price_monthly_cents ?? 0), 0);
  const projectedCents = mrrCents + Math.round(trialRevCents * 0.5);

  // Doors
  const bldgByAssoc = new Map<string, any[]>();
  buildingRows.forEach((b: any) => { const l = bldgByAssoc.get(b.association_id) ?? []; l.push(b); bldgByAssoc.set(b.association_id, l); });
  const unitByBldg = new Map<string, any[]>();
  unitRows.forEach((u: any) => { const l = unitByBldg.get(u.building_id) ?? []; l.push(u); unitByBldg.set(u.building_id, l); });
  let totalDoors = 0;
  assocRows.forEach((a: any) => { (bldgByAssoc.get(a.id) ?? []).forEach((b: any) => { totalDoors += (unitByBldg.get(b.id) ?? []).length; }); });

  // Operations
  const openWorkOrders = woRows.filter((w: any) => !['completed', 'closed', 'cancelled'].includes(w.status)).length;
  const overdueWorkOrders = woRows.filter((w: any) => w.scheduled_date && new Date(w.scheduled_date) < now && !['completed', 'closed', 'cancelled'].includes(w.status)).length;
  const openViolations = violRows.length;
  const openTickets = ticketRows.length;
  const totalAssociations = assocRows.length;

  // Platform
  const emailsSent = emailRows.filter((e: any) => e.status === 'sent').length;
  const emailsFailed = emailRows.filter((e: any) => e.status === 'failed').length;
  const totalProfiles = profileRows.length;
  const activeUsers30d = profileRows.filter((p: any) => p.last_login_at && new Date(p.last_login_at) >= new Date(thirtyDaysAgo)).length;

  // Revenue per door / company
  const revPerDoor = totalDoors > 0 ? fmtCents(Math.round(mrrCents / totalDoors)) : '—';
  const revPerCompany = activeSubs > 0 ? fmtCents(Math.round(mrrCents / activeSubs)) : '—';

  // Association health scores
  const assocWoCounts = new Map<string, { wo: number; viol: number }>();
  assocRows.forEach((a: any) => assocWoCounts.set(a.id, { wo: 0, viol: 0 }));
  woRows.forEach((w: any) => { if (w.association_id) { const c = assocWoCounts.get(w.association_id) ?? { wo: 0, viol: 0 }; c.wo++; assocWoCounts.set(w.association_id, c); } });
  violRows.forEach((v: any) => { if (v.portfolio_id) { for (const a of assocRows) { if (a.portfolio_id === v.portfolio_id) { const c = assocWoCounts.get(a.id) ?? { wo: 0, viol: 0 }; c.viol++; assocWoCounts.set(a.id, c); break; } } } });
  let healthyAssocs = 0, warningAssocs = 0, criticalAssocs = 0;
  assocWoCounts.forEach((c) => {
    const issues = c.wo + c.viol;
    if (issues === 0) healthyAssocs++;
    else if (issues <= 3) warningAssocs++;
    else criticalAssocs++;
  });

  // Companies requiring attention
  const companiesWithIssues: any[] = [];
  const nowISO = now.toISOString();

  // Failed payment companies
  subRows.filter((s: any) => s.status === 'past_due' || s.status === 'unpaid').forEach((s: any) => {
    const p = portfolioRows.find((pf: any) => pf.id === s.portfolio_id);
    if (p) companiesWithIssues.push({ company: p.company_name, portfolioId: p.id, issue: 'Failed payment', priority: 'critical', activity: 'Payment overdue', detail: `${fmtCents(s.price_monthly_cents)} past due` });
  });

  // Trials expiring within 7 days
  subRows.filter((s: any) => s.status === 'trialing' && s.trial_ends_at && new Date(s.trial_ends_at) < new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)).forEach((s: any) => {
    const p = portfolioRows.find((pf: any) => pf.id === s.portfolio_id);
    if (p) companiesWithIssues.push({ company: p.company_name, portfolioId: p.id, issue: 'Trial expiring soon', priority: 'warning', activity: timeAgo(s.trial_ends_at), detail: `Ends ${new Date(s.trial_ends_at).toLocaleDateString()}` });
  });

  // Door count exceeded
  subRows.filter((s: any) => s.units_limit).forEach((s: any) => {
    const p = portfolioRows.find((pf: any) => pf.id === s.portfolio_id);
    if (!p) return;
    let pDoors = 0;
    assocRows.filter((a: any) => a.portfolio_id === p.id).forEach((a: any) => { (bldgByAssoc.get(a.id) ?? []).forEach((b: any) => { pDoors += (unitByBldg.get(b.id) ?? []).length; }); });
    if (pDoors > s.units_limit) companiesWithIssues.push({ company: p.company_name, portfolioId: p.id, issue: 'Door count exceeded tier', priority: 'high', activity: `${pDoors} / ${s.units_limit}`, detail: `${pDoors - s.units_limit} over limit` });
  });

  // No manager login in 14 days
  const managerProfiles = profileRows.filter((p: any) => p.hoa_role === 'company_admin' || p.hoa_role === 'manager');
  managerProfiles.forEach((mp: any) => {
    if (!mp.last_login_at || new Date(mp.last_login_at) < new Date(fourteenDaysAgo)) {
      const p = portfolioRows.find((pf: any) => pf.id === mp.portfolio_id);
      if (p && !companiesWithIssues.some((c: any) => c.portfolioId === p.id && c.issue === 'No manager login in 14 days' || c.issue === 'No manager activity')) {
        companiesWithIssues.push({ company: p.company_name, portfolioId: p.id, issue: 'No manager activity', priority: 'warning', activity: mp.last_login_at ? timeAgo(mp.last_login_at) : 'Never', detail: 'No login in 14+ days' });
      }
    }
  });

  // Overdue work orders per company
  const overdueByPortfolio = new Map<string, number>();
  woRows.filter((w: any) => w.scheduled_date && new Date(w.scheduled_date) < now && !['completed', 'closed', 'cancelled'].includes(w.status)).forEach((w: any) => {
    if (w.portfolio_id) overdueByPortfolio.set(w.portfolio_id, (overdueByPortfolio.get(w.portfolio_id) ?? 0) + 1);
  });
  overdueByPortfolio.forEach((count, portfolioId) => {
    if (count > 5) {
      const p = portfolioRows.find((pf: any) => pf.id === portfolioId);
      if (p && !companiesWithIssues.some((c: any) => c.portfolioId === p.id && c.issue.startsWith('Overdue work orders'))) {
        companiesWithIssues.push({ company: p.company_name, portfolioId: p.id, issue: `${count} overdue work orders`, priority: 'high', activity: `${count} orders`, detail: 'Requires immediate attention' });
      }
    }
  });

  const priorityOrder: Record<string, number> = { critical: 0, high: 1, warning: 2 };
  companiesWithIssues.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));

  /* --- Alerts Center ------------------------------------------------------ */

  const failedPayments = pastDueSubs; // alias for clarity in render

  const alerts: { type: string; tone: 'critical' | 'high' | 'warning' | 'info'; count: number; message: string; href?: string }[] = [];

  if (failedPayments > 0) alerts.push({ type: 'Billing', tone: 'critical', count: failedPayments, message: `${failedPayments} failed payment${failedPayments > 1 ? 's' : ''}`, href: '/platform/billing' });
  if (suspendedCompanies > 0) alerts.push({ type: 'Billing', tone: 'critical', count: suspendedCompanies, message: `${suspendedCompanies} suspended compan${suspendedCompanies > 1 ? 'ies' : 'y'}`, href: '/platform/portfolios' });
  if (overdueWorkOrders > 0) alerts.push({ type: 'Operations', tone: 'high', count: overdueWorkOrders, message: `${overdueWorkOrders} overdue work order${overdueWorkOrders > 1 ? 's' : ''}`, href: '/work-orders' });
  if (openViolations > 10) alerts.push({ type: 'Operations', tone: 'warning', count: openViolations, message: `${openViolations} open violations`, href: '/violations' });
  if (emailsFailed > 0) alerts.push({ type: 'Platform', tone: 'high', count: emailsFailed, message: `${emailsFailed} failed email${emailsFailed > 1 ? 's' : ''}`, href: '/platform/communications' });
  if (openTickets > 5) alerts.push({ type: 'Support', tone: 'warning', count: openTickets, message: `${openTickets} open support tickets`, href: '/platform/support' });
  if (pastDueSubs > 0) alerts.push({ type: 'Billing', tone: 'high', count: pastDueSubs, message: `${pastDueSubs} past-due subscription${pastDueSubs > 1 ? 's' : ''}`, href: '/platform/billing' });

  if (alerts.length === 0) alerts.push({ type: 'System', tone: 'info', count: 0, message: 'All systems operational — no alerts' });

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="min-h-[calc(100vh-48px)] space-y-6 bg-[#060B18]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/70">Platform Operator</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-white">Portier369 Command Center</h1>
          <p className="mt-0.5 text-sm text-slate-500">Real-time operational overview across all management companies, revenue, and platform health.</p>
        </div>
        <div className="flex items-center gap-3">
          <GlobalSearch />
          <Link href="/platform/portfolios/new">
            <Button variant="primary" size="sm"><Plus className="mr-1.5 h-4 w-4" />Add Portfolio</Button>
          </Link>
        </div>
      </div>

      {/* ── Alerts Center ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
          <Bell className="h-4 w-4 text-amber-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Alerts Center</h3>
          {alerts.length > 1 && <span className="rounded-full bg-red-400/10 px-2 py-0.5 text-[10px] font-bold text-red-400">{alerts.length - (alerts[0]?.tone === 'info' ? 1 : 0)}</span>}
        </div>
        <div className="flex flex-wrap gap-2 px-5 py-3">
          {alerts.map((a, i) => (
            a.href ? (
              <Link key={i} href={a.href} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition hover:border-opacity-60 ${
                a.tone === 'critical' ? 'border-red-400/20 bg-red-400/5 text-red-400 hover:bg-red-400/10' :
                a.tone === 'high' ? 'border-amber-400/20 bg-amber-400/5 text-amber-400 hover:bg-amber-400/10' :
                a.tone === 'warning' ? 'border-yellow-400/20 bg-yellow-400/5 text-yellow-400 hover:bg-yellow-400/10' :
                'border-blue-400/20 bg-blue-400/5 text-blue-400 hover:bg-blue-400/10'
              }`}>
                <Badge label={a.type} tone={a.tone} />
                <span className="font-medium">{a.message}</span>
                <ArrowRight className="h-3 w-3 opacity-60" />
              </Link>
            ) : (
              <span key={i} className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="font-medium">{a.message}</span>
              </span>
            )
          ))}
        </div>
      </div>

      {/* ── Top Row: Revenue & Scale ─────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Monthly Recurring Revenue" value={fmtCents(mrrCents)} sub={`${activeSubs} active subscriptions`} icon={CircleDollarSign} accent="emerald" href="/platform/billing" />
        <StatCard label="Projected Next Month" value={fmtCents(projectedCents)} sub="MRR + ~50% trial conversion" icon={TrendingUp} accent="blue" href="/platform/revenue" />
        <StatCard label="Total Doors / Units" value={totalDoors.toLocaleString()} sub={`${totalAssociations} associations`} icon={DoorOpen} accent="purple" href="/platform/properties" />
        <StatCard label="Active Companies" value={activeSubs} sub={`${totalCompanies} total · ${trialSubs} trialing`} icon={Building2} accent="slate" href="/platform/portfolios" />
      </div>

      {/* ── 4 Executive Sections ─────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Business */}
        <ExecCard title="Business" icon={CircleDollarSign} accent="emerald">
          <ExecRow label="Monthly recurring revenue" value={fmtCents(mrrCents)} />
          <ExecRow label="Projected next-month" value={fmtCents(projectedCents)} />
          <ExecRow label="Active companies" value={activeSubs} />
          <ExecRow label="Trial companies" value={trialSubs} />
          <ExecRow label="Churned / cancelled" value={canceledSubs} />
          <ExecRow label="Suspended companies" value={suspendedCompanies} sub={suspendedCompanies > 0 ? '⚠' : ''} />
          <ExecRow label="Revenue per company" value={revPerCompany} />
          <ExecRow label="Revenue per door" value={revPerDoor} />
        </ExecCard>

        {/* Operations */}
        <ExecCard title="Operations" icon={Wrench} accent="blue">
          <ExecRow label="Total associations" value={totalAssociations} />
          <ExecRow label="Total doors / units" value={totalDoors.toLocaleString()} />
          <ExecRow label="Open work orders" value={openWorkOrders} href="/work-orders" />
          <ExecRow label="Overdue work orders" value={overdueWorkOrders} sub={overdueWorkOrders > 0 ? '⚠' : ''} href="/work-orders" />
          <ExecRow label="Open violations" value={openViolations} href="/violations" />
          <ExecRow label="Open tickets" value={openTickets} href="/platform/support" />
          <ExecRow label="Avg doors / association" value={(totalDoors / Math.max(totalAssociations, 1)).toFixed(1)} />
        </ExecCard>

        {/* Platform */}
        <ExecCard title="Platform" icon={Server} accent="purple">
          <ExecRow label="Emails sent (this mo.)" value={emailsSent.toLocaleString()} />
          <ExecRow label="SMS sent (this mo.)" value="—" sub="not tracked" />
          <ExecRow label="Failed emails" value={emailsFailed} sub={emailsFailed > 0 ? '⚠' : ''} />
          <ExecRow label="Failed SMS" value="—" sub="not tracked" />
          <ExecRow label="Active users (30d)" value={activeUsers30d} />
          <ExecRow label="Total profiles" value={totalProfiles} />
          <ExecRow label="Pending invitations" value={pendingInvites} href="/platform/invitations" />
          <ExecRow label="Failed logins" value="—" sub="not tracked" />
        </ExecCard>

        {/* Financial */}
        <ExecCard title="Financial" icon={CreditCard} accent="amber">
          <ExecRow label="Failed payments" value={failedPayments} sub={failedPayments > 0 ? '⚠' : ''} />
          <ExecRow label="Past-due companies" value={pastDueSubs} sub={pastDueSubs > 0 ? '⚠' : ''} />
          <ExecRow label="Upcoming invoices" value="—" sub="not tracked" />
          <ExecRow label="Revenue per door" value={revPerDoor} />
          <ExecRow label="Revenue per company" value={revPerCompany} />
          <ExecRow label="MRR" value={fmtCents(mrrCents)} />
          <ExecRow label="Projected" value={fmtCents(projectedCents)} />
        </ExecCard>
      </div>

      {/* ── Two Column: Companies Requiring Attention + Association Health ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Companies Requiring Attention */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Companies Requiring Attention</h3>
              {companiesWithIssues.length > 0 && (
                <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">{companiesWithIssues.length}</span>
              )}
            </div>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {companiesWithIssues.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400/50" />
                <p className="text-sm text-slate-400">All companies are in good standing</p>
              </div>
            ) : (
              companiesWithIssues.slice(0, 8).map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge label={c.priority} tone={c.priority === 'critical' ? 'critical' : c.priority === 'high' ? 'high' : 'warning'} />
                      <p className="truncate text-sm font-medium text-white">{c.company}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{c.issue} · {c.detail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-slate-600">{c.activity}</span>
                    <Link href={`/platform/portfolios/${c.portfolioId}`}>
                      <Button variant="secondary" size="sm" className="h-8 text-xs">View</Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Association Health */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-white">Association Health</h3>
            </div>
            <Link href="/platform/health" className="text-xs text-emerald-400 hover:text-emerald-300 transition">View all →</Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            <div className="grid grid-cols-3 gap-3 px-5 py-4">
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{healthyAssocs}</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">Healthy</p>
              </div>
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">{warningAssocs}</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">Warning</p>
              </div>
              <div className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-center">
                <p className="text-2xl font-bold text-red-400">{criticalAssocs}</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">Critical</p>
              </div>
            </div>
            <div className="space-y-0.5 px-5 py-3">
              <ExecRow label="Healthy associations" value={healthyAssocs} />
              <ExecRow label="Warning associations" value={warningAssocs} />
              <ExecRow label="Critical associations" value={criticalAssocs} />
              <ExecRow label="Open work orders" value={openWorkOrders} />
              <ExecRow label="Open violations" value={openViolations} />
              <ExecRow label="Overdue work orders" value={overdueWorkOrders} />
              <ExecRow label="Associations w/o activity" value={'—'} />
            </div>
            <div className="px-5 py-3">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Health distribution</span>
                    <span className="text-slate-400">{healthyAssocs + warningAssocs + criticalAssocs} total</span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.04]">
                    {(() => {
                      const total = healthyAssocs + warningAssocs + criticalAssocs || 1;
                      return (
                        <>
                          <div className="bg-emerald-500/60 transition-all" style={{ width: `${(healthyAssocs / total) * 100}%` }} />
                          <div className="bg-amber-500/60 transition-all" style={{ width: `${(warningAssocs / total) * 100}%` }} />
                          <div className="bg-red-500/60 transition-all" style={{ width: `${(criticalAssocs / total) * 100}%` }} />
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two Column: SaaS Lifecycle + Activity Feed ───────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* SaaS Lifecycle */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-4">
            <Activity className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">SaaS Lifecycle</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 px-5 py-4">
            <div className="rounded-lg border border-blue-400/20 bg-blue-400/5 p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{pendingInvites}</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">Pending</p>
            </div>
            <div className="rounded-lg border border-purple-400/20 bg-purple-400/5 p-3 text-center">
              <p className="text-2xl font-bold text-purple-400">{trialSubs}</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">Trials</p>
            </div>
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{activeSubs}</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">Active</p>
            </div>
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{suspendedCompanies}</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">Suspended</p>
            </div>
            <div className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{canceledSubs}</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">Cancelled</p>
            </div>
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{conversionRate}</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">Conv. Rate</p>
            </div>
          </div>
        </div>

        {/* Platform Activity Feed */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-white">Platform Activity</h3>
            </div>
            <span className="text-xs text-slate-600">{activityRows.length} events</span>
          </div>
          <div className="divide-y divide-white/[0.04] max-h-[440px] overflow-y-auto">
            {activityRows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Clock className="h-6 w-6 text-slate-600" />
                <p className="text-sm text-slate-500">No recent activity</p>
              </div>
            ) : (
              activityRows.slice(0, 12).map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3 hover:bg-white/[0.02] transition">
                  <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${ActivityColor({ action: a.action })}`}>
                    <ActivityIcon action={a.action} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 truncate">
                      <span className="font-medium text-white">{a.agent ?? a.action}</span>
                      {a.details && <span className="text-slate-500"> — {a.details}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">{timeAgo(a.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/platform/portfolios/new" className="group flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-emerald-500/30 hover:bg-emerald-500/5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-400"><Plus className="h-4 w-4" /></div>
            <div><p className="text-sm font-medium text-white group-hover:text-emerald-400 transition">Add Portfolio</p><p className="text-xs text-slate-500">Onboard a new management company</p></div>
          </Link>
          <Link href="/platform/billing" className="group flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-blue-500/30 hover:bg-blue-500/5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-400/10 text-blue-400"><CreditCard className="h-4 w-4" /></div>
            <div><p className="text-sm font-medium text-white group-hover:text-blue-400 transition">Billing Overview</p><p className="text-xs text-slate-500">Subscriptions and revenue</p></div>
          </Link>
          <Link href="/platform/system-health" className="group flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-amber-500/30 hover:bg-amber-500/5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400"><Server className="h-4 w-4" /></div>
            <div><p className="text-sm font-medium text-white group-hover:text-amber-400 transition">System Health</p><p className="text-xs text-slate-500">Monitor platform alerts</p></div>
          </Link>
          <Link href="/platform/users" className="group flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-slate-500/30 hover:bg-slate-500/5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-400/10 text-slate-400"><Users className="h-4 w-4" /></div>
            <div><p className="text-sm font-medium text-white group-hover:text-slate-400 transition">User Directory</p><p className="text-xs text-slate-500">Manage platform users</p></div>
          </Link>
        </div>
      </div>

      {/* ── Bottom spacer ────────────────────────────────────────────────── */}
      <div className="h-4" />
    </div>
  );
}
