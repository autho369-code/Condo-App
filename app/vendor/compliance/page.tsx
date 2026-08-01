import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { FileText, ShieldCheck } from 'lucide-react';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireVendor } from '@/lib/auth/me';
import { PageHeader, Surface, SectionTitle, Badge, Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { ComplianceDocumentForm } from '@/components/vendor/compliance-document-form';
import { isScopedStoragePath } from '@/lib/security/storage-paths';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const FIELDS = [
  { key: 'workers_comp_expiration', label: 'Workers compensation' },
  { key: 'general_liability_expiration', label: 'General liability' },
  { key: 'auto_insurance_expiration', label: 'Auto insurance' },
  { key: 'epa_certification_expiration', label: 'EPA certification' },
  { key: 'state_license_expiration', label: 'State license' },
  { key: 'contract_expiration', label: 'Contract' },
] as const;

function statusFor(d: string | null): { tone: 'complete' | 'pending' | 'danger' | 'inactive'; label: string } {
  if (!d) return { tone: 'inactive', label: 'Not on file' };
  const t = new Date(d).getTime();
  if (t < Date.now()) return { tone: 'danger', label: 'Expired' };
  if (t < Date.now() + 30 * 86400000) return { tone: 'pending', label: 'Expiring soon' };
  return { tone: 'complete', label: 'Current' };
}

export default async function VendorCompliance({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; saved_document?: string }>;
}) {
  const me = await requireVendor();
  const sp = await searchParams;
  const supabase = await createClient();
  const [complianceResult, documentResult, requestResult] = await Promise.all([
    (supabase as any).from('vendor_compliance').select('*').eq('vendor_id', me.vendor_id).maybeSingle(),
    (supabase as any).from('documents')
      .select('id, doc_type, file_name, file_url, expires_at, uploaded_at')
      .eq('entity_type', 'vendor').eq('entity_id', me.vendor_id).order('uploaded_at', { ascending: false }),
    (supabase as any).from('document_requests')
      .select('id, name, doc_type, status, due_date, requested_at')
      .eq('vendor_id', me.vendor_id).neq('status', 'approved').order('requested_at', { ascending: false }),
  ]);
  if (complianceResult.error) throw new Error(`Could not load compliance dates: ${complianceResult.error.message}`);
  if (documentResult.error) throw new Error(`Could not load compliance documents: ${documentResult.error.message}`);
  if (requestResult.error) throw new Error(`Could not load document requests: ${requestResult.error.message}`);
  const c = complianceResult.data;
  const documents = documentResult.data ?? [];
  const requests = requestResult.data ?? [];

  const safePaths = documents
    .filter((document: any) => isScopedStoragePath(document.file_url, 'vendors', me.vendor_id))
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
    const patch: Record<string, any> = { vendor_id: me2.vendor_id, updated_at: new Date().toISOString() };
    for (const f of FIELDS) {
      const v = (formData.get(f.key) as string) || null;
      patch[f.key] = v;
    }
    const { error } = await (supabase2 as any).from('vendor_compliance').upsert(patch, { onConflict: 'vendor_id' });
    if (error) redirect(`/vendor/compliance?error=${encodeURIComponent(error.message)}`);
    revalidatePath('/vendor/compliance');
    redirect('/vendor/compliance?saved=1');
  }

  return (
    <div>
      <PageHeader
        title="Compliance"
        description="Insurance and license expiration dates. Management companies see these when assigning work."
      />

      {sp.error && <Alert tone="danger" title="Could not save:" className="mb-5">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success" className="mb-5">Compliance dates saved.</Alert>}
      {sp.saved_document && <Alert tone="success" className="mb-5">Compliance document uploaded for management review.</Alert>}

      <Surface>
        <SectionTitle title="Certificates & licenses" description="Enter the expiration date from each document." />
        <form action={save} className="space-y-1">
          <ul className="divide-y divide-gray-50">
            {FIELDS.map((f) => {
              const current = c?.[f.key] ?? null;
              const s = statusFor(current);
              return (
                <li key={f.key} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <ShieldCheck className="h-4 w-4 flex-shrink-0 text-gray-300" />
                    <span className="text-[13px] font-medium text-gray-800">{f.label}</span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 sm:w-56">
                    <Input type="date" name={f.key} defaultValue={current ?? ''} aria-label={`${f.label} expiration date`} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="pt-4">
            <Button type="submit">Save compliance dates</Button>
          </div>
        </form>
        {c?.updated_at && <p className="mt-3 text-[12px] text-gray-400">Last updated {date(c.updated_at)}</p>}
      </Surface>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Surface>
          <SectionTitle title="Upload a compliance document" description="Send insurance, licenses, contracts, or tax documents securely to management." />
          <ComplianceDocumentForm requests={requests.map((request: any) => ({ id: request.id, name: request.name, doc_type: request.doc_type }))} />
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
                      {document.expires_at ? ` · Expires ${date(document.expires_at)}` : ''}
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
