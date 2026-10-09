import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { Badge, Alert } from '@/components/ui/shell'
import { date } from '@/lib/utils'
import { htmlToPlainText } from '@/lib/security/rich-text'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { loadOwnerRecords } from '@/lib/portal/owner-records'

export const dynamic = 'force-dynamic'

export default async function OwnerCommunicationsPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const banner = await searchParams
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any
  // Every owner record of the login (one per association).
  const ownerIds = me.owner_ids
  const requestKey = randomUUID()
  // A message goes to the managers of the chosen record's association.
  const { records, error: recordsError } = await loadOwnerRecords(db, me)

  // Every association the owner currently holds a unit in — an owner with
  // units in two communities must see both communities' announcements.
  const { data: occs, error: occError } = await db.from('occupancies').select('association_id').in('owner_id', ownerIds).eq('status', 'current')
  const assocIds = [...new Set(((occs ?? []) as { association_id: string | null }[]).map((o) => o.association_id).filter(Boolean))] as string[]

  // Messages sent by this owner (sender_id references auth.users). Only their
  // own inbound messages — not announcements/emails they sent as a board member.
  const { data: msgs, error: msgsError } = await db.from('communications_log')
    .select('subject, body, channel, status, created_at').eq('sender_id', me.auth_user_id)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false }).limit(50)

  // Announcements
  // Announcements for owners (null audience = everyone; tenant-only ones are hidden)
  let announcements: any[] = []
  let annError: { message: string } | null = null
  if (assocIds.length > 0) {
    const res = await db.from('communications_log').select('id, subject, body, created_at').in('association_id', assocIds).eq('channel', 'announcement')
      .or('announcement_audience.is.null,announcement_audience.in.(owners,both)')
      .order('created_at', { ascending: false }).limit(20)
    annError = res.error
    announcements = res.data ?? []
  }
  const loadError = occError ?? msgsError ?? annError ?? (recordsError ? { message: recordsError } : null)

  async function sendMessage(formData: FormData) {
    'use server'
    const supabase2 = await createClient()
    const me2 = await requireOwner()
    const recordId = ((formData.get('record_id') as string) || '').trim()
    if (!me2.owner_ids.includes(recordId)) redirect('/portal/communications?error=' + encodeURIComponent('Choose the association this message is about.'))
    const subject = (formData.get('subject') as string)?.trim()
    const body = (formData.get('body') as string)?.trim()
    const requestKey = (formData.get('request_key') as string)?.trim()
    if (!subject) redirect('/portal/communications?error=' + encodeURIComponent('Enter a subject before sending.'))
    if (!body) redirect('/portal/communications?error=' + encodeURIComponent('Enter a message before sending.'))

    const { error } = await (supabase2 as any).rpc('submit_owner_message', {
      p_subject: subject,
      p_body: body,
      p_idempotency_key: requestKey,
      p_owner_id: recordId,
    })
    if (error) redirect('/portal/communications?error=' + encodeURIComponent(error.message))

    revalidatePath('/portal/communications')
    redirect('/portal/communications?sent=1')
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Communications</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Send messages to management and view announcements</p>
      </div>

      {banner.error && <Alert tone="danger" title="Could not send:">{banner.error}</Alert>}
      {loadError && <Alert tone="danger" title="Could not load your messages:">{loadError.message}</Alert>}
      {banner.sent === '1' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Your message was sent to management.</div>
      )}

      {/* Send Message */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="mb-4 text-sm font-semibold text-gray-950">Send a Message</h2>
        <form action={sendMessage} className="space-y-4">
          <input type="hidden" name="request_key" value={requestKey} />
          {records.length > 1 ? (
            <label className="block"><span className="text-sm font-medium text-gray-700">Association</span><select name="record_id" required defaultValue={records[0].id} className="mt-1 block min-h-10 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">{records.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
          ) : (
            // Never a silent first-record fallback for a login with several records
            // (their list failed to load): the action then asks for the association.
            <input type="hidden" name="record_id" value={me.owner_ids.length === 1 ? me.owner_id ?? '' : ''} />
          )}
          <label className="block"><span className="text-sm font-medium text-gray-700">Subject</span><input name="subject" required minLength={2} maxLength={200} className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" /></label>
          <label className="block"><span className="text-sm font-medium text-gray-700">Message</span><textarea name="body" required minLength={2} maxLength={10000} rows={4} className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" /></label>
          <button type="submit" className="rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800">Send Message</button>
        </form>
      </div>

      {/* Announcements */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="mb-3 text-sm font-semibold text-gray-950">Announcements</h2>
        {announcements.length === 0 ? (
          <p className="text-sm text-gray-400">No announcements yet.</p>
        ) : (
          <div className="space-y-3">
            {announcements.map((a: any, i: number) => (
              <div key={a.id ?? i} className="py-2 border-b border-gray-100 last:border-0">
                <div className="text-sm font-medium text-gray-800">{a.subject}</div>
                <div className="text-xs text-gray-500">{date(a.created_at)}</div>
                {/* Stored as HTML; rendered as plain text, never as markup. */}
                {htmlToPlainText(a.body) && <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-6 text-gray-600">{htmlToPlainText(a.body)}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message History */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="mb-3 text-sm font-semibold text-gray-950">Message History</h2>
        {(msgs ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">No messages sent yet.</p>
        ) : (
          <div className="space-y-3">
            {(msgs ?? []).map((m: any, i: number) => (
              <div key={i} className="py-2 border-b border-gray-100 last:border-0 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-800">{m.subject}</div>
                  {m.body && <div className="mt-0.5 max-w-xl truncate text-xs text-gray-500">{m.body}</div>}
                  <div className="text-xs text-gray-500">{date(m.created_at)}</div>
                </div>
                <Badge status={m.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
