import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Surface, SectionTitle } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const COMPLIANCE_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'workers_comp_expiration', label: "Workers' comp" },
  { key: 'general_liability_expiration', label: 'General liability' },
  { key: 'auto_insurance_expiration', label: 'Auto insurance' },
  { key: 'epa_certification_expiration', label: 'EPA certification' },
  { key: 'state_license_expiration', label: 'State license' },
  { key: 'contract_expiration', label: 'Contract' },
];

function expirationTone(value: string | null): { tone: Tone; label: string } {
  if (!value) return { tone: 'neutral', label: 'Not on file' };
  const d = new Date(value);
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 86400000);
  if (d < now) return { tone: 'danger', label: `Expired ${date(value)}` };
  if (d <= soon) return { tone: 'warning', label: `Expires ${date(value)}` };
  return { tone: 'success', label: `Valid to ${date(value)}` };
}

function woStatusTone(status: string | null): Tone {
  switch (status) {
    case 'completed':
    case 'closed':
      return 'success';
    case 'in_progress':
    case 'scheduled':
    case 'assigned':
      return 'info';
    case 'cancelled':
      return 'neutral';
    default:
      return 'warning';
  }
}

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: vendor }, { data: workOrders }] = await Promise.all([
    db.from('vendors').select('*').eq('id', id).is('archived_at', null).maybeSingle(),
    db
      .from('work_orders')
      .select('id, number, title, status, priority, scheduled_date, completed_date, created_at, associations(name)')
      .eq('vendor_id', id)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(25),
  ]);

  if (!vendor) notFound();

  const wos = (workOrders ?? []) as any[];
  const openWos = wos.filter((w) => !['completed', 'closed', 'cancelled'].includes(w.status)).length;
  const emails: string[] = Array.isArray(vendor.emails) ? vendor.emails : [];
  const phones: Array<{ type?: string; number?: string }> = Array.isArray(vendor.phone_numbers) ? vendor.phone_numbers : [];

  const expiredCount = COMPLIANCE_FIELDS.filter((f) => {
    const v = vendor[f.key];
    return v && new Date(v) < new Date();
  }).length;

  const addressParts = [vendor.address_street, vendor.address_city, vendor.address_state, vendor.address_zip].filter(Boolean);

  return (
    <DataWorkspace
      title={vendor.name}
      description={`${(vendor.trade ?? 'other').replace(/_/g, ' ')} · ${(vendor.vendor_type ?? 'general').replace(/_/g, ' ')}`}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/vendors"><Button variant="secondary"><ArrowLeft className="h-4 w-4" /> Vendors</Button></Link>
          <Link href={`/vendors/compliance?vendor=${vendor.id}`}><Button variant="secondary">Compliance docs</Button></Link>
        </div>
      }
    >
      <div className="space-y-6">
        <MetricStrip
          metrics={[
            { label: 'Work orders', value: wos.length },
            { label: 'Open work orders', value: openWos },
            { label: 'Expired compliance', value: expiredCount },
            { label: 'Portal', value: vendor.portal_activated ? 'Active' : 'Not invited' },
          ]}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Surface>
            <SectionTitle title="Contact" />
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-500">Emails</dt>
                <dd className="text-gray-900">{emails.length ? emails.join(', ') : '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-500">Phone</dt>
                <dd className="text-gray-900">{phones.length ? phones.map((p) => `${p.type ? `${p.type}: ` : ''}${p.number}`).join(', ') : '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-500">Address</dt>
                <dd className="text-gray-900">{addressParts.length ? addressParts.join(', ') : '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-500">Payment</dt>
                <dd className="text-gray-900 capitalize">{(vendor.payment_type ?? 'check').replace(/_/g, ' ')}{vendor.payment_terms ? ` · ${vendor.payment_terms}` : ''}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-500">1099</dt>
                <dd className="text-gray-900">{vendor.send_1099 ? (vendor.taxpayer_id ? 'W-9 on file' : 'Needs W-9') : 'Not required'}</dd>
              </div>
            </dl>
          </Surface>

          <Surface>
            <SectionTitle title="Compliance &amp; expirations" />
            <div className="space-y-2">
              {COMPLIANCE_FIELDS.map((f) => {
                const { tone, label } = expirationTone(vendor[f.key] ?? null);
                return (
                  <div key={f.key} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{f.label}</span>
                    <StatusChip tone={tone}>{label}</StatusChip>
                  </div>
                );
              })}
            </div>
          </Surface>
        </div>

        <Surface>
          <SectionTitle title="Recent work orders" description={`${wos.length} most recent`} />
          {wos.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No work orders assigned to this vendor yet.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Work order</TH>
                  <TH>Association</TH>
                  <TH>Status</TH>
                  <TH>Scheduled</TH>
                  <TH>Completed</TH>
                </TR>
              </THead>
              <tbody>
                {wos.map((w) => (
                  <TR key={w.id} className="hover:bg-gray-50">
                    <TD>
                      <Link href={`/work-orders/${w.id}`} className="font-medium text-gray-900 hover:underline">
                        {w.title}
                      </Link>
                      {w.number && <div className="text-xs text-gray-500">#{w.number}</div>}
                    </TD>
                    <TD className="text-gray-700">{w.associations?.name ?? '—'}</TD>
                    <TD><StatusChip tone={woStatusTone(w.status)}>{(w.status ?? '').replace(/_/g, ' ') || '—'}</StatusChip></TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{w.scheduled_date ? date(w.scheduled_date) : '—'}</TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{w.completed_date ? date(w.completed_date) : '—'}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Surface>
      </div>
    </DataWorkspace>
  );
}
