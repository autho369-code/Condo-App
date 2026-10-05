'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireStaff, requireWorkspaceStaff } from '@/lib/auth/me'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { safeInternalNext } from '@/lib/security/redirects'
import { CHECK_CONSOLIDATION, CHECK_STUB, VENDOR_PAYMENT_TYPES, VENDOR_TRADES, VENDOR_TYPES } from '@/lib/vendors/options'
import { mergePrivateFieldsOne, savePrivateFields } from '@/lib/private-fields'

// Invite a vendor to the vendor portal. Creates a real user_invitations row so
// the vendor gets the /invite link, sets a password, and can log in. Vendor is
// now a first-class non-staff role so it cannot inherit owner financial access.
// login routing checks vendor_id BEFORE owner_id — so once auto_link_portal_user
// links the vendor by email on signup, they land on /vendor.
export async function inviteVendorToPortal(formData: FormData) {
  const me = await requireStaff()
  const vendorId = formData.get('vendor_id') as string
  const back = safeInternalNext(formData.get('return_to')) ?? '/vendors'
  const sep = back.includes('?') ? '&' : '?'
  const fail = (msg: string) => redirect(back + sep + 'error=' + encodeURIComponent(msg))

  if (!vendorId) fail('Missing vendor.')

  const supabase = await createClient()
  const db = supabase as any
  const { data: vendor } = await db
    .from('vendors')
    .select('id, name, emails, portfolio_id, portfolios(company_name)')
    .eq('id', vendorId)
    .maybeSingle()
  if (!vendor) fail('Vendor not found.')

  const emails: string[] = Array.isArray(vendor.emails) ? vendor.emails : []
  const email = emails.find((e) => typeof e === 'string' && e.includes('@'))
  if (!email) fail('This vendor has no email on file. Add one before inviting them to the portal.')

  // The invitation belongs to the vendor's own company (a platform operator's
  // portfolio is not the client company's).
  const portfolioId: string = vendor.portfolio_id
  const companyName: string | null = vendor.portfolios?.company_name ?? null
  if (!portfolioId) fail('Vendor not found.')
  const svc = createServiceClient() as any
  // Supersede any older pending invite for this email so only one link is live.
  await svc
    .from('user_invitations')
    .update({ status: 'revoked' })
    .eq('email', email!.toLowerCase())
    .eq('portfolio_id', portfolioId)
    .eq('status', 'pending')

  const { error } = await svc.from('user_invitations').insert({
    portfolio_id: portfolioId,
    email: email!.toLowerCase(),
    full_name: vendor.name,
    hoa_role: 'vendor',
    invited_by: me.auth_user_id,
    message: `Activate your vendor portal for ${companyName ?? 'your community'}.`,
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  })
  if (error) fail(error.message)

  revalidatePath('/vendors')
  redirect(back + sep + 'invited=' + encodeURIComponent(email!))
}

const text = (f: FormData, k: string) => {
  const v = f.get(k)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}
const oneOf = <T extends string>(v: string | null, allowed: readonly T[], label: string): T | null => {
  if (v === null) return null
  if (!(allowed as readonly string[]).includes(v)) throw new Error(`Invalid ${label}.`)
  return v as T
}

// Edit a vendor record (contact, tax, accounting, payment, compliance).
// Re-checks scope inside the action: the vendor must belong to the caller's portfolio,
// and the default GL account must belong to that same portfolio.
export async function updateVendorRecord(formData: FormData) {
  const me = await requireWorkspaceStaff()
  const vendorId = text(formData, 'vendor_id')
  const failTo = (msg: string): never => redirect(`/vendors/${vendorId}/edit?error=${encodeURIComponent(msg)}`)
  if (!vendorId) redirect('/vendors?error=' + encodeURIComponent('Missing vendor.'))
  const portfolioId = me.portfolio?.id
  if (!portfolioId) failTo('Your account is not linked to a portfolio.')

  const supabase = (await createClient()) as any
  const { data: before } = await supabase
    .from('vendors').select('*').eq('id', vendorId).eq('portfolio_id', portfolioId).is('archived_at', null).maybeSingle()
  if (!before) failTo('Vendor not found.')
  // Internal notes live in staff-only vendor_private (the vendor reads its own row).
  await mergePrivateFieldsOne(supabase, 'vendor_private', 'vendor_id', ['notes'], before)

  const canEditBank = !!(me.is_finance_staff || me.is_company_admin || me.is_platform_operator)
  // Tax IDs and bank numbers live in vendor_financial_details (finance staff only).
  const { data: finBefore } = canEditBank
    ? await supabase.from('vendor_financial_details').select('*').eq('vendor_id', vendorId).maybeSingle()
    : { data: null }
  let patch: Record<string, unknown>
  let fin: Record<string, unknown> = {}
  try {
    const name = text(formData, 'name')
    if (!name) throw new Error('Vendor name is required.')
    // Keep phone entries this form doesn't edit (e.g. the vendor's own 'work' number from the portal).
    const phones: Array<{ type: string; number: string }> = (Array.isArray(before.phone_numbers) ? before.phone_numbers : [])
      .filter((p: any) => p && p.type !== 'landline' && p.type !== 'mobile')
    const landline = text(formData, 'phone_landline')
    const mobile = text(formData, 'phone_mobile')
    if (landline) phones.push({ type: 'landline', number: landline })
    if (mobile) phones.push({ type: 'mobile', number: mobile })
    const emails = (text(formData, 'emails') ?? '')
      .split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)
    for (const e of emails) if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error(`"${e}" is not a valid email address.`)

    const adjRaw = text(formData, 'work_order_adjustment')
    const adj = adjRaw === null ? 0 : Number(adjRaw)
    if (!Number.isFinite(adj) || adj < 0 || adj > 100) throw new Error('Work order adjustment must be between 0 and 100 percent.')

    const glId = text(formData, 'default_gl_account_id')
    if (glId) {
      const { data: gl } = await supabase.from('gl_accounts').select('id').eq('id', glId).eq('portfolio_id', portfolioId).maybeSingle()
      if (!gl) throw new Error('Default GL account not found.')
    }

    const tin = text(formData, 'taxpayer_id')
    const taxAcct = text(formData, 'tax_account_number')
    const routing = text(formData, 'bank_routing_number')
    if (routing && !/^\d{9}$/.test(routing)) throw new Error('Bank routing number must be 9 digits.')
    // Blank account number keeps the stored one; the page never echoes it back.
    const acct = text(formData, 'bank_account_number')
    if (acct && !/^\d{4,17}$/.test(acct)) throw new Error('Bank account number must be 4–17 digits.')

    patch = {
      name,
      vendor_type: oneOf(text(formData, 'vendor_type'), VENDOR_TYPES, 'vendor type') ?? 'general',
      trade: oneOf(text(formData, 'trade'), VENDOR_TRADES, 'trade') ?? 'other',
      phone_numbers: phones,
      emails,
      address_street: text(formData, 'address_street'),
      address_city: text(formData, 'address_city'),
      address_state: text(formData, 'address_state')?.toUpperCase() ?? null,
      address_zip: text(formData, 'address_zip'),
      taxpayer_name: text(formData, 'taxpayer_name'),
      send_1099: formData.get('send_1099') === 'on',
      is_utility: formData.get('is_utility') === 'on',
      check_consolidation: oneOf(text(formData, 'check_consolidation'), CHECK_CONSOLIDATION.map((o) => o.value), 'check consolidation'),
      check_stub_breakdown: oneOf(text(formData, 'check_stub_breakdown'), CHECK_STUB.map((o) => o.value), 'check stub breakdown'),
      hold_payments: formData.get('hold_payments') === 'on',
      email_echeck_receipt: formData.get('email_echeck_receipt') === 'on',
      payment_terms: text(formData, 'payment_terms'),
      default_check_memo: text(formData, 'default_check_memo'),
      default_gl_account_id: glId,
      work_order_adjustment: adj,
      payment_type: oneOf(text(formData, 'payment_type'), VENDOR_PAYMENT_TYPES, 'payment type') ?? 'check',
      savings_account: canEditBank ? formData.get('savings_account') === 'on' : before.savings_account,
      notes: text(formData, 'notes'),
      workers_comp_expiration: text(formData, 'workers_comp_expiration'),
      general_liability_expiration: text(formData, 'general_liability_expiration'),
      epa_certification_expiration: text(formData, 'epa_certification_expiration'),
      auto_insurance_expiration: text(formData, 'auto_insurance_expiration'),
      state_license_expiration: text(formData, 'state_license_expiration'),
      contract_expiration: text(formData, 'contract_expiration'),
    }
    if (canEditBank) {
      // Blank TIN / account number keep the stored value; the page never echoes them back.
      fin = { tax_account_number: taxAcct, bank_routing_number: routing }
      if (tin) fin.taxpayer_id = tin
      if (acct) fin.bank_account_number = acct
    } else if (tin || taxAcct || routing || acct) {
      throw new Error("Only accounting staff can change a vendor's tax or bank details.")
    }
  } catch (e) {
    return failTo(e instanceof Error ? e.message : 'Invalid vendor details.')
  }

  // New bank details must be verified again before ACH or auto-pay uses them.
  // (The vendor_financial_details trigger enforces this too.)
  const bankChanged = canEditBank && (['bank_routing_number', 'bank_account_number'] as const)
    .some((k) => k in fin && (finBefore?.[k] ?? null) !== (fin[k] ?? null))
  if (bankChanged) {
    Object.assign(patch, {
      ach_status: 'pending', ach_verified_at: null, ach_verified_by: null,
      ach_activated_at: null, ach_activated_by: null, is_auto_pay: false,
    })
  }

  // Notes go straight to vendor_private so clearing them works (a NULL on
  // vendors.notes would leave the stored note in place).
  const { notes, ...vendorPatch } = patch as Record<string, unknown> & { notes: string | null }
  const { error } = await supabase.from('vendors').update(vendorPatch).eq('id', vendorId).eq('portfolio_id', portfolioId)
  if (error) failTo(error.message)
  if ((before.notes ?? null) !== (notes ?? null)) {
    const notesError = await savePrivateFields(supabase, 'vendor_private', 'vendor_id', vendorId, { notes })
    if (notesError) failTo('Saved, but the internal notes could not be saved: ' + notesError.message)
  }

  const finChanged = Object.entries(fin).some(([k, v]) => (finBefore?.[k] ?? null) !== (v ?? null))
  if (canEditBank && finChanged) {
    const { error: finError } = await supabase.from('vendor_financial_details').upsert(
      { vendor_id: vendorId, portfolio_id: portfolioId, ...fin, updated_at: new Date().toISOString(), updated_by: me.auth_user_id },
      { onConflict: 'vendor_id' },
    )
    if (finError) failTo('Saved, but the tax and bank details could not be saved: ' + finError.message)
  }

  // Audit: bank and tax identifiers are logged as changed, never with their values.
  const SENSITIVE = new Set(['bank_routing_number', 'bank_account_number', 'taxpayer_id', 'tax_account_number'])
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const [k, v] of Object.entries({ ...patch, ...fin })) {
    const was = (k in fin ? finBefore?.[k] : before[k]) ?? null
    if (JSON.stringify(was) === JSON.stringify(v ?? null)) continue
    changes[k] = SENSITIVE.has(k) ? { from: '[redacted]', to: '[redacted]' } : { from: was, to: v ?? null }
  }
  if (Object.keys(changes).length) {
    const { error: auditError } = await (createServiceClient() as any).from('audit_logs').insert({
      entity_type: 'vendor', entity_id: vendorId, action: 'vendor_updated',
      actor_id: me.auth_user_id, actor_email: me.email ?? null, changes,
    })
    if (auditError) failTo('Saved, but the audit event could not be recorded: ' + auditError.message)
  }

  revalidatePath(`/vendors/${vendorId}`)
  revalidatePath('/vendors')
  redirect(`/vendors/${vendorId}?saved=1`)
}
