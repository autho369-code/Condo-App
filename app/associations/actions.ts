'use server'

import { createClient } from '@/lib/supabase/server'
import { associationSchema } from '@/lib/schemas/association'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createAssociation(formData: FormData) {
  const parsed = associationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors }
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: { _: ['Not signed in'] } }

  const { error } = await supabase
    .from('associations')
    .insert({ ...parsed.data, created_by: user.id })

  if (error) return { ok: false, error: { _: [error.message] } }

  revalidatePath('/associations')
  redirect('/associations')
}
