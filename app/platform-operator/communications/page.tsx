import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { Badge } from '@/components/ui/shell';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Mail, MessageSquare, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{value}</div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

const channelTone = (channel: string | null): Tone =>
  channel === 'email' ? 'info' : channel === 'sms' ? 'success' : 'neutral';

export default async function CommunicationsPage() {
  await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // All communications log
  let commRows: any[] = [];
  try {
    const { data } = await db
      .from('communications_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);
    commRows = data ?? [];
  } catch { commRows = []; }

  // Current month only
  const monthComms = commRows.filter((c: any) => c.created_at && c.created_at >= monthStart);

  // Stats
  const emailsSent = monthComms.filter((c: any) => c.channel === 'email').length;
  const emailsFailed = monthComms.filter((c: any) => c.channel === 'email' && c.status === 'failed').length;
  const smsSent = monthComms.filter((c: any) => c.channel === 'sms').length;
  const smsFailed = monthComms.filter((c: any) => c.channel === 'sms' && c.status === 'failed').length;

  // By company: need portfolios
  const { data: portfolios } = await db.from('portfolios').select('id, company_name');

  const portfolioMap = new Map<string, string>();
  for (const p of portfolios ?? []) portfolioMap.set(p.id, p.company_name);

  // Aggregate by portfolio
  const companyComms = new Map<string, { name: string; emailsSent: number; emailsFailed: number; smsSent: number; smsFailed: number }>();
  for (const p of portfolios ?? []) {
    companyComms.set(p.id, { name: p.company_name, emailsSent: 0, emailsFailed: 0, smsSent: 0, smsFailed: 0 });
  }
  for (const c of monthComms) {
    if (!c.portfolio_id) continue;
    const entry = companyComms.get(c.portfolio_id);
    if (!entry) continue;
    if (c.channel === 'email') {
      entry.emailsSent++;
      if (c.status === 'failed') entry.emailsFailed++;
    } else if (c.channel === 'sms') {
      entry.smsSent++;
      if (c.status === 'failed') entry.smsFailed++;
    }
  }
  const companyList = Array.from(companyComms.values())
    .filter((e) => e.emailsSent + e.smsSent > 0)
    .sort((a, b) => (b.emailsSent + b.smsSent) - (a.emailsSent + a.smsSent));

  // 6-month trend (group by month)
  const monthlyTrend: { month: string; emails: number; sms: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).toISOString();
    const inMonth = commRows.filter((c: any) => c.created_at >= start && c.created_at < end);
    monthlyTrend.push({
      month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      emails: inMonth.filter((c: any) => c.channel === 'email').length,
      sms: inMonth.filter((c: any) => c.channel === 'sms').length,
    });
  }
  const maxVol = Math.max(1, ...monthlyTrend.map((m) => m.emails + m.sms));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Communications</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Platform-wide communication volume monitoring</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Emails Sent (MTD)" value={emailsSent.toLocaleString()} icon={Mail} />
        <StatCard label="Emails Failed (MTD)" value={emailsFailed.toLocaleString()} sub={emailsSent > 0 ? `${((emailsFailed / emailsSent) * 100).toFixed(1)}% failure` : '0%'} icon={AlertTriangle} />
        <StatCard label="SMS Sent (MTD)" value={smsSent.toLocaleString()} icon={MessageSquare} />
        <StatCard label="SMS Failed (MTD)" value={smsFailed.toLocaleString()} sub={smsSent > 0 ? `${((smsFailed / smsSent) * 100).toFixed(1)}% failure` : '0%'} icon={AlertTriangle} />
      </div>

      {/* Monthly Trend Chart */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="mb-4 text-sm font-semibold text-gray-950">6-Month Communication Trend</h2>
        <div className="flex h-48 items-end gap-3">
          {monthlyTrend.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs tabular-nums text-gray-500">{m.emails + m.sms}</span>
              <div className="flex w-full flex-1 items-end gap-1">
                <div
                  className="flex-1 rounded-t bg-blue-600/80"
                  style={{ height: `${Math.max(((m.emails) / maxVol) * 100, 2)}%` }}
                />
                <div
                  className="flex-1 rounded-t bg-emerald-500/70"
                  style={{ height: `${Math.max(((m.sms) / maxVol) * 100, 2)}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{m.month}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-blue-600/80" /> Email</div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-emerald-500/70" /> SMS</div>
        </div>
      </div>

      {/* Communications By Company */}
      <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Communications by Company</h2>
          <p className="mt-0.5 text-xs text-gray-500">Monthly breakdown per company</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Company</th>
                <th className="px-4 py-2.5 text-right font-medium">Emails Sent</th>
                <th className="px-4 py-2.5 text-right font-medium">Emails Failed</th>
                <th className="px-4 py-2.5 text-right font-medium">SMS Sent</th>
                <th className="px-4 py-2.5 text-right font-medium">SMS Failed</th>
                <th className="px-4 py-2.5 text-right font-medium">Delivery Rate</th>
              </tr>
            </thead>
            <tbody>
              {companyList.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No communications recorded this month</td></tr>
              ) : (
                companyList.map((c) => {
                  const totalSent = c.emailsSent + c.smsSent;
                  const totalFailed = c.emailsFailed + c.smsFailed;
                  const rate = totalSent > 0 ? Math.round(((totalSent - totalFailed) / totalSent) * 100) : 100;
                  return (
                    <tr key={c.name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{c.emailsSent || '—'}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${c.emailsFailed ? 'text-red-700' : 'text-gray-400'}`}>{c.emailsFailed || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{c.smsSent || '—'}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${c.smsFailed ? 'text-red-700' : 'text-gray-400'}`}>{c.smsFailed || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={`font-medium ${rate >= 95 ? 'text-emerald-700' : rate >= 80 ? 'text-amber-700' : 'text-red-700'}`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Communications */}
      {monthComms.length > 0 && (
        <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-950">Recent Communications</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium">Channel</th>
                  <th className="px-4 py-2.5 text-left font-medium">Direction</th>
                  <th className="px-4 py-2.5 text-left font-medium">Subject</th>
                  <th className="px-4 py-2.5 text-right font-medium">Recipients</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {monthComms.slice(0, 50).map((c: any) => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-gray-500">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip tone={channelTone(c.channel)}>{c.channel ?? 'unknown'}</StatusChip>
                    </td>
                    <td className="px-4 py-3 text-[13px] capitalize text-gray-700">{c.direction ?? '—'}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-[13px] text-gray-700">{c.subject ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{c.recipient_count ?? 0}</td>
                    <td className="px-4 py-3">
                      <Badge status={c.status ?? 'unknown'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
