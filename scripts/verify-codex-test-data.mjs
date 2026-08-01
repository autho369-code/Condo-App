import { createClient } from '@supabase/supabase-js'

const STAGING_REF = 'zalfkrtjeswvfmucicea'
const PRODUCTION_REF = 'termxngysvotnfbzbgrv'
const FIXTURE = 'CODEX_TEST_PORTIER369_V1'
const url = process.env.STAGING_SUPABASE_URL
const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) throw new Error('Missing staging URL or staging service-role key')
const ref = new URL(url).hostname.split('.')[0]
if (ref !== STAGING_REF || ref === PRODUCTION_REF || process.env.PORTIER369_STAGING_CONFIRM !== STAGING_REF) {
  throw new Error(`Refusing fixture verification for project ${ref || 'unknown'}`)
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const ids = {
  portfolios: ['36900000-0000-4000-8000-000000000001', '36900000-0000-4000-8000-000000000002'],
  associations: ['36900000-0000-4000-8000-000000000011', '36900000-0000-4000-8000-000000000012', '36900000-0000-4000-8000-000000000013'],
  bankAccounts: ['36900000-0000-4000-8000-000000000061', '36900000-0000-4000-8000-000000000062'],
  workOrders: ['36900000-0000-4000-8100-000000000300', '36900000-0000-4000-8200-000000000300'],
  maintenanceTasks: ['36900000-0000-4000-8100-000000000301', '36900000-0000-4000-8200-000000000301'],
  violations: ['36900000-0000-4000-8100-000000000302', '36900000-0000-4000-8200-000000000302'],
  calendarEvents: ['36900000-0000-4000-8100-000000000303', '36900000-0000-4000-8200-000000000303'],
  meetings: ['36900000-0000-4000-8100-000000000304', '36900000-0000-4000-8200-000000000304'],
  communications: ['36900000-0000-4000-8100-000000000305', '36900000-0000-4000-8200-000000000305'],
  communicationLogs: [
    '36900000-0000-4000-8100-000000000308', '36900000-0000-4000-8100-000000000309',
    '36900000-0000-4000-8200-000000000308', '36900000-0000-4000-8200-000000000309',
  ],
  reconciliationItems: [
    '36900000-0000-4000-8100-000000000089', '36900000-0000-4000-8100-000000000090',
    '36900000-0000-4000-8200-000000000089', '36900000-0000-4000-8200-000000000090',
  ],
  insurance: ['36900000-0000-4000-8100-000000000306', '36900000-0000-4000-8200-000000000306'],
  documents: ['36900000-0000-4000-8100-000000000307', '36900000-0000-4000-8200-000000000307'],
  tenants: ['36900000-0000-4000-8000-000000000071'],
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function rows(table, expectedIds, columns = 'id') {
  const { data, error } = await db.from(table).select(columns).in('id', expectedIds)
  if (error) throw new Error(`${table}: ${error.message}`)
  assert(data.length === expectedIds.length, `${table}: expected ${expectedIds.length} fixture rows, found ${data.length}`)
  return data
}

const portfolios = await rows('portfolios', ids.portfolios, 'id, company_name')
assert(portfolios.every((row) => row.company_name?.startsWith(FIXTURE)), 'portfolio ownership markers are missing')
const associations = await rows('associations', ids.associations, 'id, portfolio_id, name, operating_bank_account_id, reserve_bank_account_id')
assert(associations.every((row) => row.name?.startsWith('CODEX_TEST')), 'association labels are missing CODEX_TEST')
assert(associations.filter((row) => row.portfolio_id === ids.portfolios[0]).length === 2, 'primary portfolio must have two associations')
assert(associations.find((row) => row.id === ids.associations[0])?.operating_bank_account_id === ids.bankAccounts[0], 'Alpha association is not linked to its deterministic operating account')
assert(associations.find((row) => row.id === ids.associations[1])?.operating_bank_account_id === ids.bankAccounts[1], 'Beta association is not linked to its deterministic operating account')
assert(associations.every((row) => row.reserve_bank_account_id === null), 'fixture associations should not retain empty reserve bank shells')

const { data: fixtureBanks, error: fixtureBanksError } = await db
  .from('bank_accounts')
  .select('id, association_id, name, bank_name, gl_account_id, last_reconciliation_date')
  .in('association_id', ids.associations)
if (fixtureBanksError) throw new Error(`bank_accounts: ${fixtureBanksError.message}`)
assert(fixtureBanks.length === 2, `bank_accounts: expected 2 configured fixture accounts, found ${fixtureBanks.length}`)
assert(ids.bankAccounts.every((id) => fixtureBanks.some((row) => row.id === id)), 'deterministic fixture bank accounts are missing')
assert(fixtureBanks.every((row) => row.name?.startsWith('CODEX_TEST')), 'auto-provisioned bank shells remain in fixture associations')
assert(fixtureBanks.every((row) => row.bank_name && row.gl_account_id), 'fixture bank accounts must be fully configured')
assert(fixtureBanks.every((row) => row.last_reconciliation_date === '2026-06-30'), 'fixture bank accounts must record the completed reconciliation date')

await rows('work_orders', ids.workOrders, 'id, portfolio_id, association_id, title')
await rows('maintenance_tasks', ids.maintenanceTasks, 'id, association_id, task_name')
await rows('violations', ids.violations, 'id, association_id, title, hearing_required')
await rows('calendar_events', ids.calendarEvents, 'id, portfolio_id, association_id, title')
await rows('meetings', ids.meetings, 'id, portfolio_id, association_id, title')
await rows('communication_messages', ids.communications, 'id, portfolio_id, association_id, subject')
await rows('communications_log', ids.communicationLogs, 'id, portfolio_id, association_id, channel, subject')
await rows('bank_reconciliation_items', ids.reconciliationItems, 'id, reconciliation_id, journal_line_id, amount, is_cleared')
await rows('insurance_policies', ids.insurance, 'id, association_id, owner_id, policy_number')
await rows('documents', ids.documents, 'id, entity_type, entity_id, file_name, file_url')
await rows('tenants', ids.tenants, 'id, portfolio_id, association_id, unit_id, owner_id, first_name, lease_start, lease_end')

const fixtureEmails = [
  'codex_test.operator@portier369.invalid',
  'codex_test.admin.a@portier369.invalid',
  'codex_test.manager.a@portier369.invalid',
  'codex_test.admin.b@portier369.invalid',
  'codex_test.board.a@portier369.invalid',
  'codex_test.board.observer.a@portier369.invalid',
  'codex_test.owner.a@portier369.invalid',
  'codex_test.vendor.a@portier369.invalid',
  'codex_test.owner.b@portier369.invalid',
  'codex_test.vendor.b@portier369.invalid',
]
const { data: authPage, error: authError } = await db.auth.admin.listUsers({ perPage: 1000 })
if (authError) throw new Error(`auth users: ${authError.message}`)
const existingEmails = new Set(authPage.users.map((user) => user.email))
assert(fixtureEmails.every((email) => existingEmails.has(email)), 'one or more fixture auth users are missing')
assert(!existingEmails.has('codex_test.tenant.a@portier369.invalid'), 'tenant auth identity exists even though tenant portal identity mapping is unsupported')

const documentPath = 'associations/36900000-0000-4000-8000-000000000011/codex-test/governing-document.pdf'
const { data: documentBlob, error: documentError } = await db.storage.from('association-documents').download(documentPath)
if (documentError || !documentBlob) throw new Error(`fixture document: ${documentError?.message ?? 'missing object'}`)
assert((await documentBlob.text()).startsWith('%PDF-'), 'fixture document is not a PDF payload')

console.log(JSON.stringify({
  project: ref,
  fixture: FIXTURE,
  verified: {
    portfolios: ids.portfolios.length,
    associations: ids.associations.length,
    authUsers: fixtureEmails.length,
    tenantContacts: ids.tenants.length,
    operationalRows: Object.entries(ids)
      .filter(([key]) => !['portfolios', 'associations', 'documents', 'tenants'].includes(key))
      .reduce((count, [, group]) => count + group.length, 0),
    privateDocuments: ids.documents.length,
  },
  unsupported: { tenantPortalAuthIdentity: true },
}, null, 2))
