import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { clientAddress, consumePublicRateLimit } from '@/lib/server/rate-limit';
import { SIGNATURE_BUCKET, hashSigningToken, isWellFormedToken } from '@/lib/signatures/crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { declineDocument, signDocument } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Review and sign', robots: { index: false, follow: false } };

const fmt = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">{children}</div>;
}

export default async function SignPage({
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
      <div className="rounded-2xl border border-gray-200/70 bg-white p-8 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h1 className="text-xl font-semibold text-gray-950">This signing link isn&apos;t valid</h1>
        <p className="mt-2 text-sm text-gray-500">It may have been replaced by a newer email, or the request was cancelled. Contact the sender for a new link.</p>
      </div>
    </Shell>
  );
  if (!isWellFormedToken(token)) return invalid;

  const h = await headers();
  const service = createServiceClient() as any;
  const limit = await consumePublicRateLimit(service, h, { scope: 'esign_view', windowSeconds: 600, maxRequests: 60 });
  if (!limit.allowed) {
    return <Shell><Alert tone="warning">Too many requests. Please wait a few minutes and reload.</Alert></Shell>;
  }

  const { data: session } = await service.rpc('signature_session', {
    p_token_hash: hashSigningToken(token),
    p_ip: clientAddress(h),
    p_user_agent: (h.get('user-agent') ?? 'unknown').slice(0, 400),
  });
  if (!session) return invalid;

  const { request: r, signer: me, signers, blocked } = session as any;
  let pdfUrl: string | null = null;
  if (r.document_kind === 'pdf' && r.document_path) {
    const { data } = await service.storage.from(SIGNATURE_BUCKET).createSignedUrl(r.document_path, 900);
    pdfUrl = data?.signedUrl ?? null;
  }
  const canSign = r.status === 'sent' && !blocked && ['pending', 'viewed'].includes(me.status);

  return (
    <Shell>
      <div className="space-y-5">
        <div>
          <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-gray-400">{[r.company, r.association].filter(Boolean).join(' · ')}</div>
          <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-gray-950">{r.title}</h1>
          <p className="mt-1 text-sm text-gray-500">Requested of {me.name}{me.role_label ? `, ${me.role_label}` : ''}</p>
        </div>

        {sp.error && <Alert tone="danger">{sp.error}</Alert>}
        {sp.done && <Alert tone="success">{sp.done}</Alert>}
        {r.status === 'completed' && <Alert tone="success" title="Completed.">Everyone signed on {fmt(r.completed_at)}.</Alert>}
        {r.status === 'voided' && <Alert tone="warning">The sender cancelled this request.</Alert>}
        {r.status === 'declined' && <Alert tone="warning">This request was declined and is closed.</Alert>}
        {blocked === 'expired' && <Alert tone="warning">This request expired on {fmt(r.expires_at)}. Ask the sender for a new one.</Alert>}
        {blocked === 'waiting' && <Alert tone="info">Another signer must sign before you. You&apos;ll get an email when it&apos;s your turn.</Alert>}
        {r.message && <div className="rounded-xl border border-gray-200/70 bg-white px-4 py-3 text-sm text-gray-700">{r.message}</div>}

        <section className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-900"><FileText className="h-4 w-4 text-gray-400" />Document</span>
            {pdfUrl && <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-gray-600 hover:text-gray-950">Open PDF</a>}
          </div>
          {r.document_kind === 'text' ? (
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap px-5 py-4 text-[14px] leading-7 text-gray-800">{r.body_text}</div>
          ) : pdfUrl ? (
            <iframe src={pdfUrl} title={r.title} className="h-[70vh] w-full" />
          ) : (
            <p className="px-5 py-6 text-sm text-gray-500">The document could not be loaded. Contact the sender.</p>
          )}
          <div className="border-t border-gray-100 px-5 py-2 text-[11px] text-gray-400">Fingerprint (SHA-256): <span className="font-mono break-all">{r.document_sha256}</span></div>
        </section>

        <section className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h2 className="text-sm font-semibold text-gray-900">Signers</h2>
          <ul className="mt-2 divide-y divide-gray-100">
            {(signers ?? []).map((sg: any, i: number) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-gray-800">{sg.name}{sg.role_label ? <span className="text-gray-400"> · {sg.role_label}</span> : null}</span>
                <span className="text-[12px] text-gray-500">{sg.status === 'signed' ? `Signed ${fmt(sg.signed_at)}` : sg.status === 'declined' ? 'Declined' : 'Waiting'}</span>
              </li>
            ))}
          </ul>
        </section>

        {me.status === 'signed' && (
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200/70 bg-white p-5 text-sm text-gray-700">
            <CheckCircle2 className="h-5 w-5 text-gray-900" />You signed as “{me.signature_name}” on {fmt(me.signed_at)}.
          </div>
        )}

        {canSign && (
          <section className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <form action={signDocument} className="space-y-4">
              <input type="hidden" name="token" value={token} />
              <div className="rounded-xl bg-gray-50 p-4 text-[13px] leading-5 text-gray-600">
                <div className="mb-1 flex items-center gap-1.5 font-medium text-gray-900"><ShieldCheck className="h-4 w-4" />Consent to electronic records and signatures</div>
                By checking the box and signing, you agree that your typed name is your electronic signature, has the same effect as a handwritten signature, and that you may receive this document electronically. You can ask the sender for a paper copy at no charge, and you may decline instead of signing.
              </div>
              <label className="flex min-h-10 items-start gap-2 text-sm text-gray-800">
                <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                I have reviewed the document and agree to sign electronically.
              </label>
              <div>
                <label htmlFor="signature_name" className="mb-1.5 block text-[13px] font-medium text-gray-700">Type your full name to sign</label>
                <Input id="signature_name" name="signature_name" required minLength={2} maxLength={120} defaultValue="" placeholder={me.name} autoComplete="name" />
              </div>
              <Button type="submit" className="w-full sm:w-auto">Sign document</Button>
            </form>
            <details className="mt-5 border-t border-gray-100 pt-4">
              <summary className="cursor-pointer text-[13px] font-medium text-gray-500">Decline to sign</summary>
              <form action={declineDocument} className="mt-3 space-y-2">
                <input type="hidden" name="token" value={token} />
                <Textarea name="reason" required minLength={5} maxLength={1000} rows={2} placeholder="Let the sender know why" />
                <Button type="submit" variant="secondary">Decline</Button>
              </form>
            </details>
          </section>
        )}
      </div>
    </Shell>
  );
}
