import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const BUCKET = 'association-documents';

export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: meeting }, { data: attendees }, { data: documents }] = await Promise.all([
    db.from('meetings').select('*, associations(id, name)').eq('id', id).single(),
    db.from('meeting_attendees').select('*').eq('meeting_id', id).order('created_at'),
    db.from('meeting_documents').select('*').eq('meeting_id', id).order('uploaded_at', { ascending: false }),
  ]);

  if (!meeting) notFound();

  // Board members of this association, offered as one-click sign-ins
  const { data: boardMembers } = meeting.association_id
    ? await db.from('board_members').select('id, owner_id, full_name, role').eq('association_id', meeting.association_id).eq('active', true)
    : { data: [] as any[] };
  const signedInIds = new Set((attendees ?? []).map((a: any) => a.owner_id).filter(Boolean));

  // Signed URLs for meeting documents
  const docUrlByPath = new Map<string, string>();
  if ((documents ?? []).length > 0) {
    const svc = createServiceClient() as any;
    const { data: signed } = await svc.storage.from(BUCKET)
      .createSignedUrls((documents ?? []).map((d: any) => d.storage_path), 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) docUrlByPath.set(s.path, s.signedUrl);
    }
  }

  const presentCount = (attendees ?? []).filter((a: any) => a.present).length;
  const quorum = meeting.quorum_requirement ?? null;
  const quorumMet = quorum != null ? presentCount >= quorum : null;

  async function saveMinutes(formData: FormData) {
    'use server';
    await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/meetings/${id}?error=${encodeURIComponent(msg)}`);
    const { error } = await (sb as any).from('meetings').update({
      minutes: ((formData.get('minutes') as string) || '').trim() || null,
      agenda: ((formData.get('agenda') as string) || '').trim() || null,
    }).eq('id', id);
    if (error) fail(error.message);
    revalidatePath(`/meetings/${id}`);
    redirect(`/meetings/${id}?saved=minutes`);
  }

  async function addAttendee(formData: FormData) {
    'use server';
    await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/meetings/${id}?error=${encodeURIComponent(msg)}`);
    const name = ((formData.get('attendee_name') as string) || '').trim();
    if (!name) fail('Enter an attendee name.');
    const { error } = await (sb as any).from('meeting_attendees').insert({
      meeting_id: id,
      attendee_name: name,
      attendee_role: ((formData.get('attendee_role') as string) || '').trim() || null,
      owner_id: ((formData.get('owner_id') as string) || '').trim() || null,
      present: true,
      voting_eligible: formData.get('voting_eligible') === 'on',
      check_in_time: new Date().toISOString(),
    });
    if (error) fail(error.message);
    revalidatePath(`/meetings/${id}`);
    redirect(`/meetings/${id}`);
  }

  async function removeAttendee(attendeeId: string) {
    'use server';
    await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/meetings/${id}?error=${encodeURIComponent(msg)}`);
    const { error } = await (sb as any).from('meeting_attendees').delete().eq('id', attendeeId);
    if (error) fail(error.message);
    revalidatePath(`/meetings/${id}`);
    redirect(`/meetings/${id}`);
  }

  async function addDocument(formData: FormData) {
    'use server';
    const me2 = await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/meetings/${id}?error=${encodeURIComponent(msg)}`);
    const file = formData.get('file') as File | null;
    if (!file || file.size === 0) fail('Choose a file to attach.');
    if (file!.size > 25 * 1024 * 1024) fail('Attachments are limited to 25 MB.');
    const svc = createServiceClient() as any;
    const safeName = file!.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `meetings/${id}/${Date.now()}-${safeName}`;
    const { error: upErr } = await svc.storage.from(BUCKET).upload(path, file!, { contentType: file!.type || undefined });
    if (upErr) fail(`Upload failed: ${upErr.message}`);
    const { error } = await (sb as any).from('meeting_documents').insert({
      meeting_id: id,
      name: file!.name,
      storage_path: path,
      file_size: file!.size,
      file_type: file!.type || null,
      uploaded_by: me2.auth_user_id,
      uploaded_at: new Date().toISOString(),
    });
    if (error) { await svc.storage.from(BUCKET).remove([path]); fail(error.message); }
    revalidatePath(`/meetings/${id}`);
    redirect(`/meetings/${id}?saved=document`);
  }

  return (
    <DataWorkspace
      title={meeting.title}
      description={`${meeting.meeting_type?.replace(/_/g, ' ') || 'Meeting'} · ${meeting.associations?.name || 'No association'}`}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/reports/board_packet"><Button variant="secondary" size="sm">Board packet</Button></Link>
          <Link href="/meetings"><Button variant="secondary" size="sm">Back to meetings</Button></Link>
        </div>
      }
    >
      <div className="max-w-3xl space-y-4">
        {sp.error && <Alert tone="danger" title="Action failed">{sp.error}</Alert>}
        {sp.saved === 'minutes' && <Alert tone="success" title="Meeting notes saved" />}
        {sp.saved === 'document' && <Alert tone="success" title="Document attached" />}

        <Surface padded={false} className="p-5">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div><span className="text-gray-500">Date</span><p className="font-medium text-gray-900">{meeting.start_time ? new Date(meeting.start_time).toLocaleDateString() : '—'}</p></div>
            <div><span className="text-gray-500">Time</span><p className="font-medium text-gray-900">{meeting.start_time ? new Date(meeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p></div>
            <div><span className="text-gray-500">Location</span><p className="font-medium text-gray-900">{meeting.location || '—'}</p></div>
            <div><span className="text-gray-500">Status</span><p className="font-medium capitalize text-gray-900">{meeting.status || '—'}</p></div>
          </div>
        </Surface>

        {/* ── Sign-in / quorum ── */}
        <Surface padded={false} className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-950">Sign-in &amp; quorum</h2>
            <div className="flex items-center gap-2">
              <StatusChip tone="neutral">{presentCount} present</StatusChip>
              {quorum != null && (
                <StatusChip tone={quorumMet ? 'success' : 'warning'}>
                  Quorum {quorumMet ? 'met' : 'not met'} ({presentCount}/{quorum})
                </StatusChip>
              )}
            </div>
          </div>
          {(attendees ?? []).length > 0 && (
            <ul className="mb-4 divide-y divide-gray-100">
              {(attendees ?? []).map((a: any) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-900">{a.attendee_name}</span>
                    {a.attendee_role && <span className="ml-2 text-xs capitalize text-gray-500">{a.attendee_role}</span>}
                    {a.voting_eligible && <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/15">Voting</span>}
                    <div className="text-xs text-gray-400">{a.check_in_time ? `Checked in ${new Date(a.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}</div>
                  </div>
                  <form action={removeAttendee.bind(null, a.id)}>
                    <button type="submit" className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-red-600">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {(boardMembers ?? []).filter((b: any) => !signedInIds.has(b.owner_id)).length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Quick sign-in (board)</div>
              <div className="flex flex-wrap gap-2">
                {(boardMembers ?? []).filter((b: any) => !signedInIds.has(b.owner_id)).map((b: any) => (
                  <form key={b.id} action={addAttendee}>
                    <input type="hidden" name="attendee_name" value={b.full_name} />
                    <input type="hidden" name="attendee_role" value={b.role ?? 'board'} />
                    <input type="hidden" name="owner_id" value={b.owner_id ?? ''} />
                    <input type="hidden" name="voting_eligible" value="on" />
                    <button type="submit" className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">
                      + {b.full_name} <span className="capitalize text-gray-400">({b.role})</span>
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )}
          <form action={addAttendee} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <Label htmlFor="attendee_name">Add attendee</Label>
              <Input id="attendee_name" name="attendee_name" placeholder="Name" required />
            </div>
            <div className="w-36">
              <Label htmlFor="attendee_role">Role</Label>
              <Input id="attendee_role" name="attendee_role" placeholder="e.g. owner" />
            </div>
            <label className="mb-2.5 flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="voting_eligible" className="h-4 w-4 rounded border-gray-300" /> Voting
            </label>
            <Button type="submit" variant="secondary">Sign in</Button>
          </form>
        </Surface>

        {/* ── Agenda & minutes (editable) ── */}
        <Surface padded={false} className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-950">Agenda &amp; minutes</h2>
          <form action={saveMinutes} className="space-y-4">
            <div>
              <Label htmlFor="agenda">Agenda</Label>
              <Textarea id="agenda" name="agenda" rows={4} defaultValue={meeting.agenda ?? ''} placeholder="1. Call to order&#10;2. ..." />
            </div>
            <div>
              <Label htmlFor="minutes">Minutes</Label>
              <Textarea id="minutes" name="minutes" rows={6} defaultValue={meeting.minutes ?? ''} placeholder="Record decisions, votes, and action items…" />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Save notes</Button>
            </div>
          </form>
        </Surface>

        {/* ── Documents ── */}
        <Surface padded={false} className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-950">Documents ({documents?.length ?? 0})</h2>
          {(documents ?? []).length > 0 && (
            <ul className="mb-4 divide-y divide-gray-100">
              {(documents ?? []).map((d: any) => (
                <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                  {docUrlByPath.has(d.storage_path) ? (
                    <a href={docUrlByPath.get(d.storage_path)} target="_blank" rel="noreferrer" className="truncate font-medium text-gray-900 hover:underline">{d.name}</a>
                  ) : (
                    <span className="truncate font-medium text-gray-900">{d.name}</span>
                  )}
                  <span className="text-xs text-gray-400">{date(d.uploaded_at ?? d.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
          <form action={addDocument} className="flex items-center gap-2">
            <input type="file" name="file" required className="block w-full text-xs text-gray-600 file:mr-2 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-50" />
            <Button type="submit" size="sm" variant="secondary">Attach</Button>
          </form>
        </Surface>
      </div>
    </DataWorkspace>
  );
}
