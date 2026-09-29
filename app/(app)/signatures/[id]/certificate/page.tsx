import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/ui/print-button';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { SUBJECT_LABEL, fmtDateTime } from '../../status';

export const dynamic = 'force-dynamic';

export default async function SignatureCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const { id } = await params;
  const db = (await createClient()) as any;
  const { data: r } = await db.from('signature_requests').select('*, associations(name)').eq('id', id).maybeSingle();
  if (!r || r.status !== 'completed') notFound();
  const [{ data: signers }, { data: events }] = await Promise.all([
    db.from('signature_signers').select('id, sign_order, name, email, role_label, viewed_at, signed_at, signature_name, signed_ip, signed_user_agent').eq('request_id', id).order('sign_order'),
    db.from('signature_events').select('signer_id, event_type, ip, created_at').eq('request_id', id).order('created_at'),
  ]);

  return (
    <div className="min-h-full bg-[#f6f7f9] px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl justify-between print:hidden">
        <Link href={`/signatures/${id}`}><Button variant="secondary">Back</Button></Link>
        <PrintButton label="Print / save as PDF" />
      </div>
      <article className="mx-auto max-w-3xl rounded-2xl border border-gray-200/70 bg-white p-8 shadow-[0_1px_2px_rgba(16,24,40,0.04)] print:border-0 print:shadow-none">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Certificate of completion</div>
        <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-gray-950">{r.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{[me.portfolio?.company_name, r.associations?.name, SUBJECT_LABEL[r.subject_type]].filter(Boolean).join(' · ')}</p>

        <dl className="mt-6 grid grid-cols-[160px_1fr] gap-y-2 text-sm">
          <dt className="text-gray-500">Envelope ID</dt><dd className="font-mono text-[12px] text-gray-900">{r.id}</dd>
          <dt className="text-gray-500">Document SHA-256</dt><dd className="break-all font-mono text-[12px] text-gray-900">{r.document_sha256}</dd>
          <dt className="text-gray-500">Document type</dt><dd className="text-gray-900">{r.document_kind === 'pdf' ? 'PDF upload' : 'Text'}</dd>
          <dt className="text-gray-500">Sent</dt><dd className="text-gray-900">{fmtDateTime(r.sent_at)}</dd>
          <dt className="text-gray-500">Completed</dt><dd className="text-gray-900">{fmtDateTime(r.completed_at)}</dd>
          <dt className="text-gray-500">Signing order</dt><dd className="text-gray-900">{r.sequential ? 'Sequential' : 'Any order'}</dd>
        </dl>

        <h2 className="mt-8 text-sm font-semibold text-gray-950">Signers</h2>
        <table className="mt-2 w-full text-left text-[13px]">
          <thead className="border-b border-gray-200 text-[11px] uppercase tracking-wide text-gray-500">
            <tr><th className="py-2 pr-3 font-semibold">Signer</th><th className="py-2 pr-3 font-semibold">Signature</th><th className="py-2 pr-3 font-semibold">Signed</th><th className="py-2 font-semibold">IP address</th></tr>
          </thead>
          <tbody>
            {(signers ?? []).map((s: any) => (
              <tr key={s.id} className="border-b border-gray-100 align-top">
                <td className="py-2 pr-3"><div className="text-gray-900">{s.name}</div><div className="text-gray-500">{s.email}{s.role_label ? ` · ${s.role_label}` : ''}</div></td>
                <td className="py-2 pr-3 italic text-gray-900">{s.signature_name}</td>
                <td className="py-2 pr-3 text-gray-700">{fmtDateTime(s.signed_at)}</td>
                <td className="py-2 font-mono text-[12px] text-gray-700">{s.signed_ip}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-8 text-sm font-semibold text-gray-950">Event history</h2>
        <ol className="mt-2 space-y-1 text-[12px] text-gray-600">
          {(events ?? []).map((e: any, i: number) => (
            <li key={i}>{fmtDateTime(e.created_at)} — {e.event_type.replace(/_/g, ' ')}{e.signer_id ? ` · ${(signers ?? []).find((s: any) => s.id === e.signer_id)?.name ?? 'signer'}` : ''}{e.ip ? ` · ${e.ip}` : ''}</li>
          ))}
        </ol>

        <p className="mt-8 border-t border-gray-100 pt-4 text-[11px] leading-4 text-gray-400">
          Each signer received a unique link, affirmatively consented to conduct business electronically, and adopted a typed signature.
          The document fingerprint above was verified against the stored document at every signature; any change to the document would have blocked signing.
        </p>
      </article>
    </div>
  );
}
