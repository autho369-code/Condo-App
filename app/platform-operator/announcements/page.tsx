import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requirePlatformOperator } from '@/lib/auth/me'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Alert } from '@/components/ui/shell'
import { date } from '@/lib/utils'
import { Megaphone } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
const RETURN = '/platform-operator/announcements'

async function sendAnnouncement(formData: FormData) {
  'use server'
  const { requirePlatformOperator: requireOp } = await import('@/lib/auth/me')
  const me = await requireOp()

  const subject = ((formData.get('subject') as string) || '').trim()
  const message = ((formData.get('message') as string) || '').trim()
  const audience = (formData.get('audience') as string) || 'company_admins'
  const portfolioId = (formData.get('portfolio_id') as string) || ''

  if (!subject || !message) {
    redirect(`${RETURN}?error=${encodeURIComponent('Subject and message are required.')}`)
  }

  const { createServiceClient: svcClient } = await import('@/lib/supabase/server')
  const svc = svcClient() as any

  let query = svc
    .from('profiles')
    .select('email, full_name, portfolio_id')
    .not('email', 'is', null)
  if (audience === 'company_admins') query = query.eq('hoa_role', 'company_admin')
  else query = query.in('hoa_role', ['company_admin', 'manager'])
  if (portfolioId) query = query.eq('portfolio_id', portfolioId)

  const { data: recipients, error } = await query
  if (error) redirect(`${RETURN}?error=${encodeURIComponent(error.message)}`)
  if (!recipients || recipients.length === 0) {
    redirect(`${RETURN}?error=${encodeURIComponent('No recipients matched that audience.')}`)
  }

  const html = `<p>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '</p><p>')}</p><p style="color:#6b7280;font-size:12px">— The Portier369 platform team</p>`
  const rows = recipients.map((r: any) => ({
    to_email: r.email,
    to_name: r.full_name,
    subject: `[Portier369] ${subject}`,
    body: html,
    status: 'pending',
    from_address: 'hello@portier369.com',
    from_name: 'Portier369 Platform',
    portfolio_id: r.portfolio_id,
    sent_by: me.auth_user_id,
  }))

  const { error: insertErr } = await svc.from('email_queue').insert(rows)
  if (insertErr) redirect(`${RETURN}?error=${encodeURIComponent(insertErr.message)}`)

  await svc.from('audit_logs').insert({
    entity_type: 'platform_announcement',
    entity_id: null,
    action: 'announcement_sent',
    actor_id: me.auth_user_id,
    actor_email: me.profile?.email ?? null,
    changes: { subject, audience, portfolio_id: portfolioId || 'all', recipients: rows.length },
  })

  redirect(`${RETURN}?sent=${rows.length}`)
}

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>
}) {
  const sp = await searchParams
  await requirePlatformOperator()
  const supabase = await createClient()
  const db = supabase as any

  const [{ data: portfolios }, { data: recent }] = await Promise.all([
    db.from('portfolios').select('id, company_name').is('archived_at', null).order('company_name'),
    db.from('email_queue')
      .select('subject, to_email, status, created_at')
      .eq('from_name', 'Portier369 Platform')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Platform Announcements</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Broadcast maintenance notices, release notes, and product updates to your customers — delivered by email
        </p>
      </div>

      {sp.sent && <Alert tone="success" title="Announcement queued">{`Queued for ${sp.sent} recipient${sp.sent === '1' ? '' : 's'} — delivery runs through the standard email pipeline.`}</Alert>}
      {sp.error && <Alert tone="danger" title="Could not send announcement">{sp.error}</Alert>}

      <div className={`${card} p-5`}>
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-950">
            <Megaphone className="h-4.5 w-4.5 text-white" />
          </div>
          <h2 className="text-sm font-semibold text-gray-950">New Announcement</h2>
        </div>
        <form action={sendAnnouncement as any} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="audience">Audience</Label>
              <select id="audience" name="audience" className="mt-1 block h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
                <option value="company_admins">Company admins only</option>
                <option value="admins_and_managers">Company admins + managers</option>
              </select>
            </div>
            <div>
              <Label htmlFor="portfolio_id">Company</Label>
              <select id="portfolio_id" name="portfolio_id" className="mt-1 block h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
                <option value="">All companies</option>
                {(portfolios ?? []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.company_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" required placeholder="e.g., Scheduled maintenance Saturday 2–4 AM CT" />
          </div>
          <div>
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              name="message"
              required
              rows={6}
              placeholder="What your customers need to know…"
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
          </div>
          <Button type="submit" className="gap-2"><Megaphone className="h-4 w-4" /> Queue announcement</Button>
        </form>
      </div>

      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Recent Announcements</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Subject</th>
                <th className="px-5 py-2.5 text-left font-medium">Recipient</th>
                <th className="px-5 py-2.5 text-left font-medium">Status</th>
                <th className="px-5 py-2.5 text-left font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {(recent ?? []).length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">No platform announcements sent yet.</td></tr>
              ) : (
                (recent ?? []).map((r: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="max-w-sm truncate px-5 py-3 font-medium text-gray-900">{r.subject}</td>
                    <td className="px-5 py-3 text-[13px] text-gray-700">{r.to_email}</td>
                    <td className="px-5 py-3 text-[13px] capitalize text-gray-700">{r.status}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-700">{date(r.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
