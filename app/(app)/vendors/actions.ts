'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth/me'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Invite a vendor to the vendor portal. Creates a real user_invitations row so
// the vendor gets the /invite link, sets a password, and can log in. We use
// hoa_role 'owner' (a non-staff role) because there is no 'vendor' hoa_role and
// login routing checks vendor_id BEFORE owner_id — so once auto_link_portal_user
// links the vendor by email on signup, they land on /vendor.
export async function inviteVendorToPortal(formData: FormData) {
  const me = await requireStaff()
  const vendorId = formData.get('vendor_id') as string
  const fail = (msg: string) => redirect('/vendors?error=' + encodeURIComponent(msg))

  if (!vendorId) fail('Missing vendor.')
  if (!me.portfolio?.id) fail('Your account is not linked to a portfolio.')

  const supabase = await createClient()
  const db = supabase as any
  const { data: vendor } = await db
    .from('vendors')
    .select('id, name, emails')
    .eq('id', vendorId)
    .maybeSingle()
  if (!vendor) fail('Vendor not found.')

  const emails: string[] = Array.isArray(vendor.emails) ? vendor.emails : []
  const email = emails.find((e) => typeof e === 'string' && e.includes('@'))
  if (!email) fail('This vendor has no email on file. Add one before inviting them to the portal.')

  const svc = createServiceClient() as any
  // Supersede any older pending invite for this email so only one link is live.
  await svc
    .from('user_invitations')
    .update({ status: 'revoked' })
    .eq('email', email!.toLowerCase())
    .eq('portfolio_id', me.portfolio.id)
    .eq('status', 'pending')

  const { error } = await svc.from('user_invitations').insert({
    portfolio_id: me.portfolio.id,
    email: email!.toLowerCase(),
    full_name: vendor.name,
    hoa_role: 'owner',
    invited_by: me.auth_user_id,
    message: `Activate your vendor portal for ${me.portfolio?.company_name ?? 'your community'}.`,
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  })
  if (error) fail(error.message)

  revalidatePath('/vendors')
  redirect('/vendors?invited=' + encodeURIComponent(email!))
}
