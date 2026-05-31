'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function submitPlatformRequest(formData: FormData) {
  const me = await requireCompanyAdmin();
  const supabase = await createClient();
  const db = supabase as any;

  const requestType = formData.get('request_type') as string;
  const priority = formData.get('priority') as string;
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;

  if (!requestType || !priority || !title || !description) {
    throw new Error('All fields are required.');
  }

  const { error } = await db.from('platform_requests').insert({
    portfolio_id: me.portfolio?.id,
    request_type: requestType,
    priority,
    title,
    description,
    status: 'open',
    submitted_by: me.profile?.id,
  } as any);

  if (error) {
    throw new Error(`Failed to submit request: ${error.message}`);
  }

  revalidatePath('/company-admin/platform-requests');
  redirect('/company-admin/platform-requests');
}
