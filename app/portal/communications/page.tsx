import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { Badge } from '@/components/ui/shell'
import { date } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function OwnerCommunicationsPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const banner = await searchParams
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any
  const ownerId = me.owner_id
  const requestKey = randomUUID()

  // Get association for announcements
  const { data: occs } = await db.from('occupancies').select('association_id').eq('owner_id', ownerId).limit(1)
  const assocId = occs?.[0]?.association_id

  // Messages sent by this owner (sender_id references auth.users)
  const { data: msgs } = await db.from('communications_log')
    .select('subject, body, channel, status, created_at').eq('sender_id', me.auth_user_id)
    .order('created_at', { ascending: false }).limit(50)

  // Announcements
  let announcements: any[] = []
  if (assocId) {
    try {
      const { data: ann } = await db.from('communications_log').select('subject, created_at').eq('association_id', assocId).eq('channel', 'announcement').order('created_at', { ascending: false }).limit(20)
      announcements = ann ?? []
    } catch {}
  }

  async function sendMessage(formData: FormData) {
    'use server'
    const supabase2 = await createClient()
    await requireOwner()
    const subject = (formData.get('subject') as string)?.trim()
    const body = (formData.get('body') as string)?.trim()
    const requestKey = (formData.get('request_key') as string)?.trim()
    if (!subject) redirect('/portal/communications?error=' + encodeURIComponent('Enter a subject before sending.'))
    if (!body) redirect('/portal/communications?error=' + encodeURIComponent('Enter a message before sending.'))

    const { error } = await (supabase2 as any).rpc('submit_owner_message', {
      p_subject: subject,
      p_body: body,
      p_idempotency_key: requestKey,
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

      {banner.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{banner.error}</div>
      )}
      {banner.sent === '1' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Your message was sent to management.</div>
      )}

      {/* Send Message */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="mb-4 text-sm font-semibold text-gray-950">Send a Message</h2>
        <form action={sendMessage} className="space-y-4">
          <input type="hidden" name="request_key" value={requestKey} />
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
              <div key={i} className="py-2 border-b border-gray-100 last:border-0">
                <div className="text-sm text-gray-800">{a.subject}</div>
                <div className="text-xs text-gray-500">{date(a.created_at)}</div>
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
