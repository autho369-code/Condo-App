import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewMeetingPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: associations } = await (supabase as any).from('associations').select('id, name').order('name');

  async function handleSubmit(formData: FormData) {
    'use server';
    const supabase = await createClient();
    await (supabase as any).from('meetings').insert({
      title: formData.get('title'),
      meeting_type: formData.get('meeting_type') || 'board_meeting',
      association_id: formData.get('association_id') || null,
      start_time: formData.get('start_time') || null,
      end_time: formData.get('end_time') || null,
      location: formData.get('location') || '',
      agenda: formData.get('agenda') || '',
      description: formData.get('description') || '',
      status: 'scheduled',
    });
    redirect('/meetings');
  }

  return (
    <DataWorkspace
      title="New meeting"
      description="Schedule a board meeting, committee session, or association event."
    >
      <form action={handleSubmit} className="max-w-3xl space-y-5 rounded border border-gray-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">Title
            <input name="title" required className="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" placeholder="Board meeting, committee..." />
          </label>
          <label className="text-sm font-medium text-gray-700">Type
            <select name="meeting_type" className="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
              <option value="board_meeting">Board Meeting</option>
              <option value="committee">Committee</option>
              <option value="annual">Annual Meeting</option>
              <option value="special">Special Meeting</option>
              <option value="workshop">Workshop</option>
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Association
            <select name="association_id" className="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
              <option value="">Select association</option>
              {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Location
            <input name="location" className="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" placeholder="Board room, virtual..." />
          </label>
          <label className="text-sm font-medium text-gray-700">Start
            <input name="start_time" type="datetime-local" className="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" />
          </label>
          <label className="text-sm font-medium text-gray-700">End
            <input name="end_time" type="datetime-local" className="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" />
          </label>
        </div>
        <label className="text-sm font-medium text-gray-700">Agenda
          <textarea name="agenda" rows={5} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="Agenda items..." />
        </label>
        <label className="text-sm font-medium text-gray-700">Description
          <textarea name="description" rows={3} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="Meeting description..." />
        </label>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="submit">Create meeting</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
