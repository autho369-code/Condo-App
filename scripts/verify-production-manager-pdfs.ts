import { createClient } from '@supabase/supabase-js'
import { processReportRun } from '../lib/reports/process'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.PRODUCTION_MANAGER_TEST_PASSWORD
const expectedRef = 'termxngysvotnfbzbgrv'

if (!url || !publishableKey || !serviceKey || !password) throw new Error('Production verification credentials are required')
if (new URL(url).hostname.split('.')[0] !== expectedRef || process.env.PORTIER369_PRODUCTION_VERIFY !== expectedRef) {
  throw new Error('Refusing to run outside the explicitly confirmed production project')
}

const associationId = 'b1111111-1111-1111-1111-111111111111'
const requiredReports = [
  'trial_balance',
  'balance_sheet',
  'income_statement',
  'general_ledger',
  'ar_aging',
  'delinquency',
  'delinquency_summary',
] as const

async function main() {
  const manager = createClient(url!, publishableKey!, { auth: { persistSession: false, autoRefreshToken: false } })
  const service = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } })
  const login = await manager.auth.signInWithPassword({ email: 'hello@portier369.com', password: password! })
  if (login.error) throw login.error

  for (const slug of requiredReports) {
    const definition = await manager.from('report_definitions').select('id').eq('slug', slug).eq('active', true).single()
    if (definition.error) throw new Error(`${slug}: ${definition.error.message}`)
    const queued = await manager.rpc('queue_report_run', {
      p_definition_id: definition.data.id,
      p_parameters: {
        scope: 'association',
        association_id: associationId,
        date_from: '2026-07-01',
        date_to: '2026-07-31',
        fiscal_year: '2026',
      },
      p_output_format: 'pdf',
    })
    if (queued.error) throw new Error(`${slug}: queue failed: ${queued.error.message}`)
    await processReportRun(queued.data.id)
    const run = await service.from('report_runs')
      .select('id,status,error_message,output_url,output_size_bytes,row_count')
      .eq('id', queued.data.id)
      .single()
    if (run.error) throw new Error(`${slug}: run lookup failed: ${run.error.message}`)
    if (run.data.status !== 'succeeded' || !run.data.output_url) {
      throw new Error(`${slug}: ${run.data.status}: ${run.data.error_message ?? 'missing PDF URL'}`)
    }
    const response = await fetch(run.data.output_url)
    const bytes = new Uint8Array(await response.arrayBuffer())
    const signature = new TextDecoder().decode(bytes.slice(0, 4))
    if (!response.ok || response.headers.get('content-type') !== 'application/pdf' || signature !== '%PDF') {
      throw new Error(`${slug}: invalid PDF response (${response.status}, ${response.headers.get('content-type')}, ${signature})`)
    }
    console.log(`${slug}: PASS (${run.data.row_count} rows, ${bytes.byteLength} bytes)`)
  }
  await manager.auth.signOut()
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
