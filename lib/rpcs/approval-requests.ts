'use server';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Record the board's decision on a general approval request (one not behind a
 * bill or purchase order; those are decided on their own page). The board
 * portal is read-only, so staff record what the board decided.
 */
export async function recordApprovalRequestDecision(formData: FormData) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const associationId = String(formData.get('association_id') ?? '');
  const requestId = String(formData.get('approval_request_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000);
  if (!UUID.test(associationId)) redirect('/associations');
  const back = `/associations/${associationId}/approvals`;
  const failTo = (msg: string): never => redirect(`${back}?error=${encodeURIComponent(msg)}`);
  if (!UUID.test(requestId)) failTo('Approval request not found.');
  if (decision !== 'approved' && decision !== 'rejected') failTo('Choose whether the board approved or rejected the request.');

  const supabase = (await createClient()) as any;
  // The request must belong to this association and not be behind a bill or PO.
  const { data: request } = await supabase
    .from('approval_requests').select('id').eq('id', requestId).eq('association_id', associationId).maybeSingle();
  if (!request) failTo('Approval request not found.');
  // (Bills and POs are finance-only reads, so ask the database.)
  const { data: moneyIds, error: linkError } = await supabase.rpc('money_approval_request_ids', { p_ids: [requestId] });
  if (linkError) failTo(linkError.message);
  if ((moneyIds ?? []).length) failTo('Record this decision on its bill or purchase order.');

  // The RPC re-checks access to the association, that the request is still
  // pending, and records who recorded the decision.
  const { error } = await supabase.rpc('record_approval_decision', { p_request_id: requestId, p_decision: decision, p_note: note || null });
  if (error) failTo(error.message);
  revalidatePath(back);
  redirect(`${back}?saved=decision`);
}
