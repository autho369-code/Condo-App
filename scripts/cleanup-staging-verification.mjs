import { createClient } from '@supabase/supabase-js'

const STAGING_REF = 'zalfkrtjeswvfmucicea'
const PRODUCTION_REF = 'termxngysvotnfbzbgrv'
const FIXTURE = 'CODEX_TEST_PORTIER369_V1'
const DOCUMENT_BUCKET = 'association-documents'
const DOCUMENT_PATH = 'associations/36900000-0000-4000-8000-000000000011/codex-test/governing-document.pdf'
const url = process.env.STAGING_SUPABASE_URL
const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) throw new Error('Missing staging URL or staging service-role key')
const ref = new URL(url).hostname.split('.')[0]
if (ref !== STAGING_REF || ref === PRODUCTION_REF || process.env.PORTIER369_STAGING_CONFIRM !== STAGING_REF) {
  throw new Error(`Refusing cleanup for project ${ref || 'unknown'}`)
}
if (process.env.PORTIER369_CODEX_TEST_CLEANUP_CONFIRM !== FIXTURE) {
  throw new Error(`Set PORTIER369_CODEX_TEST_CLEANUP_CONFIRM=${FIXTURE} to clean only the marked fixture`)
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const portfolioIds = ['36900000-0000-4000-8000-000000000001', '36900000-0000-4000-8000-000000000002']
const associationIds = ['36900000-0000-4000-8000-000000000011', '36900000-0000-4000-8000-000000000012', '36900000-0000-4000-8000-000000000013']
const buildingIds = ['36900000-0000-4000-8000-000000000021', '36900000-0000-4000-8000-000000000022', '36900000-0000-4000-8000-000000000023']
const unitIds = ['36900000-0000-4000-8000-000000000031', '36900000-0000-4000-8000-000000000032', '36900000-0000-4000-8000-000000000033']
const ownerIds = ['36900000-0000-4000-8000-000000000041', '36900000-0000-4000-8000-000000000042', '36900000-0000-4000-8000-000000000043']
const vendorIds = ['36900000-0000-4000-8000-000000000051', '36900000-0000-4000-8000-000000000052']
const bankIds = ['36900000-0000-4000-8000-000000000061', '36900000-0000-4000-8000-000000000062']
const fixtureEmails = [
  'codex_test.admin.a@portier369.invalid',
  'codex_test.manager.a@portier369.invalid',
  'codex_test.admin.b@portier369.invalid',
  'codex_test.board.a@portier369.invalid',
  'codex_test.board.observer.a@portier369.invalid',
  'codex_test.owner.a@portier369.invalid',
  'codex_test.vendor.a@portier369.invalid',
  'codex_test.owner.b@portier369.invalid',
  'codex_test.vendor.b@portier369.invalid',
  'codex_test.operator@portier369.invalid',
]
const entry = (tenant, suffix) => `36900000-0000-4000-9${tenant}00-${String(suffix).padStart(12, '0')}`
const journalEntryIds = [1, 2].flatMap((tenant) => [1, 2, 3].map((suffix) => entry(tenant, suffix)))
const journalLineIds = [1, 2].flatMap((tenant) => [100, 101, 102, 103, 104, 105].map((suffix) => entry(tenant, suffix)))

async function must(label, promise) {
  const result = await promise
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

async function removeByIds(table, ids) {
  await must(`delete ${table}`, db.from(table).delete().in('id', ids))
}

async function main() {
  const portfolios = await must('verify fixture portfolios', db.from('portfolios').select('id, company_name').in('id', portfolioIds))
  if (portfolios.length !== portfolioIds.length || portfolios.some((row) => !row.company_name?.startsWith(FIXTURE))) {
    throw new Error('Fixture ownership check failed; no rows were deleted')
  }

  // Child-first and exact-ID-only. No wildcard, date-range, or unmarked deletion is allowed.
  await removeByIds('communications_log', [
    '36900000-0000-4000-8100-000000000308', '36900000-0000-4000-8100-000000000309',
    '36900000-0000-4000-8200-000000000308', '36900000-0000-4000-8200-000000000309',
  ])
  await removeByIds('communication_messages', ['36900000-0000-4000-8100-000000000305', '36900000-0000-4000-8200-000000000305'])
  await removeByIds('documents', ['36900000-0000-4000-8100-000000000307', '36900000-0000-4000-8200-000000000307'])
  await must('delete deterministic document object', db.storage.from(DOCUMENT_BUCKET).remove([DOCUMENT_PATH]))
  await removeByIds('meetings', ['36900000-0000-4000-8100-000000000304', '36900000-0000-4000-8200-000000000304'])
  await removeByIds('calendar_events', ['36900000-0000-4000-8100-000000000303', '36900000-0000-4000-8200-000000000303'])
  await removeByIds('insurance_policies', ['36900000-0000-4000-8100-000000000306', '36900000-0000-4000-8200-000000000306'])
  await removeByIds('violations', ['36900000-0000-4000-8100-000000000302', '36900000-0000-4000-8200-000000000302'])
  await removeByIds('work_orders', ['36900000-0000-4000-8100-000000000300', '36900000-0000-4000-8200-000000000300'])
  await removeByIds('maintenance_tasks', ['36900000-0000-4000-8100-000000000301', '36900000-0000-4000-8200-000000000301'])
  await removeByIds('bank_reconciliation_items', [
    '36900000-0000-4000-8100-000000000089', '36900000-0000-4000-8100-000000000090',
    '36900000-0000-4000-8200-000000000089', '36900000-0000-4000-8200-000000000090',
  ])
  await removeByIds('bank_reconciliations', ['36900000-0000-4000-8100-000000000087', '36900000-0000-4000-8200-000000000088'])
  await removeByIds('bank_transactions', ['36900000-0000-4000-8100-000000000085', '36900000-0000-4000-8200-000000000086'])
  await removeByIds('payable_bills', ['36900000-0000-4000-8100-000000000081', '36900000-0000-4000-8100-000000000082', '36900000-0000-4000-8200-000000000083'])
  await must('delete payment applications', db.from('payment_applications').delete().eq('payment_id', '36900000-0000-4000-8100-000000000220'))
  await removeByIds('payments', ['36900000-0000-4000-8100-000000000220'])
  await removeByIds('charges', [
    '36900000-0000-4000-8100-000000000201', '36900000-0000-4000-8100-000000000202',
    '36900000-0000-4000-8100-000000000203', '36900000-0000-4000-8100-000000000204',
    '36900000-0000-4000-8100-000000000205', '36900000-0000-4000-8200-000000000206',
  ])
  await removeByIds('budget_lines', ['36900000-0000-4000-8100-000000000071', '36900000-0000-4000-8100-000000000072', '36900000-0000-4000-8200-000000000073'])
  await removeByIds('journal_lines', journalLineIds)
  await removeByIds('journal_entries', journalEntryIds)
  await removeByIds('bank_accounts', bankIds)
  await removeByIds('association_assignments', ['36900000-0000-4000-8100-000000000093', '36900000-0000-4000-8100-000000000101'])
  await must('delete board_approval_settings', db.from('board_approval_settings').delete().in('association_id', associationIds))
  await removeByIds('board_members', ['36900000-0000-4000-8100-000000000094', '36900000-0000-4000-8100-000000000096'])
  await removeByIds('platform_operators', ['36900000-0000-4000-8100-000000000095'])
  await removeByIds('tenants', ['36900000-0000-4000-8000-000000000071'])
  await removeByIds('occupancies', ['36900000-0000-4000-8100-000000000097', '36900000-0000-4000-8200-000000000098', '36900000-0000-4000-8100-000000000100'])
  await removeByIds('unit_owners', ['36900000-0000-4000-8100-000000000091', '36900000-0000-4000-8200-000000000092', '36900000-0000-4000-8100-000000000099'])
  await removeByIds('vendors', vendorIds)
  await removeByIds('owners', ownerIds)
  await removeByIds('units', unitIds)
  await removeByIds('buildings', buildingIds)
  await removeByIds('gl_accounts', [1, 2].flatMap((tenant) => [1, 2, 3, 4, 5, 6, 7].map((suffix) => `36900000-0000-4000-8${tenant}00-${String(suffix).padStart(12, '0')}`)))
  await removeByIds('associations', associationIds)

  const listed = await must('list fixture auth users', db.auth.admin.listUsers({ perPage: 1000 }))
  const fixtureUsers = listed.users.filter((candidate) => fixtureEmails.includes(candidate.email ?? ''))
  if (fixtureUsers.length) {
    await must('delete fixture actor audit logs', db.from('audit_logs').delete().in('actor_id', fixtureUsers.map((user) => user.id)))
  }
  await removeByIds('profiles', fixtureUsers.map((user) => user.id))
  for (const user of fixtureUsers) {
    await must(`delete auth user ${user.email}`, db.auth.admin.deleteUser(user.id))
  }
  await must('delete fixture email queue', db.from('email_queue').delete().in('portfolio_id', portfolioIds))
  await removeByIds('portfolios', portfolioIds)

  console.log(JSON.stringify({ project: ref, cleanedFixture: FIXTURE, portfolios: portfolioIds.length }, null, 2))
}

try {
  await main()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
