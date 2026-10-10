import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { CheckCircle2, Upload } from 'lucide-react';
import { Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { consumePublicRateLimit } from '@/lib/server/rate-limit';
import { hashSigningToken, isWellFormedToken } from '@/lib/signatures/crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { companyAddressOf, companyAddressRedirect, noticeQuery, tokenMatchesAddress } from '@/lib/tenant/token-company';
import { vendorDocExpires, vendorDocLabel } from '@/lib/vendors/document-requests';
import { submitVendorUpload } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Upload requested document', robots: { index: false, follow: false } };

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">{children}</div>;
}
const card = 'rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]';

export default async function VendorUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const invalid = (
    <Shell>
      <div className={`${card} text-center`}>
        <h1 className="break-words font-display text-[24px] font-bold leading-[1.15] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[28px]">This upload link isn&apos;t valid</h1>
        <p className="mt-2 text-sm text-gray-500">It may have expired or been replaced by a newer email. Ask the property manager to send a new link.</p>
      </div>
    </Shell>
  );
  if (!isWellFormedToken(token)) return invalid;

  const svc = createServiceClient() as any;
  const h = await headers();
  const limit = await consumePublicRateLimit(svc, h, { scope: 'vendor_upload_view', windowSeconds: 600, maxRequests: 60 });
  if (!limit.allowed) return <Shell><Alert tone="warning">Too many requests. Please wait a few minutes and reload.</Alert></Shell>;

  const { data: r } = await svc.rpc('vendor_request_session', { p_token_hash: hashSigningToken(token) });
  if (!r || !tokenMatchesAddress(h, r.portfolio_id)) return invalid;
  const move = companyAddressRedirect(h, await companyAddressOf(svc, r.portfolio_id), `/vendor-upload/${token}${noticeQuery(sp)}`);
  if (move) redirect(move);

  const label = vendorDocLabel(r.doc_type);
  const open = ['requested', 'in_progress', 'rejected'].includes(r.status);
  const needsDate = vendorDocExpires(r.doc_type);

  return (
    <Shell>
      <div className="space-y-5">
        <div>
          <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-gray-400">{r.company_name}</div>
          <h1 className="mt-1 break-words font-display text-[24px] font-bold leading-[1.15] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[28px]">{label}</h1>
          <p className="mt-1 text-sm text-gray-500">Requested from {r.vendor_name}{r.due_date ? ` · please send by ${r.due_date}` : ''}</p>
        </div>

        {sp.done && <Alert tone="success"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />{sp.done}</span></Alert>}
        {sp.error && <Alert tone="danger">{sp.error}</Alert>}
        {r.status === 'rejected' && r.review_note && <Alert tone="warning">The previous upload was not accepted: {r.review_note}</Alert>}
        {r.description && <div className={`${card} whitespace-pre-wrap text-sm text-gray-700`}>{r.description}</div>}

        {open ? (
          <form action={submitVendorUpload} className={`${card} space-y-4`}>
            <input type="hidden" name="token" value={token} />
            <Field label="File (PDF, image or Word, up to 10 MB)" htmlFor="file">
              <input id="file" name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.heic,.webp,.doc,.docx"
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-950 file:px-3.5 file:py-2 file:text-[13px] file:font-medium file:text-white" />
            </Field>
            {needsDate && (
              <Field label="Expiration date on the document" htmlFor="expires_on">
                <Input id="expires_on" name="expires_on" type="date" required />
              </Field>
            )}
            <Button type="submit" className="w-full sm:w-auto"><Upload className="h-4 w-4" /> Send document</Button>
            <p className="text-[13px] text-gray-500">The file goes only to {r.company_name}. This link works only for this request.</p>
          </form>
        ) : !sp.done ? (
          <div className={`${card} text-sm text-gray-600`}>
            {r.status === 'approved' ? 'This document was received and approved. Nothing else is needed.' : 'We have your document and it is being reviewed. Nothing else is needed right now.'}
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
