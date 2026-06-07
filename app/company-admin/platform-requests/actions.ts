'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { revalidatePath } from 'next/cache'

export async function submitPlatformRequest(formData: FormData) {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any

  const request_type = formData.get('request_type') as string
  const priority = formData.get('priority') as string
  const subject = formData.get('subject') as string
  const description = formData.get('description') as string

  if (!request_type || !priority || !subject || !description) {
    return { error: 'All fields are required.' }
  }

  try {
    const { error } = await db.from('platform_requests').insert({
      portfolio_id: me.portfolio.id,
      request_type,
      priority,
      subject,
      description,
      status: 'open',
    })

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/company-admin/platform-requests')
    return { success: true }
  } catch (err: any) {
    return { error: err?.message ?? 'Failed to submit request.' }
  }
}
