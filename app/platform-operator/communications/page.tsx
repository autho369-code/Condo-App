import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { Mail, MessageSquare, AlertTriangle, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'navy',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
  accent?: 'navy' | 'emerald' | 'amber' | 'red' | 'violet';
}) {
  const accents: Record<string, string> = {
    navy: 'bg-[#1E3A5F]/10 text-[#1E3A5F] border-[#1E3A5F]/20',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    violet: 'bg-violet-100 text-violet-700 border-violet-200',
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    blue: 'bg-blue-100 text-blue-700 ring-blue-200',
    red: 'bg-red-100 text-red-700 ring-red-200',
    amber: 'bg-amber-100 text-amber-700 ring-amber-200',
    gray: 'bg-gray-100 text-gray-600 ring-gray-200',
  };
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${colors[color] ?? colors.gray}`}>
      {label}
    </span>
  );
}

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
        <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
        <p className="mt-1 text-sm text-gray-500">Platform-wide communication volume monitoring</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Emails Sent (MTD)" value={emailsSent.toLocaleString()} icon={Mail} accent="navy" />
        <StatCard label="Emails Failed (MTD)" value={emailsFailed.toLocaleString()} sub={emailsSent > 0 ? `${((emailsFailed / emailsSent) * 100).toFixed(1)}% failure` : '0%'} icon={AlertTriangle} accent={emailsFailed > 0 ? 'red' : 'emerald'} />
        <StatCard label="SMS Sent (MTD)" value={smsSent.toLocaleString()} icon={MessageSquare} accent="violet" />
        <StatCard label="SMS Failed (MTD)" value={smsFailed.toLocaleString()} sub={smsSent > 0 ? `${((smsFailed / smsSent) * 100).toFixed(1)}% failure` : '0%'} icon={AlertTriangle} accent={smsFailed > 0 ? 'red' : 'emerald'} />
      </div>

      {/* Monthly Trend Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">6-Month Communication Trend</h2>
        <div className="flex items-end gap-3 h-48">
          {monthlyTrend.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs tabular-nums text-gray-500">{m.emails + m.sms}</span>
              <div className="w-full flex-1 flex items-end gap-1">
                <div
                  className="flex-1 rounded-t bg-[#1E3A5F]"
                  style={{ height: `${Math.max(((m.emails) / maxVol) * 100, 2)}%` }}
                />
                <div
                  className="flex-1 rounded-t bg-violet-400"
                  style={{ height: `${Math.max(((m.sms) / maxVol) * 100, 2)}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{m.month}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-[#1E3A5F]" /> Email</div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-violet-400" /> SMS</div>
        </div>
      </div>

      {/* Communications By Company */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Communications by Company</h2>
          <p className="mt-0.5 text-xs text-gray-500">Monthly breakdown per company</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-right">Emails Sent</th>
                <th className="px-4 py-3 text-right">Emails Failed</th>
                <th className="px-4 py-3 text-right">SMS Sent</th>
                <th className="px-4 py-3 text-right">SMS Failed</th>
                <th className="px-4 py-3 text-right">Delivery Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companyList.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No communications recorded this month</td></tr>
              ) : (
                companyList.map((c) => {
                  const totalSent = c.emailsSent + c.smsSent;
                  const totalFailed = c.emailsFailed + c.smsFailed;
                  const rate = totalSent > 0 ? Math.round(((totalSent - totalFailed) / totalSent) * 100) : 100;
                  return (
                    <tr key={c.name} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{c.emailsSent || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-600">{c.emailsFailed || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{c.smsSent || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-600">{c.smsFailed || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={`font-medium ${rate >= 95 ? 'text-emerald-600' : rate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
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
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Communications</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Channel</th>
                  <th className="px-4 py-3 text-left">Direction</th>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-right">Recipients</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthComms.slice(0, 50).map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={c.channel ?? 'unknown'} color={c.channel === 'email' ? 'blue' : c.channel === 'sms' ? 'emerald' : 'gray'} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.direction ?? '—'}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-gray-700">{c.subject ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{c.recipient_count ?? 0}</td>
                    <td className="px-4 py-3">
                      <Badge
                        label={c.status ?? 'unknown'}
                        color={c.status === 'sent' || c.status === 'delivered' ? 'emerald' : c.status === 'failed' ? 'red' : 'gray'}
                      />
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
