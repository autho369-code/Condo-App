import { createClient } from '@supabase/supabase-js'
import { generateLiveExportRows, LIVE_EXPORT_SLUGS } from '../lib/reports/live-export'

const STAGING_REF = 'zalfkrtjeswvfmucicea'
const portfolioId = '36900000-0000-4000-8000-000000000001'
const associationId = '36900000-0000-4000-8000-000000000011'
const url = process.env.STAGING_SUPABASE_URL
const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
if (!url || !key || new URL(url).hostname.split('.')[0] !== STAGING_REF) throw new Error('Exact staging credentials are required')
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const params = { association_id: associationId, date_from: '2026-01-01', date_to: '2026-07-28', fiscal_year: '2026' }

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const { data: definitions, error: definitionsError } = await db
    .from('report_definitions')
    .select('slug')
    .eq('active', true)
    .in('slug', [...LIVE_EXPORT_SLUGS])
  if (definitionsError) throw definitionsError
  assert(definitions?.length === LIVE_EXPORT_SLUGS.length, `Expected ${LIVE_EXPORT_SLUGS.length} active live report definitions, got ${definitions?.length ?? 0}`)

  const output = new Map<string, Record<string, unknown>[]>()
  for (const slug of LIVE_EXPORT_SLUGS) {
    const rows = await generateLiveExportRows(db, portfolioId, slug, params)
    output.set(slug, rows)
    console.log(`${slug}: ${rows.length} row(s)`)
  }
  const trial = output.get('trial_balance') ?? []
  const totals = trial.find((row) => row.Account === 'Totals')
  assert(totals && Number(totals.Debit) === Number(totals.Credit), 'Trial balance is not balanced')
  const balance = output.get('balance_sheet') ?? []
  const check = balance.find((row) => row.Section === 'balance_check')
  assert(check && Math.abs(Number(check.Amount)) < 0.005, 'Balance sheet does not balance')
  const income = (output.get('income_statement') ?? []).find((row) => row.Account === 'Net Income')
  assert(income && Number(income.Amount) === 5400, `Unexpected Alpha net income: ${income?.Amount}`)
  const ap = output.get('ap_aging') ?? []
  assert(ap.length === 2, `Expected two Alpha payables, got ${ap.length}`)
  assert(ap.some((row) => row['Aging bucket'] === '90+'), 'Missing 90+ payable bucket')
  assert(ap.every((row) => row['Bill #'] !== 'BETA-ONLY'), 'Cross-tenant payable leaked into Alpha')
  const ar = output.get('ar_aging') ?? []
  assert(ar.length === 5, `Expected five Alpha receivables, got ${ar.length}`)
  assert(new Set(ar.map((row) => row['Aging bucket'])).size === 5, 'Expected all five receivable aging buckets')
  assert(ar.every((row) => row.Description !== 'CODEX_TEST cross-tenant receivable sentinel'), 'Cross-tenant receivable leaked into Alpha')
  assert(ar.reduce((sum, row) => sum + Number(row['Balance due']), 0) === 1400, 'Unexpected Alpha receivable balance')
  const delinquency = output.get('delinquency_summary') ?? []
  assert(delinquency.length === 1 && Number(delinquency[0]['Total delinquent']) === 1400, 'Delinquency summary does not reconcile to A/R aging')
  const budget = output.get('budget_vs_actual') ?? []
  assert(budget.length >= 2, 'Budget vs actual produced no useful Alpha rows')
  const bank = output.get('bank_reconciliation') ?? []
  assert(bank.length === 1 && Number(bank[0]['Book balance']) === 10200, 'Bank reconciliation book balance is incorrect')
  const bankDetail = output.get('bank_reconciliation_detail') ?? []
  assert(bankDetail.length === 2, `Expected two Alpha reconciliation items, got ${bankDetail.length}`)
  assert(bankDetail.every((row) => row.Cleared === true), 'Completed reconciliation contains uncleared fixture items')
  assert(bankDetail.reduce((sum, row) => sum + Number(row.Amount), 0) === 10200, 'Reconciliation detail does not sum to the book balance')

  let rejected = false
  try {
    await generateLiveExportRows(db, portfolioId, 'trial_balance', { ...params, association_id: '36900000-0000-4000-8000-000000000012' })
  } catch (error) {
    rejected = String(error).includes('not in this portfolio')
  }
  assert(rejected, 'Cross-portfolio association scope was not rejected')
  console.log('Accounting invariants and tenant isolation: PASS')
}

main().catch((error) => { console.error(error.message); process.exit(1) })
