import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const STAGING_REF = 'zalfkrtjeswvfmucicea'
const url = process.env.STAGING_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey || new URL(url).hostname.split('.')[0] !== STAGING_REF) {
  throw new Error('Exact staging URL, anon key, and service-role key are required')
}

const BUCKET = 'association-documents'
const ASSOCIATION_A = '36900000-0000-4000-8000-000000000011'
const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const anonymous = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function main() {
  const { data: buckets, error: bucketError } = await service.storage.listBuckets()
  if (bucketError) throw new Error(`bucket inventory failed: ${bucketError.message}`)
  const bucket = buckets.find((candidate) => candidate.id === BUCKET)
  assert(bucket, `${BUCKET} is missing`)
  assert(bucket.public === false, `${BUCKET} must be private`)
  assert(bucket.file_size_limit === 25 * 1024 * 1024, `${BUCKET} must enforce a 25 MB limit`)
  assert(bucket.allowed_mime_types?.includes('application/pdf'), `${BUCKET} does not allow PDF`)
  assert(!bucket.allowed_mime_types?.includes('application/x-msdownload'), `${BUCKET} allows executable MIME types`)

  const nonce = randomUUID()
  const allowedPath = `associations/${ASSOCIATION_A}/verification/${nonce}.pdf`
  const blockedPath = `associations/${ASSOCIATION_A}/verification/${nonce}.exe`
  const unsignedPath = `associations/${ASSOCIATION_A}/verification/${nonce}-unsigned.pdf`
  const cleanupPaths = [allowedPath, blockedPath, unsignedPath]

  try {
    const { data: capability, error: capabilityError } = await service.storage.from(BUCKET).createSignedUploadUrl(allowedPath)
    if (capabilityError || !capability?.token) throw new Error(`signed PDF capability failed: ${capabilityError?.message ?? 'missing token'}`)
    const pdf = new TextEncoder().encode('%PDF-1.4\n% staging storage verification\n%%EOF\n')
    const { error: uploadError } = await anonymous.storage.from(BUCKET)
      .uploadToSignedUrl(allowedPath, capability.token, pdf, { contentType: 'application/pdf' })
    if (uploadError) throw new Error(`authorized PDF upload failed: ${uploadError.message}`)

    const { data: signed, error: signedError } = await service.storage.from(BUCKET).createSignedUrl(allowedPath, 60)
    if (signedError || !signed?.signedUrl) throw new Error(`signed PDF read failed: ${signedError?.message ?? 'missing URL'}`)
    const signedResponse = await fetch(signed.signedUrl)
    assert(signedResponse.ok, `signed PDF read returned ${signedResponse.status}`)
    assert(new TextDecoder().decode(await signedResponse.arrayBuffer()).startsWith('%PDF-'), 'signed PDF contents are invalid')

    const publicResponse = await fetch(`${url}/storage/v1/object/public/${BUCKET}/${allowedPath}`)
    assert(!publicResponse.ok, 'private document was readable through a public bucket URL')

    const { error: unsignedError } = await anonymous.storage.from(BUCKET)
      .upload(unsignedPath, pdf, { contentType: 'application/pdf' })
    assert(unsignedError, 'anonymous upload succeeded without a signed capability')

    const { data: blockedCapability, error: blockedCapabilityError } = await service.storage.from(BUCKET).createSignedUploadUrl(blockedPath)
    if (blockedCapabilityError || !blockedCapability?.token) throw new Error(`blocked-type capability setup failed: ${blockedCapabilityError?.message ?? 'missing token'}`)
    const { error: blockedError } = await anonymous.storage.from(BUCKET)
      .uploadToSignedUrl(blockedPath, blockedCapability.token, new Uint8Array([77, 90]), { contentType: 'application/x-msdownload' })
    assert(blockedError, 'executable MIME upload was accepted')

    console.log('association-documents: private signed PDF upload/download=PASS')
    console.log('association-documents: public read, unsigned upload, executable MIME=DENIED')
  } finally {
    const { error: cleanupError } = await service.storage.from(BUCKET).remove(cleanupPaths)
    if (cleanupError) throw new Error(`verification object cleanup failed: ${cleanupError.message}`)
    const { data: leftovers, error: listError } = await service.storage.from(BUCKET)
      .list(`associations/${ASSOCIATION_A}/verification`, { search: nonce })
    if (listError) throw new Error(`verification cleanup audit failed: ${listError.message}`)
    assert((leftovers ?? []).length === 0, 'verification objects remained after cleanup')
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
