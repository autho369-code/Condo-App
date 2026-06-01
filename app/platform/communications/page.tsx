import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { WorkspaceHeader } from '@/components/workspace/shell';
import {
  Mail,
  MailX,
  MessageSquare,
  MessageSquareX,
  Building2,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Activity,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface CommRow {
  id: string;
  portfolio_id: string | null;
  channel: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  portfolios?: { company_name: string } | null;
}

interface SmsRow {
  id: string;
  conversation_id: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
}

interface SmsConvRow {
  id: string;
  portfolio_id: string;
}

interface PortfolioRow {
  id: string;
  company_name: string;
}

interface CompanyStats {
  portfolioId: string;
  companyName: string;
  emailsThisMonth: number;
  smsThisMonth: number;
  totalSent: number;
  failedCount: number;
  deliveryRate: number;
}

/* -------------------------------------------------------------------------- */
/*  Dark-themed KPI tile                                                       */
/* -------------------------------------------------------------------------- */

function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'emerald',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'slate';
}) {
  const accentMap: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
    red: 'from-red-500/20 to-red-500/5 border-red-500/20',
    slate: 'from-slate-600/20 to-slate-600/5 border-slate-700',
  };
  const iconColorMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    slate: 'text-slate-400',
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${accentMap[accent] ?? accentMap.slate} p-5 transition hover:border-opacity-50`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        {Icon && (
          <div className={`ml-3 mt-0.5 rounded-lg bg-white/5 p-2 ${iconColorMap[accent] ?? iconColorMap.slate}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function CommunicationsPage() {
  const me = await requirePlatformOperator();
  const supabase = await createClient();

  /* --- Data fetching ------------------------------------------------------ */

  const [
    { data: portfolios },
    { data: commMessages },
    { data: smsMessages },
    { data: smsConversations },
  ] = await Promise.all([
    (supabase as any)
      .from('portfolios')
      .select('id, company_name')
      .is('archived_at', null)
      .order('company_name', { ascending: true }),
    (supabase as any)
      .from('communication_messages')
      .select('id, portfolio_id, channel, status, sent_at, error_message, portfolios!inner(company_name)')
      .order('created_at', { ascending: false })
      .limit(5000),
    (supabase as any)
      .from('sms_messages')
      .select('id, conversation_id, status, sent_at, error_message')
      .order('created_at', { ascending: false })
      .limit(5000),
    (supabase as any)
      .from('sms_conversations')
      .select('id, portfolio_id'),
  ]);

  /* --- Build lookups ------------------------------------------------------ */

  const portfolioRows: PortfolioRow[] = portfolios ?? [];
  const commRows: CommRow[] = commMessages ?? [];
  const smsRows: SmsRow[] = smsMessages ?? [];
  const convRows: SmsConvRow[] = smsConversations ?? [];

  const portfolioById = new Map<string, string>(
    portfolioRows.map((p) => [p.id, p.company_name]),
  );
  const convToPortfolio = new Map<string, string>(
    convRows.map((c) => [c.id, c.portfolio_id]),
  );

  /* --- Time helpers ------------------------------------------------------- */

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  function inThisMonth(ts: string | null): boolean {
    if (!ts) return false;
    return new Date(ts) >= monthStart;
  }

  /* --- KPI Computations --------------------------------------------------- */

  // Email stats from communication_messages (channel = 'email')
  const emailsSent = commRows.filter(
    (r) => r.channel === 'email' && r.status === 'sent',
  ).length;
  const emailsFailed = commRows.filter(
    (r) => r.channel === 'email' && r.status === 'failed',
  ).length;

  // SMS stats from sms_messages
  const smsSent = smsRows.filter(
    (r) => r.status === 'sent' || r.status === 'delivered',
  ).length;
  const smsFailed = smsRows.filter((r) => r.status === 'failed').length;

  // Also count SMS from communication_messages (channel = 'sms')
  const commSmsSent = commRows.filter(
    (r) => r.channel === 'sms' && r.status === 'sent',
  ).length;
  const commSmsFailed = commRows.filter(
    (r) => r.channel === 'sms' && r.status === 'failed',
  ).length;

  const totalSmsSent = smsSent + commSmsSent;
  const totalSmsFailed = smsFailed + commSmsFailed;

  // Total communications
  const totalSent = emailsSent + totalSmsSent;
  const totalFailed = emailsFailed + totalSmsFailed;

  /* --- Per-company aggregations ------------------------------------------- */

  const companyStats = new Map<string, {
    emailsThisMonth: number;
    smsThisMonth: number;
    totalSent: number;
    failedCount: number;
  }>();

  function ensure(pid: string) {
    if (!companyStats.has(pid)) {
      companyStats.set(pid, {
        emailsThisMonth: 0,
        smsThisMonth: 0,
        totalSent: 0,
        failedCount: 0,
      });
    }
    return companyStats.get(pid)!;
  }

  // Aggregate communication_messages
  for (const r of commRows) {
    const pid = r.portfolio_id ?? (r.portfolios as any)?.id;
    if (!pid) continue;
    const s = ensure(pid);

    const isSent = r.status === 'sent';
    const isFailed = r.status === 'failed';

    if (isSent || isFailed) {
      if (r.channel === 'email' && isSent && inThisMonth(r.sent_at)) s.emailsThisMonth++;
      if (r.channel === 'sms' && isSent && inThisMonth(r.sent_at)) s.smsThisMonth++;
      if (isSent) s.totalSent++;
      if (isFailed) s.failedCount++;
    }
  }

  // Aggregate sms_messages
  for (const r of smsRows) {
    const pid = convToPortfolio.get(r.conversation_id);
    if (!pid) continue;
    const s = ensure(pid);

    const isSent = r.status === 'sent' || r.status === 'delivered';
    const isFailed = r.status === 'failed';

    if (isSent && inThisMonth(r.sent_at)) s.smsThisMonth++;
    if (isSent) s.totalSent++;
    if (isFailed) s.failedCount++;
  }

  /* --- Build table rows --------------------------------------------------- */

  const companyRows: CompanyStats[] = [];

  for (const [pid, stats] of companyStats) {
    const companyName = portfolioById.get(pid) ?? 'Unknown';
    const attempted = stats.totalSent + stats.failedCount;
    const deliveryRate = attempted > 0
      ? Math.round((stats.totalSent / attempted) * 1000) / 10
      : 100;

    companyRows.push({
      portfolioId: pid,
      companyName,
      emailsThisMonth: stats.emailsThisMonth,
      smsThisMonth: stats.smsThisMonth,
      totalSent: stats.totalSent,
      failedCount: stats.failedCount,
      deliveryRate,
    });
  }

  // Sort by total sent descending
  companyRows.sort((a, b) => b.totalSent - a.totalSent);

  // Overall delivery rate
  const overallAttempted = totalSent + totalFailed;
  const overallDeliveryRate = overallAttempted > 0
    ? Math.round((totalSent / overallAttempted) * 1000) / 10
    : 100;

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="-mx-8 -my-8 min-h-[calc(100vh-64px)] bg-[#060B18]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="[&_h1]:text-white [&_.text-slate-400]:text-slate-400 [&_.text-gray-900]:text-white">
          <WorkspaceHeader
            eyebrow="Platform Operator"
            title="Communications Monitor"
            subtitle="Cross-portfolio oversight of email and SMS delivery, failure rates, and monthly volume trends."
          />
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="px-8 py-6 space-y-6">

        {/* ── KPI Row 1: Overview Stats ─────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiTile
            label="Emails Sent"
            value={emailsSent.toLocaleString()}
            sub={`${emailsFailed} failed`}
            icon={Mail}
            accent="blue"
          />
          <KpiTile
            label="Failed Emails"
            value={emailsFailed.toLocaleString()}
            sub={emailsFailed > 0 ? 'Requires attention' : 'All emails delivered'}
            icon={MailX}
            accent={emailsFailed > 0 ? 'red' : 'emerald'}
          />
          <KpiTile
            label="SMS Sent"
            value={totalSmsSent.toLocaleString()}
            sub={`${totalSmsFailed} failed`}
            icon={MessageSquare}
            accent="emerald"
          />
          <KpiTile
            label="Failed SMS"
            value={totalSmsFailed.toLocaleString()}
            sub={totalSmsFailed > 0 ? 'Requires attention' : 'All SMS delivered'}
            icon={MessageSquareX}
            accent={totalSmsFailed > 0 ? 'red' : 'emerald'}
          />
        </div>

        {/* ── KPI Row 2: Aggregate Stats ────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiTile
            label="Total Messages Sent"
            value={totalSent.toLocaleString()}
            sub={`Across all channels and portfolios`}
            icon={TrendingUp}
            accent="blue"
          />
          <KpiTile
            label="Total Failures"
            value={totalFailed.toLocaleString()}
            sub={totalFailed > 0 ? 'Delivery issues detected' : 'No failures'}
            icon={AlertTriangle}
            accent={totalFailed > 0 ? 'red' : 'emerald'}
          />
          <KpiTile
            label="Overall Delivery Rate"
            value={`${overallDeliveryRate}%`}
            sub={`${totalSent} of ${overallAttempted} delivered`}
            icon={Activity}
            accent={overallDeliveryRate >= 95 ? 'emerald' : overallDeliveryRate >= 85 ? 'amber' : 'red'}
          />
          <KpiTile
            label="Active Companies"
            value={companyRows.length}
            sub={`With communication activity`}
            icon={Building2}
            accent="slate"
          />
        </div>

        {/* ── Monthly Volume by Company Table ───────────────────────────── */}
        <div className="rounded-xl border border-white/[0.06]">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4">
            <BarChart3 className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Monthly Volume by Company</h3>
            <span className="ml-auto text-xs text-slate-400">
              {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] text-xs uppercase tracking-wider text-slate-400">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-3 text-left font-semibold">Company</th>
                  <th className="px-5 py-3 text-right font-semibold">Emails This Month</th>
                  <th className="px-5 py-3 text-right font-semibold">SMS This Month</th>
                  <th className="px-5 py-3 text-right font-semibold">Total Sent</th>
                  <th className="px-5 py-3 text-right font-semibold">Failed</th>
                  <th className="px-5 py-3 text-right font-semibold">Delivery Rate</th>
                  <th className="px-5 py-3 text-left font-semibold">Abuse Warnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {companyRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center text-slate-400">
                      <Building2 className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                      <p className="text-sm">No communication activity across any portfolio.</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Communications will appear here once emails or SMS messages are sent.
                      </p>
                    </td>
                  </tr>
                ) : (
                  companyRows.map((row) => {
                    const attempted = row.totalSent + row.failedCount;
                    const rateColor =
                      row.deliveryRate >= 95
                        ? 'text-emerald-400'
                        : row.deliveryRate >= 85
                          ? 'text-amber-400'
                          : 'text-red-400';

                    return (
                      <tr
                        key={row.portfolioId}
                        className="transition hover:bg-white/[0.02]"
                      >
                        {/* Company */}
                        <td className="px-5 py-3 align-top">
                          <span className="font-medium text-white">{row.companyName}</span>
                        </td>

                        {/* Emails This Month */}
                        <td className="px-5 py-3 text-right align-top tabular-nums">
                          <span className={row.emailsThisMonth > 0 ? 'text-slate-200' : 'text-slate-400'}>
                            {row.emailsThisMonth.toLocaleString()}
                          </span>
                        </td>

                        {/* SMS This Month */}
                        <td className="px-5 py-3 text-right align-top tabular-nums">
                          <span className={row.smsThisMonth > 0 ? 'text-slate-200' : 'text-slate-400'}>
                            {row.smsThisMonth.toLocaleString()}
                          </span>
                        </td>

                        {/* Total Sent */}
                        <td className="px-5 py-3 text-right align-top tabular-nums text-slate-200">
                          {row.totalSent.toLocaleString()}
                        </td>

                        {/* Failed */}
                        <td className="px-5 py-3 text-right align-top tabular-nums">
                          {row.failedCount > 0 ? (
                            <span className="text-red-400">{row.failedCount.toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>

                        {/* Delivery Rate */}
                        <td className="px-5 py-3 text-right align-top tabular-nums">
                          <span className={`font-medium ${rateColor}`}>
                            {row.deliveryRate}%
                          </span>
                          <div className="text-[10px] text-slate-400">
                            {row.totalSent}/{attempted}
                          </div>
                        </td>

                        {/* Abuse Warnings */}
                        <td className="px-5 py-3 align-top">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs text-slate-400 ring-1 ring-inset ring-slate-500/20">
                            <AlertTriangle className="h-3 w-3" />
                            None
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {companyRows.length > 0 && (
            <div className="border-t border-white/[0.06] px-5 py-3 text-xs text-slate-400">
              {companyRows.length} portfolio{companyRows.length !== 1 ? 's' : ''} with communication activity
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
