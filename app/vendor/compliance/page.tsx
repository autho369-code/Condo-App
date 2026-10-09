import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { FileText, ShieldCheck } from 'lucide-react';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireVendor } from '@/lib/auth/me';
import { PageHeader, Surface, SectionTitle, Badge, Alert } from '@/components/ui/shell';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { Input } from '@/components/ui/input';
import { complianceState } from '@/lib/vendors/portal';
import { todayInZone } from '@/lib/time/zoned';
import { ComplianceDocumentForm } from '@/components/vendor/compliance-document-form';
import { isScopedStoragePath } from '@/lib/security/storage-paths';
import { date } from '@/lib/utils';
import { vendorAssociationLabel } from '@/lib/vendors/options';

export const dynamic = 'force-dynamic';

const FIELDS = [
  { key: 'workers_comp_expiration', label: 'Workers compensation' },
  { key: 'general_liability_expiration', label: 'General liability' },
  { key: 'auto_insurance_expiration', label: 'Auto insurance' },
  { key: 'epa_certification_expiration', label: 'EPA certification' },
  { key: 'state_license_expiration', label: 'State license' },
] as const;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function statusFor(d: string | null, today: string): { tone: 'complete' | 'pending' | 'danger' | 'inactive'; label: string } {
  const state = complianceState(d, today);
  if (state === 'missing') return { tone: 'inactive', label: 'Not on file' };
  if (state === 'expired') return { tone: 'danger', label: 'Expired' };
  if (state === 'expiring') return { tone: 'pending', label: 'Expiring soon' };
  return { tone: 'complete', label: 'Current' };
}

export default async function VendorCompliance({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; saved_document?: string; record?: string }>;
}) {
  const me = await requireVendor();
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayInZone();
  // One login can hold a vendor record per association; each keeps its own
  // compliance dates, documents and requests. Work on one record at a time.
  const { data: recordRows, error: recordError } = await (supabase as any)
    .from('vendors').select('id, is_management_company, associations(name)').in('id', me.vendor_ids).order('id');
  if (recordError) throw new Error(`Could not load your associations: ${recordError.message}`);
  // The login's first record first, then by association name.
  const records: any[] = [...(recordRows ?? [])].sort((a: any, b: any) =>
    (a.id === me.vendor_id ? -1 : b.id === me.vendor_id ? 1 : 0)
    || vendorAssociationLabel(a).localeCompare(vendorAssociationLabel(b)));
  const recordId: string = sp.record && me.vendor_ids.includes(sp.record) ? sp.record : (me.vendor_id as string);
  const recordQuery = records.length > 1 ? `record=${encodeURIComponent(recordId)}&` : '';
  const [complianceResult, claimResult, documentResult, requestResult] = await Promise.all([
    // Official dates live on the vendor record (what management sees). The
    // vendor's own entries in vendor_compliance are only claims: they are no
    // longer copied onto the vendor (trg_vendor_compliance_sync is disabled);
    // official dates change when management approves the uploaded document.
    (supabase as any).from('vendors').select('workers_comp_expiration, general_liability_expiration, epa_certification_expiration, auto_insurance_expiration, state_license_expiration, contract_expiration').eq('id', recordId).maybeSingle(),
    (supabase as any).from('vendor_compliance').select('workers_comp_expiration, general_liability_expiration, epa_certification_expiration, auto_insurance_expiration, state_license_expiration, updated_at').eq('vendor_id', recordId).maybeSingle(),
    (supabase as any).from('documents')
      .select('id, doc_type, file_name, file_url, expires_at, uploaded_at')
      .eq('entity_type', 'vendor').eq('entity_id', recordId).order('uploaded_at', { ascending: false }),
    (supabase as any).from('document_requests')
      .select('id, name, doc_type, status, due_date, requested_at')
      .eq('vendor_id', recordId).neq('status', 'approved').order('requested_at', { ascending: false }),
  ]);
  if (complianceResult.error) throw new Error(`Could not load compliance dates: ${complianceResult.error.message}`);
  if (claimResult.error) throw new Error(`Could not load your submitted dates: ${claimResult.error.message}`);
  if (documentResult.error) throw new Error(`Could not load compliance documents: ${documentResult.error.message}`);
  if (requestResult.error) throw new Error(`Could not load document requests: ${requestResult.error.message}`);
  const c = complianceResult.data;
  const claims = claimResult.data;
  const documents = documentResult.data ?? [];
  const requests = requestResult.data ?? [];

  const safePaths = documents
    .filter((document: any) => isScopedStoragePath(document.file_url, 'vendors', recordId))
    .map((document: any) => document.file_url);
  const signedByPath = new Map<string, string>();
  if (safePaths.length) {
    const { data: signed, error: signedError } = await (createServiceClient() as any).storage
      .from('association-documents').createSignedUrls(safePaths, 3600);
    if (signedError) throw new Error(`Could not authorize compliance document links: ${signedError.message}`);
    for (const item of signed ?? []) if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
  }

  async function save(formData: FormData) {
    'use server';
    const me2 = await requireVendor();
    const supabase2 = await createClient();
    // The record (association) these dates are for: one of this login's.
    const target = String(formData.get('record_id') ?? '');
    const record = me2.vendor_ids.includes(target) ? target : null;
    const back = (query: string) => `/vendor/compliance?${record && me2.vendor_ids.length > 1 ? `record=${encodeURIComponent(record)}&` : ''}${query}`;
    if (!record) redirect(back(`error=${encodeURIComponent('Choose one of your associations.')}`));
    const patch: Record<string, any> = { vendor_id: record, updated_at: new Date().toISOString() };
    for (const f of FIELDS) {
      const v = String(formData.get(f.key) ?? '').trim() || null;
      if (v && !DATE_ONLY.test(v)) redirect(back(`error=${encodeURIComponent(`Enter a valid ${f.label.toLowerCase()} date.`)}`));
      patch[f.key] = v;
    }
    const { error } = await (supabase2 as any).from('vendor_compliance').upsert(patch, { onConflict: 'vendor_id' });
    if (error) redirect(back(`error=${encodeURIComponent(error.message)}`));
    revalidatePath('/vendor/compliance');
    redirect(back('saved=1'));
  }

  return (
    <div>
      <PageHeader
        title="Compliance"
        description="Insurance and license expiration dates. Upload the certificate for each one: management reviews it before the date counts toward your compliance."
      />

      {sp.error && <Alert tone="danger" title="Could not save:" className="mb-5">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success" className="mb-5">Dates sent to management. They count toward your compliance once management approves the matching document.</Alert>}
      {sp.saved_document && <Alert tone="success" className="mb-5">Compliance document uploaded for management review.</Alert>}

      {records.length > 1 && (
        <div className="mb-5">
          <p className="mb-2 text-[13px] text-gray-500">Each association keeps its own compliance file. Showing:</p>
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-gray-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            {records.map((record: any) => (
              <Link
                key={record.id}
                href={`/vendor/compliance?record=${encodeURIComponent(record.id)}`}
                aria-current={record.id === recordId ? 'page' : undefined}
                className={
                  'flex min-h-10 items-center justify-center rounded-lg px-4 text-[13px] font-medium transition-colors ' +
                  (record.id === recordId ? 'bg-gray-950 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900')
                }
              >
                {vendorAssociationLabel(record)}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Surface>
        <SectionTitle title="Certificates & licenses" description="Enter the expiration date from each document. The status shows the date management has approved." />
        <form action={save} className="space-y-1">
          <input type="hidden" name="record_id" value={recordId} />
          <ul className="divide-y divide-gray-50">
            {FIELDS.map((f) => {
              const official = c?.[f.key] ?? null;
              const claimed = claims?.[f.key] ?? null;
              const s = statusFor(official, today);
              const pendingReview = !!claimed && claimed !== official;
              return (
                <li key={f.key} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <ShieldCheck className="h-4 w-4 flex-shrink-0 text-gray-300" />
                      <span className="text-[13px] font-medium text-gray-800">{f.label}</span>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </div>
                    {(official || pendingReview) && (
                      <p className="mt-1 pl-6 text-[12px] text-gray-500">
                        {official ? `On file: expires ${date(official)}` : 'Nothing approved yet'}
                        {pendingReview ? ` · You entered ${date(claimed)} (awaiting management review)` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 sm:w-56">
                    <Input type="date" name={f.key} defaultValue={claimed ?? official ?? ''} aria-label={`${f.label} expiration date`} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="pt-4">
            <PendingSubmit pendingLabel="Saving…">Save compliance dates</PendingSubmit>
          </div>
        </form>
        {claims?.updated_at && <p className="mt-3 text-[12px] text-gray-400">You last sent dates {date(claims.updated_at)}</p>}
      </Surface>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Surface>
          <SectionTitle title="Upload a compliance document" description="Send insurance, licenses, contracts, or tax documents securely to management." />
          <ComplianceDocumentForm vendorId={recordId} returnQuery={recordQuery} requests={requests.map((request: any) => ({ id: request.id, name: request.name, doc_type: request.doc_type }))} />
        </Surface>

        <Surface>
          <SectionTitle title="Documents on file" description="Private files currently visible to you and your management company." />
          {documents.length === 0 ? (
            <p className="text-sm text-gray-500">No compliance documents uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {documents.map((document: any) => (
                <li key={document.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">{document.file_name}</div>
                    <div className="mt-0.5 text-xs capitalize text-gray-500">
                      {document.doc_type.replace(/_/g, ' ')} · Uploaded {date(document.uploaded_at)}
                      {/* Stored as midnight UTC of the calendar day; show that day, not the instant. */}
                      {document.expires_at ? ` · Expires ${date(String(document.expires_at).slice(0, 10))}` : ''}
                    </div>
                  </div>
                  {signedByPath.get(document.file_url) && (
                    <a href={signedByPath.get(document.file_url)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-700 hover:text-gray-950 hover:underline">View</a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>

      {requests.length > 0 && (
        <Surface className="mt-5">
          <SectionTitle title="Requests from management" description="Upload the requested file above and link it to the matching request." />
          <ul className="divide-y divide-gray-100">
            {requests.map((request: any) => (
              <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div>
                  <div className="text-sm font-medium text-gray-900">{request.name}</div>
                  <div className="mt-0.5 text-xs capitalize text-gray-500">{request.doc_type.replace(/_/g, ' ')}{request.due_date ? ` · Due ${date(request.due_date)}` : ''}</div>
                </div>
                <Badge status={request.status} />
              </li>
            ))}
          </ul>
        </Surface>
      )}
    </div>
  );
}
