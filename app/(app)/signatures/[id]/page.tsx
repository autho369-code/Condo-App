import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { remindSigner, voidSignatureRequest } from '@/lib/rpcs/esignatures';
import { SIGNATURE_BUCKET } from '@/lib/signatures/crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { RequestStatus, SignerStatus, SUBJECT_LABEL, fmtDateTime } from '../status';

export const dynamic = 'force-dynamic';

const EVENT_LABEL: Record<string, string> = {
  sent: 'Sent for signature', viewed: 'Opened', signed: 'Signed', declined: 'Declined', voided: 'Voided',
  completed: 'All parties signed', reminder_sent: 'Reminder sent (new link issued)', sent_to_next_signer: 'Sent to next signer',
};

export default async function SignatureRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const db = (await createClient()) as any;

  // RLS scopes this read to the caller's portfolio; only then is the file signed.
  const { data: r } = await db.from('signature_requests').select('*, associations(name)').eq('id', id).maybeSingle();
  if (!r) notFound();
  const [{ data: signers }, { data: events }] = await Promise.all([
    db.from('signature_signers').select('id, sign_order, name, email, role_label, status, viewed_at, signed_at, signature_name, signed_ip, declined_at, decline_reason, last_sent_at').eq('request_id', id).order('sign_order'),
    db.from('signature_events').select('id, signer_id, event_type, ip, user_agent, detail, created_at').eq('request_id', id).order('created_at'),
  ]);
  const signerName = new Map<string, string>((signers ?? []).map((s: any) => [s.id, s.name]));
  let pdfUrl: string | null = null;
  if (r.document_kind === 'pdf' && r.document_path) {
    const { data } = await (createServiceClient() as any).storage.from(SIGNATURE_BUCKET).createSignedUrl(r.document_path, 900);
    pdfUrl = data?.signedUrl ?? null;
  }
  const subjectHref = r.subject_id
    ? r.subject_type === 'management_agreement' ? `/owners/management-agreements/${r.subject_id}`
    : r.subject_type === 'architectural_request' ? `/architectural-reviews/${r.subject_id}`
    : r.subject_type === 'year_end_package' ? `/accounting/year-end/${r.subject_id}` : null
    : null;

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={<><Link href="/signatures" className="transition-colors hover:text-gray-700">E-signatures</Link>{' · '}{SUBJECT_LABEL[r.subject_type] ?? 'Document'}</>}
          title={r.title}
          subtitle={<span className="inline-flex flex-wrap items-center gap-2"><RequestStatus status={r.status} expiresAt={r.expires_at} /><span>{r.associations?.name ?? 'Company-level'}</span>{subjectHref && <Link href={subjectHref} className="font-medium text-gray-600 hover:text-gray-950">Open linked record</Link>}</span>}
          actions={r.status === 'completed' ? <Link href={`/signatures/${id}/certificate`}><Button>Certificate of completion</Button></Link> : undefined}
        />
      }
    >
      {sp.error && <Alert tone="danger" title="Could not complete that:" className="mb-5">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success" className="mb-5">{sp.saved}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div>
          <Section title="Signers" subtitle={r.sequential ? 'Signing in order' : 'Any order'}>
            <ul className="divide-y divide-line">
              {(signers ?? []).map((s: any) => (
                <li key={s.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">{s.sign_order}. {s.name}{s.role_label ? <span className="font-normal text-gray-500"> · {s.role_label}</span> : null}</div>
                    <div className="truncate text-[12px] text-gray-500">{s.email}</div>
                    {s.status === 'signed' && <div className="text-[12px] text-gray-500">Signed as “{s.signature_name}” · {fmtDateTime(s.signed_at)} · IP {s.signed_ip}</div>}
                    {s.status === 'declined' && <div className="text-[12px] text-gray-500">Declined {fmtDateTime(s.declined_at)} — {s.decline_reason}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <SignerStatus status={s.status} />
                    {r.status === 'sent' && ['pending', 'viewed'].includes(s.status) && (
                      <form action={remindSigner}>
                        <input type="hidden" name="request_id" value={id} />
                        <input type="hidden" name="signer_id" value={s.id} />
                        <Button type="submit" variant="secondary" size="sm">Remind</Button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Document" actions={pdfUrl ? <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-gray-500 hover:text-gray-900">Open PDF</a> : undefined}>
            {r.document_kind === 'text'
              ? <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap px-5 py-4 text-[14px] leading-7 text-gray-800">{r.body_text}</div>
              : pdfUrl ? <iframe src={pdfUrl} title={r.title} className="h-[60vh] w-full" /> : <p className="px-5 py-4 text-sm text-gray-500">The file could not be loaded.</p>}
            <div className="border-t border-gray-100 px-5 py-2 text-[12.5px] text-gray-400">SHA-256 <span className="break-all font-mono">{r.document_sha256}</span></div>
          </Section>
        </div>

        <div>
          <Section title="Audit trail" padded>
            <ol className="space-y-3">
              {(events ?? []).map((e: any) => (
                <li key={e.id} className="text-sm">
                  <div className="text-gray-900">{EVENT_LABEL[e.event_type] ?? e.event_type}{e.signer_id ? ` — ${signerName.get(e.signer_id) ?? 'signer'}` : ''}</div>
                  <div className="text-[12px] text-gray-400">{fmtDateTime(e.created_at)}{e.ip ? ` · IP ${e.ip}` : ''}</div>
                </li>
              ))}
            </ol>
          </Section>
          <Section title="Details" padded>
            <dl className="grid grid-cols-[90px_1fr] gap-y-2 text-sm">
              <dt className="text-gray-500">Sent</dt><dd className="text-gray-900">{fmtDateTime(r.sent_at)}</dd>
              <dt className="text-gray-500">Expires</dt><dd className="text-gray-900">{fmtDateTime(r.expires_at)}</dd>
              {r.completed_at && <><dt className="text-gray-500">Completed</dt><dd className="text-gray-900">{fmtDateTime(r.completed_at)}</dd></>}
              {r.voided_at && <><dt className="text-gray-500">Voided</dt><dd className="text-gray-900">{fmtDateTime(r.voided_at)} — {r.void_reason}</dd></>}
            </dl>
          </Section>
          {r.status === 'sent' && (
            <Section title="Void request" padded>
              <form action={voidSignatureRequest} className="space-y-2">
                <input type="hidden" name="id" value={id} />
                <Input name="reason" required minLength={5} maxLength={500} placeholder="Reason (required)" aria-label="Void reason" />
                <Button type="submit" variant="danger" className="w-full">Void — disable all links</Button>
              </form>
            </Section>
          )}
        </div>
      </div>
    </Workspace>
  );
}
