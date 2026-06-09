import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: meeting } = await db
    .from('meetings')
    .select('*, associations(name)')
    .eq('id', id)
    .single();

  if (!meeting) notFound();

  return (
    <DataWorkspace
      title={meeting.title}
      description={`${meeting.meeting_type?.replace(/_/g, ' ') || 'Meeting'} · ${meeting.associations?.name || 'No association'}`}
      actions={<Link href="/meetings" className="text-sm font-medium text-gray-600 hover:text-gray-950">Back to meetings</Link>}
    >
      <div className="max-w-3xl space-y-4">
        <div className="rounded border border-gray-200 bg-white p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Date</span><p className="font-medium">{meeting.start_time ? new Date(meeting.start_time).toLocaleDateString() : '—'}</p></div>
            <div><span className="text-gray-500">Time</span><p className="font-medium">{meeting.start_time ? new Date(meeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p></div>
            <div><span className="text-gray-500">Location</span><p className="font-medium">{meeting.location || '—'}</p></div>
            <div><span className="text-gray-500">Status</span><p className="font-medium capitalize">{meeting.status || '—'}</p></div>
          </div>
        </div>
        {meeting.agenda && (
          <div className="rounded border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Agenda</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{meeting.agenda}</p>
          </div>
        )}
        {meeting.description && (
          <div className="rounded border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Description</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{meeting.description}</p>
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
