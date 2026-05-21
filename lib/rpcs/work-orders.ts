'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function updateWorkOrderStatus(workOrderId: string, newStatus: string, note?: string) {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'completed' || newStatus === 'closed') {
    patch.completed_date = new Date().toISOString().slice(0, 10);
  } else if (newStatus === 'cancelled') {
    patch.completed_date = null;
  }

  const { error: e1 } = await (supabase as any).from('work_orders').update(patch).eq('id', workOrderId);
  if (e1) return { error: e1.message };

  await (supabase as any).from('work_order_updates').insert({
    work_order_id: workOrderId,
    note: note || `Status changed to ${newStatus}`,
    new_status: newStatus,
  });
  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath('/work-orders');
}

export async function updateWorkOrder(workOrderId: string, formData: FormData) {
  const supabase = await createClient();

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

  const { error } = await (supabase as any).from('work_orders').update(patch).eq('id', workOrderId);
  if (error) return { error: error.message };

  await (supabase as any).from('work_order_updates').insert({
    work_order_id: workOrderId,
    note: 'Work order details updated',
  });
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function assignVendor(workOrderId: string, formData: FormData) {
  const supabase = await createClient();
  const vendorId = formData.get('vendor_id') as string;
  const note     = (formData.get('note') as string) || null;
  const bumpStatus = formData.get('bump_status') === 'on';

  if (!vendorId) return { error: 'Vendor is required' };

  // Look up vendor name for the activity log
  const { data: vendor } = await (supabase as any).from('vendors').select('name').eq('id', vendorId).maybeSingle();

  const patch: Record<string, unknown> = { vendor_id: vendorId };
  if (bumpStatus) patch.status = 'assigned';

  const { error } = await (supabase as any).from('work_orders').update(patch).eq('id', workOrderId);
  if (error) return { error: error.message };

  await (supabase as any).from('work_order_updates').insert({
    work_order_id: workOrderId,
    note: note || `Assigned to vendor${vendor?.name ? ': ' + vendor.name : ''}`,
    new_status: bumpStatus ? 'assigned' : null,
  });
  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath('/work-orders');
}

export async function unassignVendor(workOrderId: string) {
  const supabase = await createClient();
  const { error } = await (supabase as any).from('work_orders').update({ vendor_id: null }).eq('id', workOrderId);
  if (error) return { error: error.message };
  await (supabase as any).from('work_order_updates').insert({
    work_order_id: workOrderId,
    note: 'Vendor unassigned',
  });
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function addLaborEntry(workOrderId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await (supabase as any).from('work_order_labor_entries').insert({
    work_order_id: workOrderId,
    tech_name:     formData.get('tech_name') as string,
    date_worked:   formData.get('date_worked') as string,
    hours:         parseFloat(formData.get('hours') as string),
    description:   (formData.get('description') as string) || null,
    hourly_rate:   parseFloat(formData.get('hourly_rate') as string) || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function addEstimate(workOrderId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await (supabase as any).from('work_order_estimates').insert({
    work_order_id: workOrderId,
    vendor_id:     (formData.get('vendor_id') as string) || null,
    amount:        parseFloat(formData.get('amount') as string),
    notes:         (formData.get('notes') as string) || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function approveEstimate(estimateId: string, workOrderId: string) {
  const supabase = await createClient();
  const { error } = await (supabase as any).from('work_order_estimates')
    .update({ approved_at: new Date().toISOString() })
    .eq('id', estimateId);
  if (error) return { error: error.message };
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function addNote(workOrderId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await (supabase as any).from('work_order_updates').insert({
    work_order_id: workOrderId,
    note: formData.get('note') as string,
  });
  if (error) return { error: error.message };
  revalidatePath(`/work-orders/${workOrderId}`);
}

/**
 * Create a new work order from a service request.
 * Used by staff to triage owner-submitted requests.
 */
export async function createWorkOrderFromServiceRequest(serviceRequestId: string, formData: FormData) {
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

  await (supabase as any).from('work_order_updates').insert({
    work_order_id: wo.id,
    note: `Work order created from service request #${serviceRequestId.slice(0, 8)}`,
    new_status: vendorId ? 'assigned' : 'new',
  });

  revalidatePath('/work-orders');
  redirect(`/work-orders/${wo.id}`);
}
