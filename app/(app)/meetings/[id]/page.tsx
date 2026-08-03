import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Field, Input, Label, Select, Textarea } from '@/components/ui/input';
import { Alert, EmptyState, Surface } from '@/components/ui/shell';
import { requireWorkspaceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';
import {
  addAgendaItem,
  addMeetingActionItem,
  addMeetingAttendee,
  addMeetingDocument,
  moveAgendaItem,
  removeAgendaItem,
  removeMeetingActionItem,
  removeMeetingAttendee,
  removeMeetingDocument,
  saveMeetingNotes,
  updateMeetingActionStatus,
} from './actions';

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  financial: 'Financial',
  operations: 'Operations',
  governance: 'Governance',
  compliance: 'Compliance',
  old_business: 'Old business',
  new_business: 'New business',
  executive_session: 'Executive session',
};

const ACTION_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  blocked: 'Blocked',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const ACTION_TONES: Record<string, Tone> = {
  open: 'info',
  in_progress: 'warning',
  blocked: 'danger',
  completed: 'success',
  cancelled: 'neutral',
};

function successMessage(value?: string) {
  if (value === 'notes') return 'Meeting notes saved.';
  if (value === 'attendee') return 'Attendance updated.';
  if (value === 'agenda') return 'Structured agenda updated.';
  if (value === 'document') return 'Meeting documents updated.';
  if (value === 'action') return 'Follow-up actions updated.';
  return null;
}

export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireWorkspaceStaff();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [
    { data: meeting },
    { data: attendees },
    { data: documents },
    { data: agendaItems },
    { data: actionItems },
  ] = await Promise.all([
    db.from('meetings').select('*, associations(id, name)').eq('id', id).single(),
    db.from('meeting_attendees').select('*').eq('meeting_id', id).order('created_at'),
    db.from('meeting_documents').select('*').eq('meeting_id', id).order('uploaded_at', { ascending: false }),
    db.from('agenda_items').select('*').eq('meeting_id', id).order('sort_order').order('created_at'),
    db.from('meeting_action_items').select('*').eq('meeting_id', id).order('status').order('due_date', { nullsFirst: false }),
  ]);

  if (!meeting) notFound();

  const { data: boardMembers } = meeting.association_id
    ? await db.from('board_members').select('id, owner_id, full_name, role')
      .eq('association_id', meeting.association_id).eq('active', true)
    : { data: [] as any[] };
  const signedInIds = new Set((attendees ?? []).map((attendee: any) => attendee.owner_id).filter(Boolean));
  const presentCount = (attendees ?? []).filter((attendee: any) => attendee.present).length;
  const quorum = meeting.quorum_requirement ?? null;
  const quorumMet = quorum != null ? presentCount >= quorum : null;
  const agendaEditable = meeting.status !== 'completed' && meeting.status !== 'cancelled';
  const saved = successMessage(sp.saved);

  return (
    <DataWorkspace
      title={meeting.title}
      description={`${meeting.meeting_type?.replace(/_/g, ' ') || 'Meeting'} · ${meeting.associations?.name || 'No association'}`}
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/board/meetings/${id}`}><Button variant="secondary" size="sm">Preview board packet</Button></Link>
          <Link href="/reports/monthly-package"><Button variant="secondary" size="sm">Financial package</Button></Link>
          <Link href="/meetings"><Button variant="secondary" size="sm">Back to meetings</Button></Link>
        </div>
      }
    >
      <div className="max-w-5xl space-y-4">
        {sp.error && <Alert tone="danger" title="Action failed">{sp.error}</Alert>}
        {saved && <Alert tone="success" title={saved} />}

        <Surface className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><span className="text-gray-500">Date</span><p className="font-medium text-gray-900">{meeting.start_time ? new Date(meeting.start_time).toLocaleDateString() : '—'}</p></div>
          <div><span className="text-gray-500">Time</span><p className="font-medium text-gray-900">{meeting.start_time ? new Date(meeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p></div>
          <div><span className="text-gray-500">Location</span><p className="font-medium text-gray-900">{meeting.location || '—'}</p></div>
          <div><span className="text-gray-500">Status</span><p className="font-medium capitalize text-gray-900">{meeting.status?.replace(/_/g, ' ') || '—'}</p></div>
        </Surface>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
          <div className="space-y-4">
            <Surface>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-950">Structured agenda</h2>
                  <p className="mt-1 text-xs leading-5 text-gray-500">Build the ordered agenda shown to the board and included in its PDF packet.</p>
                </div>
                <StatusChip tone="neutral">{agendaItems?.length ?? 0} items</StatusChip>
              </div>

              {(agendaItems ?? []).length === 0 ? (
                <EmptyState title="No agenda items" description={agendaEditable ? 'Add the first item below.' : 'This meeting was finalized without a structured agenda.'} />
              ) : (
                <ol className="divide-y divide-gray-100 border-y border-gray-100">
                  {(agendaItems ?? []).map((item: any, index: number) => (
                    <li key={item.id} className="flex items-start gap-3 py-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">{item.title}</span>
                          <StatusChip tone="neutral">{CATEGORY_LABELS[item.category] ?? item.category}</StatusChip>
                        </div>
                        {item.description && <p className="mt-1 text-sm leading-5 text-gray-600">{item.description}</p>}
                        <p className="mt-1 text-xs text-gray-400">
                          {[item.duration_minutes ? `${item.duration_minutes} min` : null, item.presenter ? `Presenter: ${item.presenter}` : null].filter(Boolean).join(' · ') || 'No duration or presenter set'}
                        </p>
                      </div>
                      {agendaEditable && (
                        <div className="flex shrink-0 items-center gap-1">
                          <form action={moveAgendaItem.bind(null, id, item.id, 'up')}><Button type="submit" variant="ghost" size="sm" disabled={index === 0} aria-label={`Move ${item.title} up`}>↑</Button></form>
                          <form action={moveAgendaItem.bind(null, id, item.id, 'down')}><Button type="submit" variant="ghost" size="sm" disabled={index === (agendaItems?.length ?? 0) - 1} aria-label={`Move ${item.title} down`}>↓</Button></form>
                          <form action={removeAgendaItem.bind(null, id, item.id)}><Button type="submit" variant="ghost" size="sm" aria-label={`Remove ${item.title}`}>Remove</Button></form>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {agendaEditable ? (
                <form action={addAgendaItem.bind(null, id)} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Agenda item" required><Input name="title" required maxLength={255} placeholder="Treasurer’s report" /></Field>
                    <Field label="Category"><Select name="category" defaultValue="general">{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
                    <Field label="Presenter"><Input name="presenter" maxLength={200} placeholder="Name or office" /></Field>
                    <Field label="Duration (minutes)"><Input name="duration_minutes" type="number" min={1} max={480} placeholder="15" /></Field>
                  </div>
                  <Field label="Description"><Textarea name="description" rows={2} maxLength={5000} placeholder="Purpose, supporting material, or requested decision" /></Field>
                  <Button type="submit" size="sm">Add agenda item</Button>
                </form>
              ) : (
                <Alert tone="info" title="Agenda finalized">Completed and cancelled meetings preserve their structured agenda as read-only evidence.</Alert>
              )}
            </Surface>

            <Surface>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-950">Follow-up actions</h2>
                  <p className="mt-1 text-xs leading-5 text-gray-500">Track ownership and completion after the meeting closes.</p>
                </div>
                <StatusChip tone="neutral">{actionItems?.length ?? 0} actions</StatusChip>
              </div>
              {(actionItems ?? []).length === 0 ? (
                <EmptyState title="No follow-up actions" description="Add a decision, commitment, or next step below." />
              ) : (
                <ul className="divide-y divide-gray-100 border-y border-gray-100">
                  {(actionItems ?? []).map((item: any) => (
                    <li key={item.id} className="py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900">{item.title}</span>
                            <StatusChip tone={ACTION_TONES[item.status] ?? 'neutral'}>{ACTION_LABELS[item.status] ?? item.status}</StatusChip>
                          </div>
                          {item.description && <p className="mt-1 text-sm leading-5 text-gray-600">{item.description}</p>}
                          <p className="mt-1 text-xs text-gray-400">{[item.assigned_to ? `Owner: ${item.assigned_to}` : null, item.due_date ? `Due ${date(item.due_date)}` : null].filter(Boolean).join(' · ') || 'Unassigned · no due date'}</p>
                        </div>
                        <div className="flex flex-wrap items-end gap-2">
                          <form action={updateMeetingActionStatus.bind(null, id, item.id)} className="flex items-center gap-2">
                            <Select name="status" defaultValue={item.status} aria-label={`Status for ${item.title}`} className="w-36">
                              {Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </Select>
                            <Button type="submit" variant="secondary" size="sm">Update</Button>
                          </form>
                          <form action={removeMeetingActionItem.bind(null, id, item.id)}><Button type="submit" variant="ghost" size="sm">Remove</Button></form>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <form action={addMeetingActionItem.bind(null, id)} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Follow-up action" required className="sm:col-span-2"><Input name="title" required maxLength={255} placeholder="Obtain revised roofing proposal" /></Field>
                  <Field label="Due date"><Input name="due_date" type="date" /></Field>
                  <Field label="Responsible person" className="sm:col-span-3"><Input name="assigned_to" maxLength={200} placeholder="Manager, board officer, committee, or vendor" /></Field>
                </div>
                <Field label="Details"><Textarea name="description" rows={2} maxLength={5000} placeholder="Completion criteria or supporting context" /></Field>
                <Button type="submit" size="sm">Add follow-up</Button>
              </form>
            </Surface>

            <Surface>
              <h2 className="mb-3 text-sm font-semibold text-gray-950">Agenda summary &amp; minutes</h2>
              <form action={saveMeetingNotes.bind(null, id)} className="space-y-4">
                <Field label="Agenda summary" hint="Optional narrative summary; structured agenda items remain the board packet source.">
                  <Textarea id="agenda" name="agenda" rows={4} defaultValue={meeting.agenda ?? ''} placeholder="Call to order, key decisions, executive session…" />
                </Field>
                <Field label="Minutes"><Textarea id="minutes" name="minutes" rows={8} defaultValue={meeting.minutes ?? ''} placeholder="Record motions, votes, decisions, recusals, and action items…" /></Field>
                <div className="flex justify-end"><Button type="submit">Save notes</Button></div>
              </form>
            </Surface>
          </div>

          <div className="space-y-4">
            <Surface>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-950">Sign-in &amp; quorum</h2>
                <div className="flex items-center gap-2">
                  <StatusChip tone="neutral">{presentCount} present</StatusChip>
                  {quorum != null && <StatusChip tone={quorumMet ? 'success' : 'warning'}>{quorumMet ? 'Quorum met' : `Need ${Math.max(0, quorum - presentCount)} more`}</StatusChip>}
                </div>
              </div>
              {(attendees ?? []).length > 0 && (
                <ul className="mb-4 divide-y divide-gray-100">
                  {(attendees ?? []).map((attendee: any) => (
                    <li key={attendee.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-900">{attendee.attendee_name}</span>
                        {attendee.attendee_role && <span className="ml-2 text-xs capitalize text-gray-500">{attendee.attendee_role}</span>}
                        {attendee.voting_eligible && <span className="ml-2 text-[11px] font-medium text-blue-700">Voting</span>}
                        <div className="text-xs text-gray-400">{attendee.check_in_time ? `Checked in ${new Date(attendee.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}</div>
                      </div>
                      <form action={removeMeetingAttendee.bind(null, id, attendee.id)}><Button type="submit" variant="ghost" size="sm">Remove</Button></form>
                    </li>
                  ))}
                </ul>
              )}
              {(boardMembers ?? []).filter((member: any) => !signedInIds.has(member.owner_id)).length > 0 && (
                <div className="mb-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Quick sign-in · board</div>
                  <div className="flex flex-wrap gap-2">
                    {(boardMembers ?? []).filter((member: any) => !signedInIds.has(member.owner_id)).map((member: any) => (
                      <form key={member.id} action={addMeetingAttendee.bind(null, id)}>
                        <input type="hidden" name="attendee_name" value={member.full_name} />
                        <input type="hidden" name="attendee_role" value={member.role ?? 'board'} />
                        <input type="hidden" name="owner_id" value={member.owner_id ?? ''} />
                        <input type="hidden" name="voting_eligible" value="on" />
                        <Button type="submit" variant="secondary" size="sm">+ {member.full_name}</Button>
                      </form>
                    ))}
                  </div>
                </div>
              )}
              <form action={addMeetingAttendee.bind(null, id)} className="space-y-3 border-t border-gray-100 pt-4">
                <Field label="Attendee name" required><Input name="attendee_name" required placeholder="Name" /></Field>
                <Field label="Role"><Input name="attendee_role" placeholder="Owner, guest, counsel…" /></Field>
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="voting_eligible" className="h-4 w-4 rounded border-gray-300" /> Voting eligible</label>
                <Button type="submit" variant="secondary" size="sm">Sign in</Button>
              </form>
            </Surface>

            <Surface>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-950">Meeting documents</h2>
                  <p className="mt-1 text-xs leading-5 text-gray-500">Private, short-lived downloads for authorized staff and board members.</p>
                </div>
                <StatusChip tone="neutral">{documents?.length ?? 0}</StatusChip>
              </div>
              {(documents ?? []).length > 0 ? (
                <ul className="mb-4 divide-y divide-gray-100">
                  {(documents ?? []).map((document: any) => (
                    <li key={document.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <a href={`/api/meeting-documents/${document.id}`} target="_blank" rel="noreferrer" className="block truncate font-medium text-gray-900 hover:underline">{document.name}</a>
                        <span className="text-xs text-gray-400">{document.file_size ? `${(document.file_size / 1024).toFixed(1)} KB · ` : ''}{date(document.uploaded_at ?? document.created_at)}</span>
                      </div>
                      <form action={removeMeetingDocument.bind(null, id, document.id)}><Button type="submit" variant="ghost" size="sm">Remove</Button></form>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="No meeting documents" description="Attach the notice, proposals, exhibits, or signed minutes below." />}
              <form action={addMeetingDocument.bind(null, id)} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                <div>
                  <Label htmlFor="meeting-document">Attach document</Label>
                  <Input id="meeting-document" type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.txt,.csv" className="h-auto py-2" />
                  <p className="mt-1 text-xs text-gray-400">PDF, image, Office, text, or CSV · 25 MB maximum</p>
                </div>
                <Button type="submit" variant="secondary" size="sm">Attach document</Button>
              </form>
            </Surface>
          </div>
        </div>
      </div>
    </DataWorkspace>
  );
}
