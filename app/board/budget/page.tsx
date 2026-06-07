import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { money } from '@/lib/utils'
import { TrendingUp, BarChart3 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function BoardBudgetPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  // Query management_fees for budget data (monthly fee income = budget proxy)
  const { data: fees } = await db
    .from('management_fees')
    .select('month, fee_amount_cents, collected_cents, delinquent_cents')
    .in('association_id', ids)
    .order('month', { ascending: false })
    .limit(12)

  const months = (fees ?? []).reverse()
  const ytdBudget = months.reduce((s: number, m: any) => s + (m.fee_amount_cents ?? 0), 0)
  const ytdActual = months.reduce((s: number, m: any) => s + (m.collected_cents ?? 0), 0)
  const variance = ytdActual - ytdBudget
  const variancePct = ytdBudget > 0 ? ((variance / ytdBudget) * 100).toFixed(1) : '0'

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Budget vs Actual</h1>
        <p className="mt-1 text-sm text-slate-400">Association financial performance against budget</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'YTD Budget', value: money(ytdBudget), cls: 'text-white' },
          { label: 'YTD Actual', value: money(ytdActual), cls: ytdActual >= ytdBudget ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'Variance', value: money(variance), cls: variance >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Variance %', value: `${variancePct}%`, cls: Number(variancePct) >= 0 ? 'text-emerald-400' : 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
            <div className="text-xs font-medium uppercase text-slate-500">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <div className="border-b border-[#1E293B] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Monthly Breakdown</h2>
        </div>
        <div className="p-5">
          {months.length === 0 ? (
            <p className="py-8 text-center text-slate-500">No budget data recorded yet. Management fees will appear here once entered.</p>
          ) : (
            <div className="space-y-3">
              {months.map((m: any) => {
                const mn = new Date(m.month).getMonth()
                const budget = m.fee_amount_cents ?? 0
                const actual = m.collected_cents ?? 0
                const maxVal = Math.max(budget, actual, 1)
                return (
                  <div key={m.month} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400 font-medium w-12">{monthNames[mn]}</span>
                      <span className="text-slate-300 tabular-nums w-24 text-right">{money(actual)}</span>
                      <span className="text-slate-500 tabular-nums w-24 text-right">{money(budget)}</span>
                      <span className={`tabular-nums w-16 text-right text-xs ${actual >= budget ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {budget > 0 ? ((actual - budget) / budget * 100).toFixed(0) + '%' : '—'}
                      </span>
                    </div>
                    <div className="flex h-2 gap-0.5">
                      <div className="bg-[#1E293B] rounded-sm flex-1 relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-emerald-500/30 rounded-sm" style={{ width: `${Math.min((actual / maxVal) * 100, 100)}%` }} />
                      </div>
                      <div className="w-0.5 bg-slate-600 rounded" title="Budget target" />
                      <div className="bg-[#1E293B] rounded-sm flex-1 relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-slate-500/20 rounded-sm" style={{ width: `${Math.min((budget / maxVal) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center gap-6 pt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500/30 inline-block" /> Actual</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-500/20 inline-block" /> Budget</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
