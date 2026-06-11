import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function noticeStatusDisplay(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'draft': return { label: 'Draft', tone: 'neutral' };
    case 'sent': return { label: 'Sent', tone: 'info' };
    case 'delivered': return { label: 'Delivered', tone: 'success' };
    case 'failed': return { label: 'Failed', tone: 'danger' };
    default: return { label: status, tone: 'neutral' };
  }
}

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const supabase = await createClient();
  const db = supabase as any;

  const { data: notice } = await db
    .from('notices')
    .select('*, associations(name), document_templates(name)')
    .eq('id', id)
    .single();

  if (!notice) {
    return (
      <DataWorkspace title="Notice Not Found" description="The notice you're looking for doesn't exist.">
        <div className="rounded-2xl border border-gray-200/70 bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="text-sm text-gray-500">Notice not found. It may have been deleted or archived.</p>
          <Link href="/documents?tab=notices" className="mt-3 inline-block text-sm font-medium text-gray-600 transition-colors hover:text-gray-950">
            Back to notices →
          </Link>
        </div>
      </DataWorkspace>
    );
  }

  const sd = noticeStatusDisplay(notice.status);

  return (
    <DataWorkspace
      title={notice.subject}
      description={`${(notice.notice_type ?? 'general').replace(/_/g, ' ')} notice`}
      actions={
        <Link href="/documents?tab=notices">
          <Button variant="secondary">Back to Notices</Button>
        </Link>
      }
    >
      <div className="max-w-3xl space-y-6">
        {/* Notice info */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs font-medium text-gray-500">Type</div>
              <div className="mt-0.5 capitalize text-gray-900">{(notice.notice_type ?? 'general').replace(/_/g, ' ')}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">Status</div>
              <div className="mt-0.5">
                <StatusChip tone={sd.tone}>{sd.label}</StatusChip>
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">Association</div>
              <div className="mt-0.5 text-gray-900">{notice.associations?.name ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">Channel</div>
              <div className="mt-0.5 capitalize text-gray-900">{notice.channel ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">Send To</div>
              <div className="mt-0.5 capitalize text-gray-900">{(notice.send_to ?? '—').replace(/_/g, ' ')}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">Template</div>
              <div className="mt-0.5 text-gray-900">{notice.document_templates?.name ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">Created</div>
              <div className="mt-0.5 text-gray-900">{date(notice.created_at)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">Sent</div>
              <div className="mt-0.5 text-gray-900">{notice.sent_at ? date(notice.sent_at) : 'Not yet sent'}</div>
            </div>
          </div>
        </div>

        {/* Notice body */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-950">Notice Content</h2>
          {notice.body ? (
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-6">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed">{notice.body}</pre>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No content available.</p>
          )}
        </div>
      </div>
    </DataWorkspace>
  );
}
