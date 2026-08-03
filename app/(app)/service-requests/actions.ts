'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export async function triageServiceRequest(serviceRequestId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('triage_service_request_to_work_order', {
    p_service_request_id: serviceRequestId,
  });
  if (error || !data) {
    redirect(`/service-requests?error=${encodeURIComponent(error?.message ?? 'The work order could not be created.')}`);
  }
  revalidatePath('/service-requests');
  revalidatePath('/work-orders');
  redirect(`/work-orders/${data}`);
}
