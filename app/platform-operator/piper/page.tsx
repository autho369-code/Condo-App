import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { requirePlatformOperator } from '@/lib/auth/me'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/input'
import { Alert } from '@/components/ui/shell'
import { StatusChip } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'
import { Phone, BookOpen, Pin } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
const input =
  'mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
const RETURN = '/platform-operator/piper'
const CATEGORIES = ['pricing', 'product', 'sales', 'company', 'support', 'general'] as const

async function saveKnowledge(formData: FormData) {
  'use server'
  await (await import('@/lib/auth/me')).requirePlatformOperator()
  const id = (formData.get('id') as string) || ''
  const title = ((formData.get('title') as string) || '').trim()
  const body = ((formData.get('body') as string) || '').trim()
  const category = (formData.get('category') as string) || 'general'
  const pinned = formData.get('pinned') === 'on'
  if (!title || !body) redirect(`${RETURN}?error=${encodeURIComponent('Title and content are required.')}`)

  const svc = createServiceClient() as any
  const row = { title, body, category, pinned, updated_at: new Date().toISOString() }
  const { error } = id
    ? await svc.from('receptionist_knowledge').update(row).eq('id', id)
    : await svc.from('receptionist_knowledge').insert({ ...row, active: true })
  if (error) redirect(`${RETURN}?error=${encodeURIComponent(error.message)}`)
  revalidatePath(RETURN)
  redirect(`${RETURN}?saved=1`)
}

async function toggleKnowledge(formData: FormData) {
  'use server'
  await (await import('@/lib/auth/me')).requirePlatformOperator()
  const id = (formData.get('id') as string) || ''
  const field = (formData.get('field') as string) || ''
  const value = formData.get('value') === '1'
  if (!id || !['active', 'pinned'].includes(field)) redirect(`${RETURN}?error=${encodeURIComponent('Invalid toggle.')}`)
  const svc = createServiceClient() as any
  const { error } = await svc.from('receptionist_knowledge').update({ [field]: value }).eq('id', id)
  if (error) redirect(`${RETURN}?error=${encodeURIComponent(error.message)}`)
  revalidatePath(RETURN)
}

async function markHandled(formData: FormData) {
  'use server'
  await (await import('@/lib/auth/me')).requirePlatformOperator()
  const id = (formData.get('id') as string) || ''
  if (!id) redirect(RETURN)
  const svc = createServiceClient() as any
  await svc.from('phone_messages').update({ handled: true }).eq('id', id)
  revalidatePath(RETURN)
}

export default async function PiperPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; edit?: string }> }) {
  const sp = await searchParams
  await requirePlatformOperator()
  const svc = createServiceClient() as any

  const [{ data: knowledge }, { data: messages }] = await Promise.all([
    svc.from('receptionist_knowledge').select('*').order('pinned', { ascending: false }).order('category').order('updated_at', { ascending: false }),
    svc.from('phone_messages').select('*').order('created_at', { ascending: false }).limit(50),
  ])
  const rows = knowledge ?? []
  const editing = sp.edit ? rows.find((k: any) => k.id === sp.edit) : null
  const msgs = messages ?? []
  const unhandled = msgs.filter((m: any) => !m.handled)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Piper — AI Phone Receptionist</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Answers +1 (872) 269-8818 around the clock. Teach her here: <strong>pinned</strong> entries are in her head on
          every call; everything else she looks up when asked. Changes apply to the very next call — no redeploy.
        </p>
      </div>

      {sp.error && <Alert tone="danger" title="Something went wrong:">{sp.error}</Alert>}
      {sp.saved === '1' && <Alert tone="success" title="Saved — Piper knows this on her next call." />}

      {/* Teach form */}
      <div className={card + ' p-6'}>
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-950">
          <BookOpen className="h-4 w-4 text-gray-400" /> {editing ? 'Edit knowledge' : 'Teach Piper something'}
        </h2>
        <p className="mb-4 text-sm text-gray-500">Write it the way she should say it on the phone — plain sentences, prices spelled out.</p>
        <form action={saveKnowledge} className="space-y-4">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block sm:col-span-2"><span className="text-sm font-medium text-gray-700">Title</span>
              <input name="title" required defaultValue={editing?.title ?? ''} className={input} placeholder="e.g. Reserve study support" /></label>
            <label className="block"><span className="text-sm font-medium text-gray-700">Category</span>
              <select name="category" defaultValue={editing?.category ?? 'product'} className={input}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select></label>
          </div>
          <label className="block"><span className="text-sm font-medium text-gray-700">What Piper should know / say</span>
            <textarea name="body" required rows={5} defaultValue={editing?.body ?? ''} className={input}
              placeholder="Full detail, phone-friendly. This is exactly the material she answers from." /></label>
          <label className="flex items-center gap-2.5 text-sm text-gray-700">
            <input type="checkbox" name="pinned" defaultChecked={editing?.pinned ?? false} className="h-4 w-4 rounded border-gray-300 text-gray-950 focus:ring-blue-500/30" />
            Pinned — always in Piper&apos;s head (use for pricing and core facts; keep under ~10 pinned entries)
          </label>
          <div className="flex gap-2">
            <Button type="submit">{editing ? 'Save changes' : 'Teach Piper'}</Button>
            {editing && <a href={RETURN} className="inline-flex items-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</a>}
          </div>
        </form>
      </div>

      {/* Knowledge list */}
      <div className={card + ' p-6'}>
        <h2 className="mb-4 text-sm font-semibold text-gray-950">What Piper knows ({rows.filter((k: any) => k.active).length} active)</h2>
        <ul className="divide-y divide-gray-100">
          {rows.map((k: any) => (
            <li key={k.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 max-w-2xl">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  {k.pinned && <Pin className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />}
                  <span className={k.active ? '' : 'line-through text-gray-400'}>{k.title}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">{k.category}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-gray-500">{k.body}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2 text-xs">
                <a href={`${RETURN}?edit=${k.id}`} className="font-medium text-gray-600 hover:text-gray-950 hover:underline">Edit</a>
                <form action={toggleKnowledge}>
                  <input type="hidden" name="id" value={k.id} />
                  <input type="hidden" name="field" value="pinned" />
                  <input type="hidden" name="value" value={k.pinned ? '0' : '1'} />
                  <button type="submit" className="font-medium text-gray-600 hover:text-gray-950 hover:underline">{k.pinned ? 'Unpin' : 'Pin'}</button>
                </form>
                <form action={toggleKnowledge}>
                  <input type="hidden" name="id" value={k.id} />
                  <input type="hidden" name="field" value="active" />
                  <input type="hidden" name="value" value={k.active ? '0' : '1'} />
                  <button type="submit" className={'font-medium hover:underline ' + (k.active ? 'text-red-600' : 'text-emerald-700')}>
                    {k.active ? 'Disable' : 'Enable'}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Call log / leads */}
      <div className={card + ' p-6'}>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-950">
          <Phone className="h-4 w-4 text-gray-400" /> Messages &amp; leads Piper took
          {unhandled.length > 0 && <StatusChip tone="warning">{unhandled.length} new</StatusChip>}
        </h2>
        {msgs.length === 0 ? (
          <p className="py-4 text-sm text-gray-400">No calls captured yet. Try her: +1 (872) 269-8818.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {msgs.map((m: any) => (
              <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 max-w-2xl">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    {m.urgency === 'lead' && <StatusChip tone="success">Lead</StatusChip>}
                    {m.urgency === 'urgent' && <StatusChip tone="danger">Urgent</StatusChip>}
                    {m.caller_name || 'Unknown caller'}
                    {m.company ? <span className="text-gray-500">— {m.company}</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{m.message}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {[m.callback_number, m.email, m.doors ? `${m.doors} doors` : null, m.current_software ? `on ${m.current_software}` : null, date(m.created_at)]
                      .filter(Boolean).join(' · ')}
                  </p>
                </div>
                {!m.handled ? (
                  <form action={markHandled}>
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" className="text-xs font-medium text-gray-600 hover:text-gray-950 hover:underline">Mark handled</button>
                  </form>
                ) : (
                  <span className="text-xs text-gray-300">handled</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
