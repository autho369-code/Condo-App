'use server';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { notifyOwnerOfStatusChange } from '@/lib/notifications/status-change';

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
  const patch: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'completed' || newStatus === 'closed') {
    patch.completed_date = new Date().toISOString().slice(0, 10);
  } else if (newStatus === 'cancelled') {
    patch.completed_date = null;
  }

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
    assigned_to:            str('assigned_to'),
    requested_by:           str('requested_by'),
    vendor_instructions:    str('vendor_instructions'),
    owner_availability: str('owner_availability'),
    internal_notes:         str('internal_notes'),
    next_followup_date:     str('next_followup_date'),
  };
  // Drop null-out of required fields — title can't be null
  if (!patch.title) delete patch.title;

  const { data: updated, error } = await (supabase as any)
    .from('work_orders')
    .update(patch)
    .eq('id', workOrderId)
    .select('id')
    .maybeSingle();
  if (error || !updated) { failTo(error?.message ?? 'Work order not found or not accessible.'); return; }

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

  const { error: activityError } = await (supabase as any).from('work_order_updates').insert({
    work_order_id: workOrderId,
    note: note || `Assigned to vendor${vendor?.name ? ': ' + vendor.name : ''}`,
    new_status: bumpStatus ? 'assigned' : null,
  });
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
  const { error } = await (supabase as any).from('work_order_labor_entries').insert({
    work_order_id: workOrderId,
    tech_name:     formData.get('tech_name') as string,
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
  await requireStaff();  // in-action guard: server actions are callable endpoints
  const supabase = await createClient();
  const { data: workOrder, error: workOrderError } = await accessibleWorkOrder(supabase as any, workOrderId);
  if (workOrderError || !workOrder) {
    redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(workOrderError?.message ?? 'Work order not found or not accessible.')}`);
    return;
  }
  const { data: updated, error } = await (supabase as any).from('work_order_estimates')
    .update({ approved_at: new Date().toISOString() })
    .eq('id', estimateId)
    .eq('work_order_id', workOrderId)
    .select('id')
    .maybeSingle();
  if (error || !updated) { redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(error?.message ?? 'Estimate not found or not accessible for this work order.')}`); return; }
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
  const { error } = await (supabase as any).from('work_order_updates').insert({
    work_order_id: workOrderId,
    note: formData.get('note') as string,
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
