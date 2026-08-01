import { createClient } from '@supabase/supabase-js'

const STAGING_REF = 'zalfkrtjeswvfmucicea'
const url = process.env.STAGING_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
const password = process.env.STAGING_TEST_PASSWORD
if (!url || !anonKey || !serviceKey || !password || new URL(url).hostname.split('.')[0] !== STAGING_REF) {
  throw new Error('Exact staging URL, anon key, service-role key, and test password are required')
}

const ids = {
  portfolioB: '36900000-0000-4000-8000-000000000002',
  associationA: '36900000-0000-4000-8000-000000000011',
  associationB: '36900000-0000-4000-8000-000000000012',
  ownerB: '36900000-0000-4000-8000-000000000042',
  vendorB: '36900000-0000-4000-8000-000000000052',
  chargeA: '36900000-0000-4000-8100-000000000201',
  payableA: '36900000-0000-4000-8100-000000000081',
  portfolioA: '36900000-0000-4000-8000-000000000001',
}

const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function signIn(email) {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`${email} sign-in: ${error.message}`)
  return client
}

async function sameValue(table, id, field) {
  const { data, error } = await service.from(table).select(field).eq('id', id).single()
  if (error) throw new Error(`${table}.${field} fixture lookup: ${error.message}`)
  return data[field]
}

async function expectDeniedUpdate(client, table, id, patch, label) {
  const { data, error } = await client.from(table).update(patch).eq('id', id).select('id')
  if (!error && (data ?? []).length > 0) throw new Error(`${label} unexpectedly updated ${table} ${id}`)
  console.log(`${label}: denied update=PASS`)
}

async function expectDeniedReportRpc(client, label) {
  const { error } = await client.rpc('report_data_delinquency', {
    p_portfolio_id: ids.portfolioA,
    p_params: { association_id: ids.associationA },
  })
  assert(error, `${label} directly executed service-only report_data_delinquency`)
  console.log(`${label}: service-only report RPC=DENIED`)
}

async function main() {
  const anonymous = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: anonymousPortfolios, error: anonymousReadError } = await anonymous.from('portfolios').select('id')
  if (anonymousReadError) throw new Error(`anonymous portfolio read errored instead of failing closed: ${anonymousReadError.message}`)
  assert((anonymousPortfolios ?? []).length === 0, 'anonymous client read protected portfolios')
  await expectDeniedReportRpc(anonymous, 'anonymous')

  const [portfolioBName, associationAName, associationBName, ownerBName, vendorBName, chargeDescription, payableMemo] = await Promise.all([
    sameValue('portfolios', ids.portfolioB, 'company_name'),
    sameValue('associations', ids.associationA, 'name'),
    sameValue('associations', ids.associationB, 'name'),
    sameValue('owners', ids.ownerB, 'full_name'),
    sameValue('vendors', ids.vendorB, 'name'),
    sameValue('charges', ids.chargeA, 'description'),
    sameValue('payable_bills', ids.payableA, 'memo'),
  ])

  const manager = await signIn('codex_test.manager.a@portier369.invalid')
  await expectDeniedReportRpc(manager, 'manager')
  await expectDeniedUpdate(manager, 'associations', ids.associationB, { name: associationBName }, 'Manager A → Association B')
  await expectDeniedUpdate(manager, 'owners', ids.ownerB, { full_name: ownerBName }, 'Manager A → Owner B')
  await expectDeniedUpdate(manager, 'vendors', ids.vendorB, { name: vendorBName }, 'Manager A → Vendor B')

  const admin = await signIn('codex_test.admin.a@portier369.invalid')
  await expectDeniedUpdate(admin, 'portfolios', ids.portfolioB, { company_name: portfolioBName }, 'Company Admin A → Portfolio B')
  await expectDeniedUpdate(admin, 'associations', ids.associationB, { name: associationBName }, 'Company Admin A → Association B')

  const board = await signIn('codex_test.board.a@portier369.invalid')
  await expectDeniedUpdate(board, 'associations', ids.associationA, { name: associationAName }, 'Board A → Association A')

  const owner = await signIn('codex_test.owner.a@portier369.invalid')
  await expectDeniedUpdate(owner, 'charges', ids.chargeA, { description: chargeDescription }, 'Owner A → own charge')

  const vendor = await signIn('codex_test.vendor.a@portier369.invalid')
  await expectDeniedUpdate(vendor, 'payable_bills', ids.payableA, { memo: payableMemo }, 'Vendor A → own payable')

  await Promise.all([manager, admin, board, owner, vendor].map((client) => client.auth.signOut()))
  console.log('anonymous protected reads=DENIED')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
