import { createClient } from '@supabase/supabase-js'

const STAGING_REF = 'zalfkrtjeswvfmucicea'
const url = process.env.STAGING_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY
const password = process.env.STAGING_TEST_PASSWORD
if (!url || !anonKey || !password || new URL(url).hostname.split('.')[0] !== STAGING_REF) {
  throw new Error('Exact staging URL, anon key, and test password are required')
}

const cases = [
  ['codex_test.operator@portier369.invalid', 'is_platform_operator'],
  ['codex_test.admin.a@portier369.invalid', 'is_company_admin', true],
  ['codex_test.manager.a@portier369.invalid', 'is_staff', true],
  ['codex_test.admin.b@portier369.invalid', 'is_company_admin', true],
  ['codex_test.board.a@portier369.invalid', 'is_board', true],
  ['codex_test.owner.a@portier369.invalid', 'owner_id', true],
  ['codex_test.tenant.a@portier369.invalid', 'is_tenant', true],
  ['codex_test.vendor.a@portier369.invalid', 'vendor_id', true],
  ['codex_test.owner.b@portier369.invalid', 'owner_id', true],
  ['codex_test.vendor.b@portier369.invalid', 'vendor_id', true],
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function main() {
  for (const [email, field] of cases) {
    const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error: signInError } = await client.auth.signInWithPassword({ email, password })
    if (signInError) throw new Error(`${email} sign-in: ${signInError.message}`)
    const { data: me, error: meError } = await client.rpc('me')
    if (meError) throw new Error(`${email} me(): ${meError.message}`)
    assert(me?.auth_user_id, `${email} did not resolve an authenticated identity`)
    assert(Boolean(me?.[field]), `${email} did not resolve ${field}`)

    if (field === 'is_platform_operator') {
      const { data: visible, error: visibilityError } = await client.from('portfolios').select('id').in('id', ['36900000-0000-4000-8000-000000000001', '36900000-0000-4000-8000-000000000002'])
      if (visibilityError) throw new Error(`${email} portfolio visibility: ${visibilityError.message}`)
      assert((visible ?? []).length === 2, `${email} cannot read both CODEX_TEST portfolios`)
      await client.auth.signOut()
      console.log(`${email}: ${field}=PASS, cross-portfolio operator visibility=PASS`)
      continue
    }

    const expectedPortfolio = email.includes('.b@') ? '36900000-0000-4000-8000-000000000002' : '36900000-0000-4000-8000-000000000001'
    assert(me?.portfolio?.id === expectedPortfolio, `${email} resolved the wrong portfolio`)
    const otherPortfolio = expectedPortfolio.endsWith('2') ? '36900000-0000-4000-8000-000000000001' : '36900000-0000-4000-8000-000000000002'
    const { data: leaked, error: isolationError } = await client.from('portfolios').select('id').eq('id', otherPortfolio)
    if (isolationError) throw new Error(`${email} isolation query: ${isolationError.message}`)
    assert((leaked ?? []).length === 0, `${email} can read the other CODEX_TEST portfolio`)
    if (field === 'is_board') {
      const { data: communications, error: communicationsError } = await client
        .from('communications_log')
        .select('association_id, subject')
        .like('subject', 'CODEX_TEST%')
      if (communicationsError) throw new Error(`${email} board communications: ${communicationsError.message}`)
      assert((communications ?? []).length === 2, `${email} cannot read both own-association communication fixtures`)
      assert(communications.every((row) => row.association_id === '36900000-0000-4000-8000-000000000011'), `${email} can read another association's communications`)
    }
    if (field === 'is_tenant') {
      assert(me?.tenant_id === '36900000-0000-4000-8000-000000000071', `${email} resolved the wrong tenant`)
      assert(me?.owner_id === null, `${email} inherited owner financial access`)
      assert(me?.vendor_id === null, `${email} inherited vendor access`)
      const scopedReads = await Promise.all([
        client.from('tenants').select('id'),
        client.from('associations').select('id'),
        client.from('units').select('id'),
        client.from('documents').select('id, entity_id, doc_type').like('file_name', 'CODEX_TEST%'),
        client.from('charges').select('id'),
        client.from('payments').select('id'),
        client.from('statements').select('id'),
      ])
      const [tenants, associations, units, documents, charges, payments, statements] = scopedReads
      for (const [label, result] of Object.entries({ tenants, associations, units, documents, charges, payments, statements })) {
        if (result.error) throw new Error(`${email} ${label}: ${result.error.message}`)
      }
      assert((tenants.data ?? []).length === 1 && tenants.data[0].id === me.tenant_id, `${email} can read another tenant`)
      assert((associations.data ?? []).length === 1 && associations.data[0].id === '36900000-0000-4000-8000-000000000013', `${email} can read another association`)
      assert((units.data ?? []).length === 1 && units.data[0].id === '36900000-0000-4000-8000-000000000033', `${email} can read another unit`)
      assert((documents.data ?? []).length === 1 && documents.data[0].entity_id === '36900000-0000-4000-8000-000000000013', `${email} document scope is incorrect`)
      assert((charges.data ?? []).length === 0, `${email} can read owner charges`)
      assert((payments.data ?? []).length === 0, `${email} can read owner payments`)
      assert((statements.data ?? []).length === 0, `${email} can read owner statements`)
    }
    await client.auth.signOut()
    console.log(`${email}: ${field}=PASS, portfolio isolation=PASS`)
  }
}

main().catch((error) => { console.error(error.message); process.exit(1) })
