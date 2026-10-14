import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Button, buttonClass } from '@/components/ui/button';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Alert } from '@/components/ui/shell';
import { Field, Textarea } from '@/components/ui/input';
import { decisionNotice } from '@/lib/architectural/rules';
import { ArcMessageThread, type ArcMessage } from '@/components/architectural/message-thread';
import { postArchitecturalMessage, decideArchitecturalRequest } from '@/lib/rpcs/architectural';
import { ArcAttachments, type ArcAttachment } from '@/components/architectural/attachments';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, Tone> = {
  submitted: 'info', under_review: 'warning', more_info: 'warning',
  approved: 'success', denied: 'danger', withdrawn: 'neutral',
};
const CATEGORY_LABEL: Record<string, string> = {
  exterior_paint: 'Exterior paint', fence: 'Fence', landscaping: 'Landscaping',
  roof: 'Roof', addition: 'Addition', deck_patio: 'Deck / patio',
  windows_doors: 'Windows / doors', solar: 'Solar', pool: 'Pool', other: 'Other',
};
const label = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default async function ManagerArchitecturalDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; decided?: string; emailed?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const { error, decided: decidedStatus, emailed } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: req, error: reqError } = await db
    .from('architectural_requests')
    .select('id, title, description, category, status, decision_notes, decided_at, created_at, attachments, associations(name), units(unit_number), owners(full_name)')
    .eq('id', id)
    .maybeSingle();

  if (reqError) {
    return (
      <Workspace header={<WorkspaceHeader title="Architectural request" />}>
        <Alert tone="danger" title="Could not load this request.">{reqError.message ?? String(reqError)}</Alert>
      </Workspace>
    );
  }
  if (!req) return notFound();

  const { data: messages, error: messagesError } = await db
    .from('architectural_request_messages')
    .select('id, author_name, author_role, body, created_at')
    .eq('request_id', id)
    .order('created_at', { ascending: true });

  const decided = req.status === 'approved' || req.status === 'denied' || req.status === 'withdrawn';
  const decideAction = decideArchitecturalRequest.bind(null, id, '/architectural-reviews');
  const postAction = postArchitecturalMessage.bind(null, id, 'staff', '/architectural-reviews');

  return (
    <Workspace
      header={<WorkspaceHeader title={req.title} subtitle={`${req.associations?.name ?? ''} · Unit ${req.units?.unit_number ?? '—'} · ${req.owners?.full_name ?? ''}`} actions={<Link href={`/signatures/new?subject_type=architectural_request&subject_id=${req.id}`} className={buttonClass('secondary')}>Send decision for e-signature</Link>} />}
    >
      <div className="max-w-3xl space-y-5">
        <Link href="/architectural-reviews" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-950">
          <ArrowLeft className="h-4 w-4" /> Back to queue
        </Link>

        {decidedStatus && /^[a-z_]{1,20}$/.test(decidedStatus) && (
          <Alert tone="success">{decisionNotice(decidedStatus, emailed === '1')}</Alert>
        )}
        {error && <Alert tone="danger" title="Something went wrong.">{error}</Alert>}
        {messagesError && <Alert tone="danger" title="Could not load the discussion.">{messagesError.message ?? String(messagesError)}</Alert>}

        <Section padded>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-500">{CATEGORY_LABEL[req.category] ?? 'Other'} · Submitted {date(req.created_at)}</div>
            <StatusChip tone={STATUS_TONE[req.status] ?? 'neutral'}>{label(req.status)}</StatusChip>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{req.description}</p>
          {req.decision_notes && (
            <div className="mt-4 rounded-xl border border-line bg-gray-50 p-3.5">
              <div className="text-[13px] font-medium text-gray-500">Decision notes</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{req.decision_notes}</p>
            </div>
          )}
        </Section>

        <Section title="Documents" padded>
          <ArcAttachments
            requestId={id}
            basePath="/architectural-reviews"
            attachments={(req.attachments ?? []) as ArcAttachment[]}
            canUpload={!decided}
            canRemove={true}
          />
        </Section>

        {!decided && (
          <Section title="Record a decision" padded>
            <form action={decideAction as any} className="space-y-3">
              <Field label="Notes for the homeowner" hint="Required when denying: say why.">
                <Textarea
                  name="decision_notes"
                  rows={3}
                  placeholder="Conditions, reasons, next steps…"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" name="decision" value="approve" size="sm">Approve</Button>
                <Button type="submit" name="decision" value="deny" size="sm" variant="secondary">Deny</Button>
                <Button type="submit" name="decision" value="more_info" size="sm" variant="secondary">Request more info</Button>
                {req.status === 'submitted' && (
                  <Button type="submit" name="decision" value="review" size="sm" variant="ghost">Mark under review</Button>
                )}
              </div>
            </form>
          </Section>
        )}

        <Section title="Discussion" padded>
          <ArcMessageThread messages={(messages ?? []) as ArcMessage[]} postAction={postAction as any} placeholder="Reply to the homeowner (they see every message)…" />
        </Section>
      </div>
    </Workspace>
  );
}
