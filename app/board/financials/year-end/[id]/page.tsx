import Link from 'next/link'
import { notFound } from 'next/navigation'
import { YearEndStatements } from '@/components/accounting/year-end-statements'
import { PrintButton } from '@/components/ui/print-button'
import { requireBoard } from '@/lib/auth/me'
import { createClient } from '@/lib/supabase/server'
import { displayTimeZone } from '@/lib/time/display-zone'
import { Alert } from '@/components/ui/shell'

export const dynamic = 'force-dynamic'

export default async function BoardYearEndPackagePage({ params }: { params: Promise<{ id: string }> }) {
  await requireBoard()
  const { id } = await params
  const db = (await createClient()) as any
  // RLS: board members can read finalized packages for their own associations only.
  const { data: pkg, error } = await db.from('year_end_packages').select('id, fiscal_year, status, snapshot, snapshot_sha256, finalized_at').eq('id', id).eq('status', 'finalized').maybeSingle()
  if (error) {
    return (
      <div className="space-y-5">
        <Link href="/board/financials" className="text-sm text-gray-500 hover:text-gray-900">← Financials</Link>
        <Alert tone="danger" title="Year-end package could not be loaded">{error.message}</Alert>
      </div>
    )
  }
  if (!pkg) notFound()
  const s = pkg.snapshot
  return (
    <div className="space-y-5 print:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/board/financials" className="text-sm text-gray-500 hover:text-gray-900">← Financials</Link>
        <PrintButton label="Print / save PDF" />
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Year-end financial package</div>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-gray-950 sm:text-[26px]">{s.association?.legal_name || s.association?.name}</h1>
        <p className="mt-1 text-sm text-gray-500">Fiscal year {s.fiscal_year} · {s.period_start} to {s.period_end} · finalized {new Date(pkg.finalized_at).toLocaleDateString('en-US', { timeZone: displayTimeZone(), month: 'short', day: 'numeric', year: 'numeric' })}</p>
        <p className="mt-1 break-all font-mono text-[11px] text-gray-400">SHA-256 {pkg.snapshot_sha256}</p>
      </div>
      <YearEndStatements snapshot={s} />
    </div>
  )
}
