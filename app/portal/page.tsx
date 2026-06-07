import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PortalHome() {
  const me = await requireAuth();
  const supabase = await createClient();
  const db = supabase as any;
  const ownerId = me.profile?.id;
  if (!ownerId) return <div className="p-8 text-gray-500">Unable to load your account.</div>;

  const results = await Promise.all([
    db.from('v_unit_account_summary').select('*'),
    db.from('charges').select('amount,due_date,description,status').eq('owner_id', ownerId).order('due_date', { ascending: false }).limit(12),
    db.from('receivable_payments').select('amount,payment_date,method,status').eq('owner_id', ownerId).order('payment_date', { ascending: false }).limit(12),
    db.from('service_requests').select('id,title,status,created_at').eq('owner_id', ownerId).is('archived_at', null).order('created_at', { ascending: false }).limit(5),
  ]);
  const units = results[0]?.data ?? [];
  const charges = results[1]?.data ?? [];
  const payments = results[2]?.data ?? [];
  const serviceRequests = results[3]?.data ?? [];

  // Get association from first unit for calendar events
  const assocId = units[0]?.association_id;
  let calendarEvents: any[] = [];
  if (assocId) {
    const { data: ce } = await db.from('calendar_events')
      .select('id,title,start_datetime,location,operations_status')
      .eq('association_id', assocId)
      .gte('start_datetime', new Date().toISOString())
      .order('start_datetime')
      .limit(5);
    calendarEvents = ce ?? [];
  }

  const totalOutstanding = units.reduce((s: number, u: any) => s + Number(u.outstanding_balance ?? 0), 0);
  const totalCredit = units.reduce((s: number, u: any) => s + Number(u.unapplied_credit ?? 0), 0);
  const ytdCharges = (charges ?? []).filter((c: any) => c.status !== 'void').reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);
  const ytdPayments = (payments ?? []).filter((p: any) => p.status === 'completed').reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const openRequests = (serviceRequests ?? []).filter((s: any) => !['completed','cancelled','closed'].includes(s.status)).length;

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Welcome{me.profile?.full_name ? `, ${me.profile.full_name.split(' ')[0]}` : ''}</h1>
          <p className="text-sm text-gray-500">Your owner portal — financials, statements, and association updates</p>
        </div>
        {totalOutstanding > 0 && (
          <Link href="/portal/pay"><Button size="lg">Pay now</Button></Link>
        )}
      </header>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Current balance" value={money(totalOutstanding)} tone={totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'} />
        <MetricCard label="Credit on file" value={money(totalCredit)} tone="text-green-600" />
        <MetricCard label="YTD payments" value={money(ytdPayments)} />
        <MetricCard label="YTD charges" value={money(ytdCharges)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Units */}
        <div className="md:col-span-2 space-y-6">
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Your properties</h2>
            {units.length === 0 ? (
              <p className="text-sm text-gray-500">No units linked to your account.</p>
            ) : (
              <div className="space-y-3">
                {units.map((u: any) => (
                  <div key={u.unit_id} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium text-gray-900">{u.association_name}</div>
                      <div className="text-sm text-gray-500">Unit {u.unit_number}</div>
                      <div className="text-xs text-gray-400 mt-1">Charged {money(u.total_charged)} · Paid {money(u.total_paid)}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${Number(u.outstanding_balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {money(u.outstanding_balance)}
                      </div>
                      {Number(u.unapplied_credit) > 0 && (
                        <div className="text-xs text-green-600">+{money(u.unapplied_credit)} credit</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Charges */}
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Recent charges</h2>
              <Link href="/portal/ledger" className="text-xs text-blue-600 hover:underline">Full ledger</Link>
            </div>
            {(charges ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">No recent charges.</p>
            ) : (
              <div className="space-y-2">
                {(charges ?? []).slice(0, 5).map((c: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">{c.description || 'Charge'}</span>
                    <span className="text-gray-500">{date(c.due_date)}</span>
                    <span className="font-medium">{money(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick actions</h2>
            <div className="space-y-2">
              <QuickLink href="/portal/pay" label="Make a payment" />
              <QuickLink href="/portal/ledger" label="View ledger" />
              <QuickLink href="/portal/service-requests/new" label="Submit maintenance request" />
              <QuickLink href="/portal/service-requests" label={`Service requests${openRequests > 0 ? ` (${openRequests})` : ''}`} />
              <QuickLink href="/portal/autopay" label="Auto-pay settings" />
            </div>
          </section>

          {/* Service Requests */}
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent requests</h2>
            {(serviceRequests ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">No service requests.</p>
            ) : (
              <div className="space-y-2">
                {(serviceRequests ?? []).map((sr: any) => (
                  <div key={sr.id} className="text-sm">
                    <div className="font-medium text-gray-900">{sr.title}</div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${sr.status === 'open' ? 'bg-amber-100 text-amber-700' : sr.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{sr.status}</span>
                      <span>{date(sr.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Upcoming Events */}
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Upcoming events</h2>
            {(calendarEvents ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming events.</p>
            ) : (
              <div className="space-y-2">
                {(calendarEvents ?? []).map((ev: any) => (
                  <div key={ev.id} className="text-sm">
                    <div className="font-medium text-gray-900">{ev.title}</div>
                    <div className="text-xs text-gray-500">{date(ev.start_datetime)} · {ev.location || 'TBD'}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone = 'text-gray-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="block rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors">
      {label}
    </Link>
  );
}
