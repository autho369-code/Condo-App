import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { StatusChip } from '@/components/operations/status-chip';
import { ArcMessageThread, type ArcMessage } from '@/components/architectural/message-thread';
import { ArcAttachments, type ArcAttachment } from '@/components/architectural/attachments';
import { postArchitecturalMessage, withdrawArchitecturalRequest } from '@/lib/rpcs/architectural';
import { ARC_STATUS_TONE, arcStatusLabel } from '@/components/architectural/status';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const CATEGORY_LABEL: Record<string, string> = {
  exterior_paint: 'Exterior paint', fence: 'Fence', landscaping: 'Landscaping',
  roof: 'Roof', addition: 'Addition', deck_patio: 'Deck / patio',
  windows_doors: 'Windows / doors', solar: 'Solar', pool: 'Pool', other: 'Other',
};

export default async function OwnerArchitecturalDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const me = await requireOwner();
  const { id } = await params;
  const { submitted, error } = await searchParams;
  const supabase = await createClient();

  const { data: req } = await (supabase as any)
    .from('architectural_requests')
    .select('id, title, description, category, status, decision_notes, decided_at, created_at, owner_id, attachments, units(unit_number)')
    .eq('id', id)
    .eq('owner_id', me.owner_id)
    .maybeSingle();

  if (!req) return notFound();

  const { data: messages } = await (supabase as any)
    .from('architectural_request_messages')
    .select('id, author_name, author_role, body, created_at')
    .eq('request_id', id)
    .order('created_at', { ascending: true });

  const isOpen = ['submitted', 'under_review', 'more_info'].includes(req.status);
  const postAction = postArchitecturalMessage.bind(null, id, 'owner', '/portal/architectural');

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/portal/architectural" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-950">
        <ArrowLeft className="h-4 w-4" /> Back to architectural requests
      </Link>

      {submitted && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your request was submitted. Now upload your supporting documents below — plans, drawings, quotes, photos — one at a time. The board or architectural committee will review and may follow up in the discussion.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span className="font-semibold">Something went wrong:</span> {error}
        </div>
      )}

      <Card>
        <CardBody>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-[-0.02em] text-gray-950">{req.title}</h1>
              <div className="mt-1 text-sm text-gray-500">
                {CATEGORY_LABEL[req.category] ?? 'Other'} — Unit {req.units?.unit_number ?? '—'} · Submitted {date(req.created_at)}
              </div>
            </div>
            <StatusChip tone={ARC_STATUS_TONE[req.status] ?? 'neutral'}>{arcStatusLabel(req.status)}</StatusChip>
          </div>

          <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{req.description}</p>

          {req.decision_notes && (
            <div className="mt-4 rounded-xl border border-gray-200/70 bg-gray-50 p-3.5">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Decision notes</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{req.decision_notes}</p>
            </div>
          )}

          {isOpen && (
            <form action={withdrawArchitecturalRequest.bind(null, id) as any} className="mt-4">
              <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                Withdraw this request
              </button>
            </form>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
        <CardBody>
          <ArcAttachments
            requestId={id}
            basePath="/portal/architectural"
            attachments={(req.attachments ?? []) as ArcAttachment[]}
            canUpload={isOpen}
            canRemove={isOpen}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Discussion</CardTitle></CardHeader>
        <CardBody>
          <ArcMessageThread
            messages={(messages ?? []) as ArcMessage[]}
            postAction={postAction as any}
            canPost={req.status !== 'withdrawn'}
            placeholder="Ask a question or add details for the reviewers…"
          />
        </CardBody>
      </Card>
    </div>
  );
}
