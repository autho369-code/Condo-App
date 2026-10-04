'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { revalidatePath } from 'next/cache'
import { validatePlatformRequest } from '@/lib/company-admin/platform-requests'

// Called from the page's client-side form handler (not a plain <form action>),
// so returning { error } is surfaced to the user in the page.
export async function submitPlatformRequest(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const me = await requirePortfolioAdmin()
  // Only a company admin of an active company can file a request (the RLS
  // insert policy also requires is_company_admin()).
  if (!me.is_company_admin || !me.portfolio?.id) {
    return { error: 'Company administrator access is required to submit platform requests.' }
  }

  const parsed = validatePlatformRequest({
    request_type: formData.get('request_type'),
    priority: formData.get('priority'),
    subject: formData.get('subject'),
    description: formData.get('description'),
  })
  if ('error' in parsed) return { error: parsed.error }

  const supabase = await createClient()
  const db = supabase as any

  try {
    const { error } = await db.from('platform_requests').insert({
      portfolio_id: me.portfolio.id,
      request_type: parsed.request_type,
      priority: parsed.priority,
      title: parsed.title,
      description: parsed.description,
      status: 'open',
      submitted_by: me.auth_user_id,
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
