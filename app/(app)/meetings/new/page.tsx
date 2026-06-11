import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Surface } from '@/components/ui/shell';
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
    const { error } = await (supabase as any).from('meetings').insert({
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
    if (error) {
      redirect(`/meetings/new?error=${encodeURIComponent(error.message)}`);
    }
    redirect('/meetings');
  }

  return (
    <DataWorkspace
      title="New meeting"
      description="Schedule a board meeting, committee session, or association event."
    >
      <Surface className="max-w-3xl">
        <form action={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title">
              <Input name="title" required placeholder="Board meeting, committee..." />
            </Field>
            <Field label="Type">
              <Select name="meeting_type">
                <option value="board_meeting">Board Meeting</option>
                <option value="committee">Committee</option>
                <option value="annual">Annual Meeting</option>
                <option value="special">Special Meeting</option>
                <option value="workshop">Workshop</option>
              </Select>
            </Field>
            <Field label="Association">
              <Select name="association_id">
                <option value="">Select association</option>
                {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Location">
              <Input name="location" placeholder="Board room, virtual..." />
            </Field>
            <Field label="Start">
              <Input name="start_time" type="datetime-local" />
            </Field>
            <Field label="End">
              <Input name="end_time" type="datetime-local" />
            </Field>
          </div>
          <Field label="Agenda">
            <Textarea name="agenda" rows={5} placeholder="Agenda items..." />
          </Field>
          <Field label="Description">
            <Textarea name="description" rows={3} placeholder="Meeting description..." />
          </Field>
          <div className="border-t border-gray-100 pt-4">
            <Button type="submit">Create meeting</Button>
          </div>
        </form>
      </Surface>
    </DataWorkspace>
  );
}
