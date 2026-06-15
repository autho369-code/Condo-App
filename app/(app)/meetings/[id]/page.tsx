import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/shell';
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
      actions={<Link href="/meetings"><Button variant="secondary">Back to meetings</Button></Link>}
    >
      <div className="max-w-3xl space-y-4">
        <Surface padded={false} className="p-5">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div><span className="text-gray-500">Date</span><p className="font-medium text-gray-900">{meeting.start_time ? new Date(meeting.start_time).toLocaleDateString() : '—'}</p></div>
            <div><span className="text-gray-500">Time</span><p className="font-medium text-gray-900">{meeting.start_time ? new Date(meeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p></div>
            <div><span className="text-gray-500">Location</span><p className="font-medium text-gray-900">{meeting.location || '—'}</p></div>
            <div><span className="text-gray-500">Status</span><p className="font-medium capitalize text-gray-900">{meeting.status || '—'}</p></div>
          </div>
        </Surface>
        {meeting.agenda && (
          <Surface padded={false} className="p-5">
            <h2 className="mb-2 text-sm font-semibold text-gray-950">Agenda</h2>
            <p className="whitespace-pre-wrap text-sm text-gray-600">{meeting.agenda}</p>
          </Surface>
        )}
        {meeting.minutes && (
          <Surface padded={false} className="p-5">
            <h2 className="mb-2 text-sm font-semibold text-gray-950">Minutes</h2>
            <p className="whitespace-pre-wrap text-sm text-gray-600">{meeting.minutes}</p>
          </Surface>
        )}
      </div>
    </DataWorkspace>
  );
}
