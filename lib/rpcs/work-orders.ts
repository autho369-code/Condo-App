'use server';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceOrPortfolioAdmin, requireStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { notifyOwnerOfStatusChange } from '@/lib/notifications/status-change';
import { workOrderStaff } from '@/lib/maintenance/staff';
import { todayInZone } from '@/lib/time/zoned';
import { claimSubmission, completeSubmission, releaseSubmission } from '@/lib/forms/submission';

async function accessibleWorkOrder(db: any, workOrderId: string) {
  return db
    .from('work_orders')
    .select('id, portfolio_id')
    .eq('id', workOrderId)
    .maybeSingle();
}

export async function updateWorkOrderStatus(workOrderId: string, newStatus: string, note?: string) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const supabase = await createClient();
  const failTo = (msg: string) => {
    redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(msg)}`);
  };
  // completed_date is stamped by the work_order_stamp_completion trigger in
  // the work order's own association time zone (and cleared on cancel/reopen).
  const patch: Record<string, unknown> = { status: newStatus };

  const { data: updated, error: e1 } = await (supabase as any)
    .from('work_orders')
    .update(patch)
    .eq('id', workOrderId)
    .select('id')
    .maybeSingle();
  if (e1 || !updated) { failTo(e1?.message ?? 'Work order not found or not accessible.'); return; }

  const { error: activityError } = await (supabase as any).from('work_order_updates').insert({
    work_order_id: workOrderId,
    note: note || `Status changed to ${newStatus}`,
    new_status: newStatus,
  });
  if (activityError) { failTo(`Status changed, but its activity entry could not be recorded: ${activityError.message}`); return; }
  // Auto keep homeowner informed — never fails the action (helper never throws)
  await notifyOwnerOfStatusChange({ kind: 'work_order', id: workOrderId, newStatus });
  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath('/work-orders');
}

export async function updateWorkOrder(workOrderId: string, formData: FormData) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const supabase = await createClient();
  const failTo = (msg: string) => {
    redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(msg)}`);
  };

  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === 'string' && v !== '' ? v : null;
  };

  const patch: Record<string, unknown> = {
    title:                  str('title'),
    issue:                  str('issue'),
    description:            str('description'),
    priority:               str('priority'),
    category:               str('category'),
    trade:                  str('trade'),
    scheduled_date:         str('scheduled_date'),
    scheduled_time:         str('scheduled_time'),
    // assigned_to is maintained by assignWorkOrderToStaff with assignee_id.
    requested_by:           str('requested_by'),
    owner_availability: str('owner_availability'),
    next_followup_date:     str('next_followup_date'),
  };
  // Only write fields this form actually submitted: the edit form has no
  // `description` input, so writing every key nulled the original description
  // (and any other field a form leaves out) on each save.
  for (const k of Object.keys(patch)) if (!formData.has(k)) delete patch[k];
  // Drop null-out of required fields — title can't be null
  if (!patch.title) delete patch.title;

  const { data: updated, error } = await (supabase as any)
    .from('work_orders')
    .update(patch)
    .eq('id', workOrderId)
    .select('id')
    .maybeSingle();
  if (error || !updated) { failTo(error?.message ?? 'Work order not found or not accessible.'); return; }

  // Vendor instructions live in work_order_vendor_private (staff + the
  // assigned vendor; owners, residents and board read the work order row).
  if (formData.has('vendor_instructions')) {
    const { error: instructionsError } = await (supabase as any).from('work_order_vendor_private').upsert({
      work_order_id: workOrderId,
      vendor_instructions: str('vendor_instructions'),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'work_order_id' });
    if (instructionsError) { failTo(`Details saved, but the vendor instructions could not be saved: ${instructionsError.message}`); return; }
  }

  // Internal notes live in the staff-only work_order_private table.
  if (formData.has('internal_notes')) {
    const { error: notesError } = await (supabase as any).from('work_order_private').upsert({
      work_order_id: workOrderId,
      internal_notes: str('internal_notes'),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'work_order_id' });
    if (notesError) { failTo(`Details saved, but the internal notes could not be saved: ${notesError.message}`); return; }
  }

  const { error: activityError } = await (supabase as any).from('work_order_updates').insert({
    work_order_id: workOrderId,
    note: 'Work order details updated',
  });
  if (activityError) { failTo(`Details changed, but the activity entry could not be recorded: ${activityError.message}`); return; }
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function assignVendor(workOrderId: string, formData: FormData) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const supabase = await createClient();
  const failTo = (msg: string) => {
    redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(msg)}`);
  };
  const vendorId = formData.get('vendor_id') as string;
  const note     = (formData.get('note') as string) || null;
  const bumpStatus = formData.get('bump_status') === 'on';

  if (!vendorId) { failTo('Vendor is required'); return; }

  // Both reads use the caller's session/RLS. The explicit portfolio comparison
  // prevents a vendor id from another tenant being assigned even if a future
  // policy accidentally makes that vendor visible.
  const [{ data: workOrder, error: workOrderError }, { data: vendor, error: vendorError }] = await Promise.all([
    (supabase as any).from('work_orders').select('id, portfolio_id').eq('id', workOrderId).maybeSingle(),
    (supabase as any).from('vendors').select('id, name, portfolio_id').eq('id', vendorId).maybeSingle(),
  ]);
  if (workOrderError || !workOrder) { failTo(workOrderError?.message ?? 'Work order not found or not accessible.'); return; }
  if (vendorError || !vendor) { failTo(vendorError?.message ?? 'Vendor not found or not accessible.'); return; }
  if (!workOrder.portfolio_id || vendor.portfolio_id !== workOrder.portfolio_id) {
    failTo('The selected vendor does not belong to the work order portfolio.');
    return;
  }

  const patch: Record<string, unknown> = { vendor_id: vendorId };
  if (bumpStatus) patch.status = 'assigned';

  const { data: updated, error } = await (supabase as any)
    .from('work_orders')
    .update(patch)
    .eq('id', workOrderId)
    .eq('portfolio_id', workOrder.portfolio_id)
    .select('id')
    .maybeSingle();
  if (error || !updated) { failTo(error?.message ?? 'Work order was not updated in this portfolio.'); return; }

  // The generic "Assigned to vendor" line is visible to the vendor; a
  // manager-typed note (often the reason a previous vendor was dropped) is
  // staff-only so the newly assigned vendor never reads it.
  const activityRows: Record<string, unknown>[] = [{
    work_order_id: workOrderId,
    note: `Assigned to vendor${vendor?.name ? ': ' + vendor.name : ''}`,
    new_status: bumpStatus ? 'assigned' : null,
  }];
  if (note?.trim()) {
    activityRows.push({ work_order_id: workOrderId, note: note.trim(), staff_only: true });
  }
  const { error: activityError } = await (supabase as any).from('work_order_updates').insert(activityRows);
  if (activityError) { failTo(`Vendor assigned, but the activity entry could not be recorded: ${activityError.message}`); return; }
  // Auto keep homeowner informed when assignment also changed the status
  if (bumpStatus) {
    await notifyOwnerOfStatusChange({ kind: 'work_order', id: workOrderId, newStatus: 'assigned' });
  }
  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath('/work-orders');
}

export async function unassignVendor(workOrderId: string) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const supabase = await createClient();
  const { data: updated, error } = await (supabase as any)
    .from('work_orders')
    .update({ vendor_id: null })
    .eq('id', workOrderId)
    .select('id')
    .maybeSingle();
  if (error || !updated) { redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(error?.message ?? 'Work order not found or not accessible.')}`); return; }
  const { error: activityError } = await (supabase as any).from('work_order_updates').insert({
    work_order_id: workOrderId,
    note: 'Vendor unassigned',
  });
  if (activityError) { redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(`Vendor unassigned, but the activity entry could not be recorded: ${activityError.message}`)}`); return; }
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function addLaborEntry(workOrderId: string, formData: FormData) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const supabase = await createClient();
  const { data: workOrder, error: workOrderError } = await accessibleWorkOrder(supabase as any, workOrderId);
  if (workOrderError || !workOrder) {
    redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(workOrderError?.message ?? 'Work order not found or not accessible.')}`);
    return;
  }
  // A team member picked from the list (counted on the team scoreboard), or a
  // typed name for someone without an account (e.g. a day helper).
  const techId = String(formData.get('tech_id') ?? '');
  let techName = String(formData.get('tech_name') ?? '').trim();
  if (techId) {
    const staffName = (await workOrderStaff(supabase as any, workOrderId)).get(techId);
    if (!staffName) { redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent('That person can’t see this association’s work orders')}`); return; }
    techName = staffName;
  }
  if (!techName) { redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent('Pick a team member or type a name')}`); return; }
  const dateWorked = String(formData.get('date_worked') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateWorked) || dateWorked > todayInZone()) {
    redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent('Pick the day the work was done (not a future date)')}`); return;
  }
  const { error } = await (supabase as any).from('work_order_labor_entries').insert({
    work_order_id: workOrderId,
    tech_id:       techId || null,
    tech_name:     techName,
    date_worked:   formData.get('date_worked') as string,
    hours:         parseFloat(formData.get('hours') as string),
    description:   (formData.get('description') as string) || null,
    hourly_rate:   parseFloat(formData.get('hourly_rate') as string) || null,
  });
  if (error) { redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(error.message)}`); return; }
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function addEstimate(workOrderId: string, formData: FormData) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const supabase = await createClient();
  const vendorId = (formData.get('vendor_id') as string) || null;
  const { data: workOrder, error: workOrderError } = await accessibleWorkOrder(supabase as any, workOrderId);
  if (workOrderError || !workOrder) {
    redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(workOrderError?.message ?? 'Work order not found or not accessible.')}`);
    return;
  }
  if (vendorId) {
    const { data: vendor, error: vendorError } = await (supabase as any)
      .from('vendors')
      .select('id, portfolio_id')
      .eq('id', vendorId)
      .maybeSingle();
    if (vendorError || !vendor || !workOrder.portfolio_id || vendor.portfolio_id !== workOrder.portfolio_id) {
      redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(vendorError?.message ?? 'Estimate vendor is not accessible in this work order portfolio.')}`);
      return;
    }
  }
  const { error } = await (supabase as any).from('work_order_estimates').insert({
    work_order_id: workOrderId,
    vendor_id:     vendorId,
    amount:        parseFloat(formData.get('amount') as string),
    notes:         (formData.get('notes') as string) || null,
  });
  if (error) { redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(error.message)}`); return; }
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function approveEstimate(estimateId: string, workOrderId: string) {
  const me = await requireStaff();  // in-action guard: server actions are callable endpoints
  const supabase = await createClient();
  const { data: workOrder, error: workOrderError } = await accessibleWorkOrder(supabase as any, workOrderId);
  if (workOrderError || !workOrder) {
    redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(workOrderError?.message ?? 'Work order not found or not accessible.')}`);
    return;
  }
  const { data: updated, error } = await (supabase as any).from('work_order_estimates')
    .update({ approved_at: new Date().toISOString(), approved_by: me.auth_user_id })
    .eq('id', estimateId)
    .eq('work_order_id', workOrderId)
    // A rejected or already-approved estimate keeps its decision.
    .is('approved_at', null)
    .is('rejected_at', null)
    .select('id')
    .maybeSingle();
  if (error || !updated) { redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(error?.message ?? 'Estimate not found, already decided, or not accessible for this work order.')}`); return; }
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function addNote(workOrderId: string, formData: FormData) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const supabase = await createClient();
  const { data: workOrder, error: workOrderError } = await accessibleWorkOrder(supabase as any, workOrderId);
  if (workOrderError || !workOrder) {
    redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(workOrderError?.message ?? 'Work order not found or not accessible.')}`);
    return;
  }
  // Staff notes are internal: vendors only see status activity and messages.
  const { error } = await (supabase as any).from('work_order_updates').insert({
    work_order_id: workOrderId,
    note: formData.get('note') as string,
    staff_only: true,
  });
  if (error) { redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(error.message)}`); return; }
  revalidatePath(`/work-orders/${workOrderId}`);
}

/**
 * Create a new work order from a service request.
 * Used by staff to triage owner-submitted requests.
 */
export async function createWorkOrderFromServiceRequest(serviceRequestId: string, formData: FormData) {
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const supabase = await createClient();

  const { data: sr, error: srErr } = await (supabase as any).from('service_requests')
    .select('id, portfolio_id, association_id, unit_id, description, priority')
    .eq('id', serviceRequestId).maybeSingle();
  if (srErr || !sr) return { error: srErr?.message ?? 'Service request not found' };

  const title    = (formData.get('title') as string) || sr.description.slice(0, 80);
  const category = (formData.get('category') as string) || 'other';
  const trade    = (formData.get('trade') as string) || null;
  const vendorId = (formData.get('vendor_id') as string) || null;
  const scheduledDate = (formData.get('scheduled_date') as string) || null;

  if (vendorId) {
    const { data: vendor, error: vendorError } = await (supabase as any)
      .from('vendors')
      .select('id, portfolio_id')
      .eq('id', vendorId)
      .maybeSingle();
    if (vendorError || !vendor || !sr.portfolio_id || vendor.portfolio_id !== sr.portfolio_id) {
      return { error: vendorError?.message ?? 'The selected vendor is not accessible in the service request portfolio.' };
    }
  }

  const { data: wo, error } = await (supabase as any).from('work_orders').insert({
    portfolio_id:       sr.portfolio_id,
    association_id:     sr.association_id,
    unit_id:            sr.unit_id,
    service_request_id: serviceRequestId,
    title,
    issue:              sr.description,
    category,
    trade,
    priority:           sr.priority,
    vendor_id:          vendorId,
    scheduled_date:     scheduledDate,
    status:             vendorId ? 'assigned' : 'new',
  }).select('id').single();
  if (error || !wo) return { error: error?.message ?? 'Failed to create work order' };

  const { error: activityError } = await (supabase as any).from('work_order_updates').insert({
    work_order_id: wo.id,
    note: `Work order created from service request #${serviceRequestId.slice(0, 8)}`,
    new_status: vendorId ? 'assigned' : 'new',
  });
  if (activityError) return { error: `Work order created, but its activity entry could not be recorded: ${activityError.message}` };

  revalidatePath('/work-orders');
  redirect(`/work-orders/${wo.id}`);
}

/** Bill the cost of an owner-caused repair back to the unit's owner ledger. */
export async function chargeBackWorkOrder(workOrderId: string, formData: FormData) {
  // Finance staff and company admins (both pass can_manage_finance in the RPC,
  // which re-checks finance + association scope).
  await requireFinanceOrPortfolioAdmin();
  const back = `/work-orders/${workOrderId}`;
  const amount = Number(String(formData.get('amount') ?? '').replace(/[$,\s]/g, ''));
  const categoryId = String(formData.get('charge_category_id') ?? '');
  const dueDate = String(formData.get('due_date') ?? '') || null;
  if (!Number.isFinite(amount) || amount <= 0) redirect(`${back}?error=${encodeURIComponent('Enter an amount above zero')}`);
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) redirect(`${back}?error=${encodeURIComponent('Pick a valid due date')}`);
  const supabase = await createClient();
  const db = supabase as any;
  // The RPC never checks for an earlier chargeback: a double click or a
  // re-sent form would bill the owner twice.
  const claim = await claimSubmission(db, formData, 'work_order_chargeback');
  if (claim.status === 'error') redirect(`${back}?error=${encodeURIComponent(claim.message)}`);
  if (claim.status === 'duplicate') {
    redirect(`${back}?error=${encodeURIComponent(claim.resultId ? 'This chargeback was already posted.' : 'This chargeback is already being posted. Refresh in a moment to see it.')}`);
  }
  const token = (claim as { token: string }).token;
  const { data: charge, error } = await db.rpc('charge_back_work_order', {
    p_work_order: workOrderId,
    p_category: categoryId,
    p_amount: amount,
    p_description: String(formData.get('description') ?? ''),
    p_due_date: dueDate,
  });
  if (error) {
    await releaseSubmission(db, token);
    redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  }
  const chargeId = Array.isArray(charge) ? charge[0]?.id : (charge?.id ?? charge);
  if (typeof chargeId === 'string') await completeSubmission(db, token, chargeId);
  revalidatePath(back);
  redirect(`${back}?saved=chargeback`);
}

