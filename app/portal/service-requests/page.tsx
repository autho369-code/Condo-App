import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { cancelServiceRequest } from '@/lib/rpcs/service-requests';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  open:      'bg-amber-100 text-amber-800',
  waiting:   'bg-blue-100 text-champagne-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-cream-100 text-ink-500 line-through',
};

const PRIORITY_BADGE: Record<string, string> = {
  emergency: 'bg-red-100 text-red-800',
  high:      'bg-orange-100 text-orange-800',
  normal:    'bg-cream-100 text-ink-700',
  low:       'bg-cream-100 text-ink-500',
};

export default async function ServiceRequestsList({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  await requireAuth();
  const { submitted } = await searchParams;
  const supabase = await createClient();

  const { data: rows } = await (supabase as any)
    .from('service_requests')
    .select(`
      id, number, description, priority, status, source, created_on, created_at,
      permission_to_enter,
      units(unit_number, buildings(associations(name))),
      work_orders(id, status)
    `)
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-editorial text-ink-900">Service requests</h1>
          <p className="text-sm text-ink-500">Report an issue or check on something you already submitted.</p>
        </div>
        <Link href="/portal/service-requests/new"><Button size="lg">+ New request</Button></Link>
      </div>

      {submitted && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Your request was submitted. We&apos;ll follow up once it&apos;s been reviewed â€” usually within one business day.
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Your requests</CardTitle></CardHeader>
        <CardBody>
          {rows && rows.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>#</TH>
                  <TH>Issue</TH>
                  <TH>Unit</TH>
                  <TH>Priority</TH>
                  <TH>Status</TH>
                  <TH>Submitted</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {rows.map((r: any) => {
                  const assoc = r.units?.buildings?.associations;
                  const wo    = Array.isArray(r.work_orders) ? r.work_orders[0] : r.work_orders;
                  const firstLine = (r.description ?? '').split('\n')[0];
                  const isOpen = r.status === 'open' || r.status === 'waiting';
                  return (
                    <TR key={r.id}>
                      <TD className="whitespace-nowrap font-mono text-xs text-ink-500">
                        {r.number ?? r.id.slice(0, 8)}
                      </TD>
                      <TD className="max-w-xs">
                        <div className="line-clamp-2 text-sm text-ink-900">{firstLine}</div>
                        {wo && (
                          <div className="mt-0.5 text-xs text-ink-500">
                            â†’ Work order <span className="capitalize">{wo.status?.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap text-sm">
                        {assoc?.name ? <span className="text-ink-500">{assoc.name} Â· </span> : null}
                        Unit {r.units?.unit_number ?? 'â€”'}
                      </TD>
                      <TD>
                        <span className={`rounded px-2 py-0.5 text-xs capitalize ${PRIORITY_BADGE[r.priority] ?? 'bg-cream-100 text-ink-700'}`}>
                          {r.priority}
                        </span>
                      </TD>
                      <TD>
                        <span className={`rounded px-2 py-0.5 text-xs capitalize ${STATUS_BADGE[r.status] ?? 'bg-cream-100 text-ink-700'}`}>
                          {r.status}
                        </span>
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">{date(r.created_on ?? r.created_at)}</TD>
                      <TD>
                        {isOpen && !wo && (
                          <form action={cancelServiceRequest.bind(null, r.id) as any}>
                            <button type="submit" className="text-xs text-red-600 hover:underline">
                              Cancel
                            </button>
                          </form>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-ink-500">You haven&apos;t submitted any service requests yet.</p>
              <Link href="/portal/service-requests/new" className="mt-2 inline-block text-sm text-brand-600 hover:underline">
                Submit your first request â†’
              </Link>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
