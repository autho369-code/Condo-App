'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { date, money } from '@/lib/utils'
import { Calendar, MapPin, Clock, FileText, Plus, Trash2, Upload, Download, ChevronRight, Loader2 } from 'lucide-react'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

interface Meeting {
  id: string
  title: string
  meeting_type: string
  start_time: string | null
  location: string | null
  status: string
  agenda: string | null
  minutes: string | null
  created_at: string
  association_id: string
  associations?: { name: string } | null
}

interface AgendaItem {
  id: string
  meeting_id: string
  title: string
  description: string | null
  sort_order: number
  duration_minutes: number | null
  presenter: string | null
  category: string
}

interface MeetingDoc {
  id: string
  meeting_id: string
  name: string
  storage_path: string
  file_size: number | null
  file_type: string | null
  uploaded_at: string
}

interface FinancialSnapshot {
  total_receivables: number
  total_payables: number
  delinquency_count: number
  bank_balance: number
  current_month_income: number
  current_month_expenses: number
  net_income: number
  generated_at: string
}

const typeLabel: Record<string, string> = {
  board_meeting: 'Board Meeting',
  annual_meeting: 'Annual Meeting',
  special_meeting: 'Special Meeting',
  committee_meeting: 'Committee Meeting',
  vendor_meeting: 'Vendor Meeting',
  internal: 'Internal',
}

const categoryLabel: Record<string, string> = {
  general: 'General',
  financial: 'Financial',
  operations: 'Operations',
  governance: 'Governance',
  compliance: 'Compliance',
  old_business: 'Old Business',
  new_business: 'New Business',
  executive_session: 'Executive Session',
}

const statusBadge = (s: string) => {
  const m: Record<string, string> = {
    scheduled: 'bg-blue-50 text-blue-700 ring-blue-600/15',
    in_progress: 'bg-amber-50 text-amber-700 ring-amber-600/15',
    completed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    cancelled: 'bg-red-50 text-red-700 ring-red-600/15',
  }
  return m[s] ?? 'bg-gray-100 text-gray-600 ring-gray-500/15'
}

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 placeholder-gray-400 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'

export default function MeetingDetailClient() {
  const params = useParams()
  const meetingId = params.id as string
  const supabase = createClient()

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([])
  const [documents, setDocuments] = useState<MeetingDoc[]>([])
  const [financials, setFinancials] = useState<FinancialSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isStaff, setIsStaff] = useState(false)

  // New agenda item form
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('general')
  const [newDuration, setNewDuration] = useState('')
  const [newPresenter, setNewPresenter] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const loadData = useCallback(async () => {
    if (!meetingId) return
    const db = supabase as any

    // Load meeting
    const { data: m } = await db
      .from('meetings')
      .select('*, associations(name)')
      .eq('id', meetingId)
      .single()
    if (m) setMeeting(m as Meeting)

    // Load agenda items
    const { data: a } = await db
      .from('agenda_items')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('sort_order', { ascending: true })
    if (a) setAgendaItems(a as AgendaItem[])

    // Load documents
    const { data: d } = await db
      .from('meeting_documents')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('uploaded_at', { ascending: false })
    if (d) setDocuments(d as MeetingDoc[])

    // Load financial snapshot
    if (m?.association_id) {
      const { data: f } = await db.rpc('get_meeting_financial_snapshot', {
        p_association_id: m.association_id,
      })
      if (f) setFinancials(f as FinancialSnapshot)
    }

    // Check if user is staff
    const { data: meData } = await supabase.auth.getUser()
    if (meData.user) {
      const { data: staffCheck } = await db.rpc('me')
      // Board members can view, but only staff/operators can edit
      if (staffCheck) {
        const s = Array.isArray(staffCheck) ? staffCheck[0] : staffCheck
        setIsStaff(s?.is_full_access_staff || s?.is_platform_operator || s?.is_staff || false)
      }
    }

    setLoading(false)
  }, [meetingId, supabase])

  useEffect(() => { loadData() }, [loadData])

  const addAgendaItem = async () => {
    if (!newTitle.trim()) return
    const db = supabase as any
    const { data, error } = await db
      .from('agenda_items')
      .insert({
        meeting_id: meetingId,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        category: newCategory,
        duration_minutes: newDuration ? parseInt(newDuration) : null,
        presenter: newPresenter.trim() || null,
        sort_order: agendaItems.length,
      })
      .select()
      .single()
    if (!error && data) {
      setAgendaItems([...agendaItems, data as AgendaItem])
      setNewTitle('')
      setNewDesc('')
      setNewDuration('')
      setNewPresenter('')
    }
  }

  const removeAgendaItem = async (id: string) => {
    const db = supabase as any
    const { error } = await db.from('agenda_items').delete().eq('id', id)
    if (!error) {
      setAgendaItems(agendaItems.filter((i: AgendaItem) => i.id !== id))
    }
  }

  const moveItem = async (id: string, direction: 'up' | 'down') => {
    const idx = agendaItems.findIndex((i: AgendaItem) => i.id === id)
    if (idx === -1) return
    const target = direction === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= agendaItems.length) return

    const reordered = [...agendaItems]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(target, 0, moved)
    setAgendaItems(reordered)

    const ids = reordered.map((i: AgendaItem) => i.id)
    const db = supabase as any
    await db.rpc('reorder_agenda_items', {
      p_meeting_id: meetingId,
      p_item_ids: ids,
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !meeting) return
    setUploading(true)
    const db = supabase as any

    const path = `meetings/${meetingId}/${Date.now()}_${file.name}`
    const { error: uploadErr } = await supabase.storage
      .from('association-documents')
      .upload(path, file)

    if (uploadErr) {
      console.error('Upload failed:', uploadErr)
      setUploading(false)
      return
    }

    const { data: doc, error: insertErr } = await db
      .from('meeting_documents')
      .insert({
        meeting_id: meetingId,
        name: file.name,
        storage_path: path,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .select()
      .single()

    if (!insertErr && doc) {
      setDocuments([doc as MeetingDoc, ...documents])
    }
    setUploading(false)
  }

  const generatePDF = async () => {
    if (!meeting) return
    setGenerating(true)

    try {
      const doc = new jsPDF({ unit: 'pt', format: 'letter' })
      const pageW = doc.internal.pageSize.getWidth()
      let y = 50

      // Header
      doc.setFontSize(22)
      doc.setTextColor(30, 58, 95)
      doc.setFont('helvetica', 'bold')
      doc.text(meeting.title, 50, y)
      y += 30

      doc.setFontSize(11)
      doc.setTextColor(107, 114, 128)
      doc.setFont('helvetica', 'normal')
      doc.text(`Meeting Type: ${typeLabel[meeting.meeting_type] ?? meeting.meeting_type}`, 50, y)
      y += 18
      doc.text(`Date: ${date(meeting.start_time, 'long')}`, 50, y)
      y += 18
      if (meeting.location) {
        doc.text(`Location: ${meeting.location}`, 50, y)
        y += 18
      }
      doc.text(`Status: ${meeting.status.replace('_', ' ')}`, 50, y)
      y += 30

      // Financial Snapshot
      if (financials) {
        doc.setFontSize(16)
        doc.setTextColor(30, 58, 95)
        doc.setFont('helvetica', 'bold')
        doc.text('Financial Snapshot', 50, y)
        y += 24

        const finRows = [
          ['Total Receivables', money(financials.total_receivables)],
          ['Total Payables', money(financials.total_payables)],
          ['Delinquent Owners', `${financials.delinquency_count}`],
          ['Bank Balance', money(financials.bank_balance)],
          ['Current Month Income', money(financials.current_month_income)],
          ['Current Month Expenses', money(financials.current_month_expenses)],
          ['Net Income (MTD)', money(financials.net_income)],
        ]

        ;(doc as any).autoTable({
          startY: y,
          head: [['Metric', 'Amount']],
          body: finRows,
          theme: 'striped',
          headStyles: { fillColor: [30, 58, 95], fontStyle: 'bold' },
          margin: { left: 50 },
          tableWidth: pageW - 100,
        })
        y = (doc as any).lastAutoTable.finalY + 24
      }

      // Agenda
      doc.setFontSize(16)
      doc.setTextColor(30, 58, 95)
      doc.setFont('helvetica', 'bold')
      doc.text('Agenda', 50, y)
      y += 24

      if (agendaItems.length > 0) {
        const agendaRows = agendaItems.map((item: AgendaItem) => [
          `${item.sort_order + 1}. ${item.title}`,
          categoryLabel[item.category] ?? item.category,
          item.duration_minutes ? `${item.duration_minutes} min` : '',
          item.presenter ?? '',
        ])
        ;(doc as any).autoTable({
          startY: y,
          head: [['Item', 'Category', 'Duration', 'Presenter']],
          body: agendaRows,
          theme: 'striped',
          headStyles: { fillColor: [30, 58, 95], fontStyle: 'bold' },
          margin: { left: 50 },
          tableWidth: pageW - 100,
        })
        y = (doc as any).lastAutoTable.finalY + 24
      } else {
        doc.setFontSize(11)
        doc.setTextColor(156, 163, 175)
        doc.text('No agenda items.', 50, y)
        y += 24
      }

      // Attached Documents
      if (documents.length > 0) {
        // Check page space
        if (y > 600) {
          doc.addPage()
          y = 50
        }
        doc.setFontSize(16)
        doc.setTextColor(30, 58, 95)
        doc.setFont('helvetica', 'bold')
        doc.text('Attached Documents', 50, y)
        y += 24

        const docRows = documents.map((d: MeetingDoc) => [
          d.name,
          d.file_type ?? '',
          d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : '',
        ])
        ;(doc as any).autoTable({
          startY: y,
          head: [['Document', 'Type', 'Size']],
          body: docRows,
          theme: 'striped',
          headStyles: { fillColor: [30, 58, 95], fontStyle: 'bold' },
          margin: { left: 50 },
          tableWidth: pageW - 100,
        })
      }

      // Footer
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(9)
        doc.setTextColor(156, 163, 175)
        doc.text(`Portier369 — Board Meeting Packet — ${date(new Date().toISOString(), 'long')}`, 50, doc.internal.pageSize.getHeight() - 30)
      }

      doc.save(`${meeting.title.replace(/[^a-zA-Z0-9]/g, '_')}_Packet.pdf`)
    } catch (err) {
      console.error('PDF generation failed:', err)
    }
    setGenerating(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className={`${card} p-12 text-center`}>
        <p className="text-sm text-gray-500">Meeting not found.</p>
      </div>
    )
  }

  const canEdit = isStaff && meeting.status !== 'completed' && meeting.status !== 'cancelled'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">{meeting.title}</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">
            {meeting.associations?.name && `${meeting.associations.name} — `}
            {typeLabel[meeting.meeting_type] ?? meeting.meeting_type}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium capitalize ring-1 ring-inset ${statusBadge(meeting.status)}`}>
            {meeting.status.replace('_', ' ')}
          </span>
          <button
            onClick={generatePDF}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {generating ? 'Generating...' : 'Generate Packet'}
          </button>
        </div>
      </div>

      {/* Meeting Info Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Calendar, label: 'Date & Time', value: date(meeting.start_time, 'long') },
          { icon: MapPin, label: 'Location', value: meeting.location || 'Not set' },
          { icon: Clock, label: 'Created', value: date(meeting.created_at, 'long') },
        ].map((c: any) => (
          <div key={c.label} className={`${card} px-4 py-3.5`}>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">
              <c.icon className="h-3.5 w-3.5 text-gray-400" />
              {c.label}
            </div>
            <div className="mt-1.5 text-sm text-gray-900">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main: Agenda + Financials */}
        <div className="space-y-4 lg:col-span-2">
          {/* Financial Snapshot */}
          {financials && (
            <div className={`${card} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-950">
                  <FileText className="h-4 w-4 text-gray-400" />
                  Financial Snapshot
                </h2>
                <span className="text-xs text-gray-400">As of {date(financials.generated_at, 'long')}</span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-4">
                {[
                  { label: 'Receivables', value: money(financials.total_receivables), cls: 'text-gray-950' },
                  { label: 'Payables', value: money(financials.total_payables), cls: 'text-gray-950' },
                  { label: 'Bank Balance', value: money(financials.bank_balance), cls: 'text-emerald-700' },
                  { label: 'Delinquent', value: `${financials.delinquency_count}`, cls: 'text-red-700' },
                  { label: 'Income (MTD)', value: money(financials.current_month_income), cls: 'text-gray-950' },
                  { label: 'Expenses (MTD)', value: money(financials.current_month_expenses), cls: 'text-gray-950' },
                  { label: 'Net Income', value: money(financials.net_income), cls: financials.net_income >= 0 ? 'text-emerald-700' : 'text-red-700' },
                  { label: 'Generated', value: date(financials.generated_at, 'short'), cls: 'text-gray-700' },
                ].map((s: any) => (
                  <div key={s.label} className="bg-white px-4 py-3">
                    <div className="text-xs text-gray-500">{s.label}</div>
                    <div className={`mt-0.5 text-sm font-semibold tabular-nums ${s.cls}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agenda */}
          <div className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-950">
                <FileText className="h-4 w-4 text-gray-400" />
                Agenda
              </h2>
              <span className="text-xs text-gray-400">{agendaItems.length} item{agendaItems.length !== 1 ? 's' : ''}</span>
            </div>

            {agendaItems.length === 0 && !canEdit ? (
              <div className="px-5 py-12 text-center text-sm text-gray-500">No agenda items yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {agendaItems.map((item: AgendaItem, idx: number) => (
                  <div key={item.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/60">
                    {canEdit && (
                      <div className="flex flex-col gap-0.5 pt-0.5">
                        <button onClick={() => moveItem(item.id, 'up')} disabled={idx === 0} className="text-gray-400 hover:text-gray-950 disabled:opacity-30">
                          <ChevronRight className="h-3 w-3 rotate-[-90deg]" />
                        </button>
                        <button onClick={() => moveItem(item.id, 'down')} disabled={idx === agendaItems.length - 1} className="text-gray-400 hover:text-gray-950 disabled:opacity-30">
                          <ChevronRight className="h-3 w-3 rotate-90" />
                        </button>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {!canEdit && (
                          <span className="text-xs font-medium text-gray-400">{idx + 1}.</span>
                        )}
                        <span className="text-sm font-medium text-gray-900">{item.title}</span>
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium capitalize text-gray-600 ring-1 ring-inset ring-gray-500/15">
                          {categoryLabel[item.category] ?? item.category}
                        </span>
                      </div>
                      {item.description && (
                        <p className="mt-1 text-xs text-gray-500">{item.description}</p>
                      )}
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
                        {item.duration_minutes && <span>{item.duration_minutes} min</span>}
                        {item.presenter && <span>Presented by: {item.presenter}</span>}
                      </div>
                    </div>
                    {canEdit && (
                      <button onClick={() => removeAgendaItem(item.id)} className="text-gray-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add agenda item (staff only for non-completed meetings) */}
            {canEdit && (
              <div className="space-y-3 border-t border-gray-100 px-5 py-4">
                <h3 className="text-sm font-medium text-gray-900">Add Agenda Item</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Item title"
                    value={newTitle}
                    onChange={(e: any) => setNewTitle(e.target.value)}
                    className={inputCls}
                  />
                  <select
                    value={newCategory}
                    onChange={(e: any) => setNewCategory(e.target.value)}
                    className={inputCls}
                  >
                    {Object.entries(categoryLabel).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Duration (min)"
                    value={newDuration}
                    onChange={(e: any) => setNewDuration(e.target.value)}
                    className={inputCls}
                  />
                  <input
                    type="text"
                    placeholder="Presenter (optional)"
                    value={newPresenter}
                    onChange={(e: any) => setNewPresenter(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <textarea
                  placeholder="Description (optional)"
                  value={newDesc}
                  onChange={(e: any) => setNewDesc(e.target.value)}
                  rows={2}
                  className={inputCls}
                />
                <button
                  onClick={addAgendaItem}
                  disabled={!newTitle.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Documents */}
        <div className="space-y-4">
          {/* Documents */}
          <div className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-950">
                <Upload className="h-4 w-4 text-gray-400" />
                Documents
              </h2>
              <span className="text-xs text-gray-400">{documents.length} file{documents.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {documents.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-500">
                  No documents attached. Use the upload button below to add files.
                </div>
              ) : (
                documents.map((d: MeetingDoc) => (
                  <div key={d.id} className="flex items-start gap-3 px-5 py-3">
                    <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-gray-900">{d.name}</div>
                      <div className="mt-0.5 text-xs text-gray-400">
                        {d.file_type ?? 'Unknown'} &middot; {d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : 'Unknown size'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Upload */}
            <div className="border-t border-gray-100 px-5 py-4">
              <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700">
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload Document
                  </>
                )}
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {/* Meeting Minutes */}
          {meeting.minutes && (
            <div className={`${card} overflow-hidden`}>
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-950">Minutes</h2>
              </div>
              <div className="px-5 py-4">
                <p className="whitespace-pre-wrap text-sm text-gray-700">{meeting.minutes}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
