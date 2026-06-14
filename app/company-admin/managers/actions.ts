'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Company admin invites a manager into their own portfolio.
export async function inviteManager(formData: FormData) {
  const me = await requirePortfolioAdmin()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const roleName = (formData.get('role_name') as string) || 'Property Manager'

  const fail = (msg: string) => redirect('/company-admin/managers?error=' + encodeURIComponent(msg))
  if (!email) fail('Enter an email address to invite.')
  if (!me.portfolio?.id) fail('Your account is not linked to a portfolio.')

  const supabase = await createClient()
  const { error } = await (supabase as any).rpc('invite_staff', {
    p_portfolio_id: me.portfolio!.id,
    p_email: email,
    p_role_name: roleName,
    p_message: `You have been invited to manage associations for ${me.portfolio?.company_name ?? 'your company'}.`,
  })
  if (error) fail(error.message)

  revalidatePath('/company-admin/managers')
  redirect('/company-admin/managers?invited=' + encodeURIComponent(email))
}
