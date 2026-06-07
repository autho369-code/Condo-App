import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { notFound } from 'next/navigation'
import { money, date } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, Image } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OwnerViolationDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any
  const { id } = await params

  const { data: v } = await db.from('violations')
    .select('id, title, description, violation_type, status, date_observed, hearing_date, hearing_at, hearing_required, fine_amount, fine_assessed_at, notice_sent_at, board_decision, attachments, governing_document_reference, units!inner(unit_number)')
    .eq('id', id).eq('owner_id', me.owner_id).maybeSingle()

  if (!v) return notFound()

  const atts = Array.isArray(v.attachments) ? v.attachments : []

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/portal/violations" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" /> Back to violations</Link>

      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{v.title}</h1>
            <div className="text-sm text-gray-500 mt-1">{v.violation_type?.replace('_',' ')} — Unit {v.units?.unit_number}</div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${v.status === 'cured' || v.status === 'closed' ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700'}`}>{v.status.replace('_',' ')}</span>
        </div>

        {v.description && <p className="text-sm text-gray-600 mb-4">{v.description}</p>}

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div><span className="text-gray-500">Date Observed:</span> <span className="text-gray-900">{date(v.date_observed)}</span></div>
          <div><span className="text-gray-500">Fine:</span> <span className="text-gray-900 font-medium">{v.fine_amount ? money(v.fine_amount) : 'None'}</span></div>
          <div><span className="text-gray-500">Hearing Date:</span> <span className="text-gray-900">{v.hearing_date ? date(v.hearing_date) : v.hearing_at ? date(v.hearing_at) : 'Not scheduled'}</span></div>
          <div><span className="text-gray-500">Notice Sent:</span> <span className="text-gray-900">{v.notice_sent_at ? date(v.notice_sent_at) : '—'}</span></div>
          <div><span className="text-gray-500">Board Decision:</span> <span className="text-gray-900 capitalize">{v.board_decision ?? 'Pending'}</span></div>
          {v.governing_document_reference && <div className="col-span-2"><span className="text-gray-500">Governing Doc:</span> <span className="text-gray-900">{v.governing_document_reference}</span></div>}
        </div>

        {atts.length > 0 && (
          <div className="border-t border-gray-100 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Photos</h3>
            <div className="flex gap-3 flex-wrap">
              {atts.map((a: string, i: number) => (
                <a key={i} href={a} target="_blank" className="flex h-24 w-24 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 hover:border-blue-300 transition">
                  <Image className="h-8 w-8 text-gray-400" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
