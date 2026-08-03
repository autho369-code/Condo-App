import Link from 'next/link';
import { CalendarDays, FileText, MessageSquare, ShieldCheck, Wrench } from 'lucide-react';
import { requireTenant } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { Alert, Badge, Metric, MetricStrip, PageHeader, Surface } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function ResidentDashboard() {
  const me = await requireTenant();
  const supabase = await createClient();
  const db = supabase as any;
  const now = new Date().toISOString();

  const [{ data: tenant }, { data: requests }, { data: events }, { data: announcements }] = await Promise.all([
    db.from('tenants')
      .select('id, first_name, last_name, email, phone, unit_id, lease_end, insurance_expiration, units(unit_number, buildings(name, associations(id, name)))')
      .eq('id', me.tenant_id)
      .maybeSingle(),
    db.from('service_requests')
      .select('id, number, description, priority, status, created_at')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
    db.from('calendar_events')
      .select('id, title, start_datetime, location')
      .is('archived_at', null)
      .gte('start_datetime', now)
      .order('start_datetime')
      .limit(4),
    db.from('communications_log')
      .select('id, subject, body, created_at')
      .eq('channel', 'announcement')
      .order('created_at', { ascending: false })
      .limit(4),
  ]);

  const unit = relation<any>(tenant?.units);
  const building = relation<any>(unit?.buildings);
  const association = relation<any>(building?.associations);
  const allRequests = requests ?? [];
  const openRequests = allRequests.filter((request: any) => !['cancelled', 'completed', 'closed'].includes(request.status));
  const insuranceExpiration = tenant?.insurance_expiration ? new Date(`${tenant.insurance_expiration}T12:00:00`) : null;
  const insuranceDays = insuranceExpiration
    ? Math.ceil((insuranceExpiration.getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={association?.name ?? 'Resident portal'}
        title={`Welcome, ${tenant?.first_name ?? me.profile?.full_name ?? 'Resident'}`}
        description={`${building?.name ? `${building.name} · ` : ''}Unit ${unit?.unit_number ?? 'not assigned'}`}
        actions={<Link href="/resident/requests"><Button><Wrench className="h-4 w-4" /> New service request</Button></Link>}
      />

      {insuranceDays !== null && insuranceDays <= 30 ? (
        <Alert tone={insuranceDays < 0 ? 'danger' : 'warning'}>
          <span className="font-semibold">Renter insurance:</span>{' '}
          {insuranceDays < 0 ? `Expired ${date(tenant.insurance_expiration)}.` : `Expires ${date(tenant.insurance_expiration)}.`}{' '}
          <Link href="/resident/profile" className="font-medium underline underline-offset-2">Update your policy details</Link>
        </Alert>
      ) : null}

      <MetricStrip>
        <Metric label="Open requests" value={openRequests.length} sub="Maintenance requests" accent="blue" />
        <Metric label="Upcoming events" value={(events ?? []).length} sub="Next 90 days" accent="violet" />
        <Metric label="Announcements" value={(announcements ?? []).length} sub="Recent updates" accent="emerald" />
        <Metric
          label="Insurance"
          value={insuranceExpiration ? (insuranceDays !== null && insuranceDays < 0 ? 'Expired' : 'On file') : 'Needed'}
          sub={insuranceExpiration ? date(tenant.insurance_expiration) : 'Add policy details'}
          accent={insuranceExpiration && (insuranceDays ?? 0) >= 0 ? 'emerald' : 'amber'}
        />
      </MetricStrip>

      <div className="grid gap-5 lg:grid-cols-2">
        <Surface>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-gray-950">Recent service requests</h2>
            <Link href="/resident/requests" className="text-xs font-medium text-gray-600 hover:text-gray-950">View all →</Link>
          </div>
          {allRequests.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No service requests yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {allRequests.map((request: any) => (
                <div key={request.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">{request.description?.split('\n')[0]}</div>
                    <div className="mt-0.5 text-xs text-gray-500">{request.number ?? request.id.slice(0, 8)} · {date(request.created_at)}</div>
                  </div>
                  <Badge status={request.status} />
                </div>
              ))}
            </div>
          )}
        </Surface>

        <Surface>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-gray-950">Community calendar</h2>
            <Link href="/resident/calendar" className="text-xs font-medium text-gray-600 hover:text-gray-950">Full calendar →</Link>
          </div>
          {(events ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No upcoming events.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {(events ?? []).map((event: any) => (
                <div key={event.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{event.title}</div>
                    <div className="mt-0.5 text-xs text-gray-500">{date(event.start_datetime, 'long')}{event.location ? ` · ${event.location}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/resident/documents" className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-gray-300">
          <FileText className="h-5 w-5 text-gray-500" />
          <div className="mt-3 text-sm font-semibold text-gray-950">Community documents</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">Declarations, bylaws, rules, forms, and meeting records.</div>
        </Link>
        <Link href="/resident/communications" className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-gray-300">
          <MessageSquare className="h-5 w-5 text-gray-500" />
          <div className="mt-3 text-sm font-semibold text-gray-950">Contact management</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">Send a secure message and read community announcements.</div>
        </Link>
        <Link href="/resident/profile" className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-gray-300">
          <ShieldCheck className="h-5 w-5 text-gray-500" />
          <div className="mt-3 text-sm font-semibold text-gray-950">Resident profile</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">Keep contact, emergency, and insurance details current.</div>
        </Link>
      </div>
    </div>
  );
}
