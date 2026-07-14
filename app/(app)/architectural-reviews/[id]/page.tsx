import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Button } from '@/components/ui/button';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
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
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: req } = await db
    .from('architectural_requests')
    .select('id, title, description, category, status, decision_notes, decided_at, created_at, attachments, associations(name), units(unit_number), owners(full_name)')
    .eq('id', id)
    .maybeSingle();

  if (!req) return notFound();

  const { data: messages } = await db
    .from('architectural_request_messages')
    .select('id, author_name, author_role, body, created_at')
    .eq('request_id', id)
    .order('created_at', { ascending: true });

  const decided = req.status === 'approved' || req.status === 'denied' || req.status === 'withdrawn';
  const decideAction = decideArchitecturalRequest.bind(null, id, '/architectural-reviews');
  const postAction = postArchitecturalMessage.bind(null, id, 'staff', '/architectural-reviews');

  return (
    <Workspace
      header={<WorkspaceHeader title={req.title} subtitle={`${req.associations?.name ?? ''} · Unit ${req.units?.unit_number ?? '—'} · ${req.owners?.full_name ?? ''}`} />}
    >
      <div className="max-w-3xl space-y-5">
        <Link href="/architectural-reviews" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-950">
          <ArrowLeft className="h-4 w-4" /> Back to queue
        </Link>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <span className="font-semibold">Something went wrong:</span> {error}
          </div>
        )}

        <Section padded>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-500">{CATEGORY_LABEL[req.category] ?? 'Other'} · Submitted {date(req.created_at)}</div>
            <StatusChip tone={STATUS_TONE[req.status] ?? 'neutral'}>{label(req.status)}</StatusChip>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{req.description}</p>
          {req.decision_notes && (
            <div className="mt-4 rounded-xl border border-gray-200/70 bg-gray-50 p-3.5">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Decision notes</div>
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
              <textarea
                name="decision_notes"
                rows={3}
                placeholder="Notes for the homeowner (conditions, reasons, next steps)…"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              />
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
          <ArcMessageThread messages={(messages ?? []) as ArcMessage[]} postAction={postAction as any} placeholder="Reply to the homeowner or note something for the board…" />
        </Section>
      </div>
    </Workspace>
  );
}
