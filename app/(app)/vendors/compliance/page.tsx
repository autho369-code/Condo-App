import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Section } from '@/components/workspace/shell';
import { requireStaff } from '@/lib/auth/me';
import { resendVendorRequest, reviewVendorDocument } from '@/lib/rpcs/vendor-document-requests';
import { isScopedStoragePath } from '@/lib/security/storage-paths';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';
import { vendorDocExpires, vendorDocLabel } from '@/lib/vendors/document-requests';
import { tradeLabel } from '@/lib/vendors/options';

export const dynamic = 'force-dynamic';

const EXPIRATIONS = [
  ['general_liability_expiration', 'General liability', 'general_liability'],
  ['workers_comp_expiration', 'Workers’ comp', 'workers_comp'],
  ['auto_insurance_expiration', 'Auto', 'auto_insurance'],
  ['state_license_expiration', 'License', 'state_license'],
] as const;

function tone(expiresAt: string | null) {
  if (!expiresAt) return 'neutral' as const;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'danger' as const;
  if (days <= 30) return 'warning' as const;
  return 'success' as const;
}
const REQUEST_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger' | 'info'> = {
  requested: 'info', in_progress: 'info', submitted: 'warning', approved: 'success', rejected: 'danger', expired: 'neutral',
};

export default async function VendorCompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vendor?: string; error?: string; saved?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const db = (await createClient()) as any;

  const [{ data: vendors }, { data: requests }] = await Promise.all([
    db.from('vendors').select('id, name, trade, general_liability_expiration, workers_comp_expiration, auto_insurance_expiration, state_license_expiration, taxpayer_id')
      .is('archived_at', null).order('name'),
    db.from('document_requests').select('id, vendor_id, doc_type, status, requested_at, submitted_at, due_date, review_note, attachment_urls, notes, vendors(name)')
      .not('vendor_id', 'is', null).order('requested_at', { ascending: false }).limit(500),
  ]);

  const all = (requests ?? []) as any[];
  const awaitingReview = all.filter((r) => r.status === 'submitted');
  const outstanding = all.filter((r) => ['requested', 'in_progress', 'rejected'].includes(r.status));

  // Signed links for files awaiting review.
  const links = new Map<string, string>();
  const toSign = awaitingReview
    .map((r) => ({ id: r.id, path: Array.isArray(r.attachment_urls) ? r.attachment_urls[r.attachment_urls.length - 1] : null, vendor: r.vendor_id }))
    .filter((x) => isScopedStoragePath(x.path, 'vendors', x.vendor));
  if (toSign.length) {
    try {
      const { data: signed } = await (createServiceClient() as any).storage.from('association-documents').createSignedUrls(toSign.map((x) => x.path), 3600);
      const byPath = new Map<string, string>((signed ?? []).filter((x: any) => x?.signedUrl).map((x: any) => [x.path, x.signedUrl]));
      for (const x of toSign) { const u = byPath.get(x.path); if (u) links.set(x.id, u); }
    } catch {}
  }

  let rows = (vendors ?? []) as any[];
  if (sp.vendor) rows = rows.filter((v) => v.id === sp.vendor);
  if (q) rows = rows.filter((v) => [v.name, v.trade].some((x) => x?.toLowerCase().includes(q)));
  const expiredCount = rows.filter((v) => EXPIRATIONS.some(([k]) => tone(v[k]) === 'danger')).length;
  const expiringCount = rows.filter((v) => EXPIRATIONS.some(([k]) => tone(v[k]) === 'warning')).length;

  return (
    <DataWorkspace
      title="Vendor compliance"
      description="Insurance, license and W-9 status for every vendor. Request a document and the vendor gets a secure upload link; you approve what comes back."
      actions={<Link href="/vendors/forms"><Button>Request a document</Button></Link>}
    >
      <div className="space-y-5">
        {sp.error && <Alert tone="danger">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success">{sp.saved}</Alert>}
        <MetricStrip metrics={[
          { label: 'Vendors', value: rows.length },
          { label: 'Awaiting your review', value: awaitingReview.length },
          { label: 'Expiring within 30 days', value: expiringCount },
          { label: 'Expired', value: expiredCount },
        ]} />

        {awaitingReview.length > 0 && (
          <Section title="Awaiting your review" subtitle="Check the file, then approve (with the expiration date for insurance and licenses) or send it back with a reason.">
            <ul className="divide-y divide-gray-100">
              {awaitingReview.map((r) => (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-gray-950">{r.vendors?.name} · {vendorDocLabel(r.doc_type)}</div>
                      <div className="text-xs text-gray-500">Received {date(r.submitted_at)}</div>
                    </div>
                    {links.has(r.id) && <a href={links.get(r.id)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-700 underline hover:text-gray-950">Open file</a>}
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <form action={reviewVendorDocument} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="decision" value="approve" />
                      {vendorDocExpires(r.doc_type) && (
                        <Field label="Expires" htmlFor={`exp-${r.id}`}><Input id={`exp-${r.id}`} name="expires_on" type="date" required className="w-40" /></Field>
                      )}
                      <Button type="submit" size="sm">Approve</Button>
                    </form>
                    <form action={reviewVendorDocument} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <Field label="Reason (sent to the vendor)" htmlFor={`note-${r.id}`} className="min-w-56 flex-1">
                        <Input id={`note-${r.id}`} name="note" required minLength={3} maxLength={1000} placeholder="e.g. Association not listed as additional insured" />
                      </Field>
                      <Button type="submit" size="sm" variant="secondary">Send back</Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {outstanding.length > 0 && (
          <Section title="Waiting on vendors">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <THead><TR><TH>Vendor</TH><TH>Document</TH><TH>Status</TH><TH>Requested</TH><TH>Due</TH><TH /></TR></THead>
              <tbody>
                {outstanding.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium text-gray-950">{r.vendors?.name}</TD>
                    <TD>{vendorDocLabel(r.doc_type)}{r.review_note && <div className="text-xs text-red-700">Sent back: {r.review_note}</div>}</TD>
                    <TD><StatusChip tone={REQUEST_TONE[r.status] ?? 'neutral'}>{r.status === 'rejected' ? 'Sent back' : 'Requested'}</StatusChip></TD>
                    <TD className="tabular-nums">{date(r.requested_at)}</TD>
                    <TD className="tabular-nums">{r.due_date ? date(r.due_date) : '—'}</TD>
                    <TD className="text-right">
                      <form action={resendVendorRequest}>
                        <input type="hidden" name="request_id" value={r.id} />
                        <Button type="submit" size="sm" variant="ghost">Resend link</Button>
                      </form>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </table></div>
          </Section>
        )}

        <FilterBar action="/vendors/compliance" searchDefault={sp.q ?? ''} searchPlaceholder="Search vendors" />
        <Table>
          <THead><TR><TH>Vendor</TH>{EXPIRATIONS.map(([, label]) => <TH key={label}>{label}</TH>)}<TH>W-9</TH><TH /></TR></THead>
          <tbody>
            {rows.map((v) => {
              const lapsed = EXPIRATIONS.find(([k]) => tone(v[k]) === 'danger' || tone(v[k]) === 'warning');
              return (
                <TR key={v.id}>
                  <TD><Link href={`/vendors/${v.id}`} className="font-medium text-gray-950 hover:underline">{v.name}</Link><div className="text-xs text-gray-500">{tradeLabel(v.trade)}</div></TD>
                  {EXPIRATIONS.map(([k]) => (
                    <TD key={k}><StatusChip tone={tone(v[k])}>{v[k] ? date(v[k]) : 'None'}</StatusChip></TD>
                  ))}
                  <TD><StatusChip tone={v.taxpayer_id ? 'success' : 'warning'}>{v.taxpayer_id ? 'On file' : 'Missing'}</StatusChip></TD>
                  <TD className="text-right">
                    <Link href={`/vendors/forms?vendor=${v.id}&doc=${lapsed ? lapsed[2] : v.taxpayer_id ? 'general_liability' : 'w9'}`} className="text-sm font-medium text-gray-600 hover:text-gray-950">Request →</Link>
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
