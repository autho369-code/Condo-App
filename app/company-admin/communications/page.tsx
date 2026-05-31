import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { date } from '@/lib/utils';
import {
  Mail,
  MailX,
  MessageSquare,
  MessageSquareX,
  Megaphone,
  Building2,
  Users,
  Clock,
  AlertTriangle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/* -------------------------------------------------------------------------- */
/*  Components                                                                 */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'slate',
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'slate';
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

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${gradient[accent]} p-5`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-white tabular-nums">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${iconBg[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function CommunicationsPage() {
  const me = await requireCompanyAdmin();
  const supabase = await createClient();
  const db = supabase as any;
  const portfolioId = me.portfolio?.id;

  if (!portfolioId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Mail className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white">No company assigned</h2>
          <p className="text-sm text-slate-400 mt-1">Contact the platform operator to set up your company.</p>
        </div>
      </div>
    );
  }

  // Get all association IDs for this portfolio
  const { data: associations } = await supabase
    .from('associations')
    .select('id, name')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name');

  const associationList = associations ?? [];
  const associationIds = associationList.map((a) => a.id);
  const associationMap = new Map(associationList.map((a) => [a.id, a.name]));

  // Get all profiles in this portfolio (for manager name lookups)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('portfolio_id', portfolioId);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email ?? 'Unknown']));

  // Fetch all email_queue entries for this portfolio's associations
  const { data: emailQueue } = await supabase
    .from('email_queue')
    .select('id, association_id, status, sent_by, sent_at, created_at, error_message')
    .in('association_id', associationIds.length ? associationIds : ['__none__']);

  const emails = emailQueue ?? [];

  // Now = reference
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Stats
  const sentEmails = emails.filter((e) => e.status === 'sent');
  const failedEmails = emails.filter((e) => e.status === 'failed');
  const thisMonth = emails.filter((e) => e.created_at >= startOfMonth);
  const sentThisMonth = thisMonth.filter((e) => e.status === 'sent');
  const failedThisMonth = thisMonth.filter((e) => e.status === 'failed');

  // Group by association
  const byAssociation = new Map<string, { total: number; sent: number; failed: number; lastDate: string | null }>();
  for (const e of emails) {
    const aid = e.association_id ?? '__unassigned__';
    const entry = byAssociation.get(aid) ?? { total: 0, sent: 0, failed: 0, lastDate: null };
    entry.total++;
    if (e.status === 'sent') entry.sent++;
    if (e.status === 'failed') entry.failed++;
    if (e.sent_at && (!entry.lastDate || e.sent_at > entry.lastDate)) entry.lastDate = e.sent_at;
    byAssociation.set(aid, entry);
  }

  // Group by manager (sent_by)
  const byManager = new Map<string, { total: number; sent: number; associations: Set<string> }>();
  for (const e of emails) {
    const senderId = e.sent_by ?? '__unknown__';
    const entry = byManager.get(senderId) ?? { total: 0, sent: 0, associations: new Set() };
    entry.total++;
    if (e.status === 'sent') entry.sent++;
    if (e.association_id) entry.associations.add(e.association_id);
    byManager.set(senderId, entry);
  }

  // Sort for display
  const associationRows = [...byAssociation.entries()]
    .sort(([, a], [, b]) => b.total - a.total);

  const managerRows = [...byManager.entries()]
    .sort(([, a], [, b]) => b.total - a.total);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Company Admin</p>
          <h1 className="mt-1 text-xl font-bold text-white">Communications Monitoring</h1>
          <p className="mt-1 text-sm text-slate-400">
            Aggregate communication metrics across {associationList.length} associations
          </p>
        </div>
      </div>

      {/* Communication content notice */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-300">
            Communication content is not displayed. Only aggregate metrics are shown.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Emails This Month"
          value={sentThisMonth.length}
          icon={Mail}
          accent={sentThisMonth.length > 0 ? 'emerald' : 'slate'}
        />
        <StatCard
          label="Failed Emails"
          value={failedThisMonth.length}
          icon={MailX}
          accent={failedThisMonth.length > 0 ? 'red' : 'slate'}
        />
        <StatCard
          label="SMS Sent"
          value="—"
          icon={MessageSquare}
          accent="slate"
        />
        <StatCard
          label="Failed SMS"
          value="—"
          icon={MessageSquareX}
          accent="slate"
        />
        <StatCard
          label="Owner Announcements"
          value="—"
          icon={Megaphone}
          accent="slate"
        />
        <StatCard
          label="Board Messages"
          value="—"
          icon={Users}
          accent="slate"
        />
      </div>

      {/* Summary row */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <span className="text-slate-400">Total emails:</span>
            <span className="font-semibold text-white tabular-nums">{emails.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-slate-500" />
            <span className="text-slate-400">Sent:</span>
            <span className="font-semibold text-white tabular-nums">{sentEmails.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <MailX className="h-4 w-4 text-slate-500" />
            <span className="text-slate-400">Failed:</span>
            <span className="font-semibold text-white tabular-nums">{failedEmails.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-500" />
            <span className="text-slate-400">Active associations:</span>
            <span className="font-semibold text-white tabular-nums">{byAssociation.size}</span>
          </div>
        </div>
      </div>

      {/* Communication Volume by Association */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="border-b border-white/[0.04] px-5 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Communication Volume by Association
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Association</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Emails Sent</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Failed</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Communication</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {associationRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-500">
                    No communication data available for this portfolio.
                  </td>
                </tr>
              ) : (
                associationRows.map(([aid, stats]) => (
                  <tr key={aid} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {associationMap.get(aid) ?? 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 text-right tabular-nums">{stats.sent}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">
                      {stats.failed > 0 ? (
                        <span className="text-red-400">{stats.failed}</span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 text-right tabular-nums">
                      {stats.lastDate ? date(stats.lastDate) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Communication Volume by Manager */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="border-b border-white/[0.04] px-5 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Communication Volume by Manager
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Manager</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Emails Sent</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Associations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {managerRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-sm text-slate-500">
                    No manager communication data available.
                  </td>
                </tr>
              ) : (
                managerRows.map(([senderId, stats]) => (
                  <tr key={senderId} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {profileMap.get(senderId) ?? senderId}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 text-right tabular-nums">{stats.sent}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 text-right tabular-nums">{stats.associations.size}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
