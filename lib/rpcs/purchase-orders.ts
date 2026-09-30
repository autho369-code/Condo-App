'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFinanceStaff, requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export type PurchaseOrderLineInput = {
  description: string;
  qty: number;
  unit_price: number;
  gl_account_id: string | null;
};

function parseLines(raw: FormDataEntryValue | null): PurchaseOrderLineInput[] | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((l: any) => ({
      description: String(l?.description ?? '').trim(),
      qty: Number(l?.qty),
      unit_price: Number(l?.unit_price),
      gl_account_id: typeof l?.gl_account_id === 'string' && l.gl_account_id ? l.gl_account_id : null,
    }));
  } catch {
    return null;
  }
}

/** Create or edit a draft PO. Submitting routes it by the association's approval rules. */
export async function savePurchaseOrder(formData: FormData) {
  const me = await requireFinanceStaff(); // in-action guard: server actions are callable endpoints
  const id = (formData.get('id') as string) || null;
  const back = id ? `/purchase-orders/${id}/edit` : '/purchase-orders/new';
  const failTo = (msg: string) => redirect(`${back}?error=${encodeURIComponent(msg)}`);

  const portfolioId = me.portfolio?.id;
  if (!portfolioId) failTo('Your account is not linked to a portfolio.');
  const lines = parseLines(formData.get('lines'));
  if (!lines || lines.length === 0) failTo('Add at least one line item.');

  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('save_purchase_order', {
    p_purchase_order_id: id,
    p_portfolio_id: portfolioId,
    p_association_id: (formData.get('association_id') as string) || null,
    p_vendor_id: (formData.get('vendor_id') as string) || null,
    p_work_order_id: (formData.get('work_order_id') as string) || null,
    p_number: (formData.get('number') as string) || null,
    p_description: (formData.get('description') as string) || null,
    p_needed_by: (formData.get('needed_by') as string) || null,
    p_notes: (formData.get('notes') as string) || null,
    p_lines: lines,
    p_submit: formData.get('intent') === 'submit',
  });
  if (error) failTo(error.message);

  revalidatePath('/purchase-orders');
  redirect(`/purchase-orders/${data}`);
}

export async function submitPurchaseOrder(formData: FormData) {
  await requireFinanceStaff();
  const id = formData.get('id') as string;
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('submit_purchase_order', { p_purchase_order_id: id });
  if (error) redirect(`/purchase-orders/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/purchase-orders');
  redirect(`/purchase-orders/${id}`);
}

export async function cancelPurchaseOrder(formData: FormData) {
  await requireFinanceStaff();
  const id = formData.get('id') as string;
  const reason = ((formData.get('reason') as string) ?? '').trim();
  if (!reason) redirect(`/purchase-orders/${id}?error=${encodeURIComponent('Enter a reason to cancel this purchase order.')}`);
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('cancel_purchase_order', { p_purchase_order_id: id, p_reason: reason });
  if (error) redirect(`/purchase-orders/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/purchase-orders');
  redirect(`/purchase-orders/${id}`);
}

/**
 * Bill an approved PO. bill_purchase_order re-checks finance access and
 * association scope, and a trigger refuses bills that would exceed the PO
 * total; po_billed and the billed status follow automatically.
 */
export async function billPurchaseOrder(formData: FormData) {
  await requireFinanceStaff();
  const id = ((formData.get('id') as string) ?? '').trim();
  const back = `/purchase-orders/${id}`;
  const amount = Number(((formData.get('amount') as string) ?? '').replace(/[$,\s]/g, ''));
  const billDate = ((formData.get('bill_date') as string) ?? '').trim();
  const dueDate = ((formData.get('due_date') as string) ?? '').trim();
  const gl = ((formData.get('gl_account_id') as string) ?? '').trim();
  if (!Number.isFinite(amount) || amount <= 0) redirect(`${back}?error=${encodeURIComponent('Enter the bill amount.')}`);
  const iso = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('bill_purchase_order', {
    p_po_id: id,
    p_bill_number: ((formData.get('bill_number') as string) ?? '').trim() || null,
    p_bill_date: iso(billDate),
    p_due_date: iso(dueDate),
    p_amount: Math.round(amount * 100) / 100,
    p_gl_account_id: /^[0-9a-f-]{36}$/i.test(gl) ? gl : null,
    p_memo: ((formData.get('memo') as string) ?? '').trim() || null,
    p_submit_for_approval: formData.get('submit_for_approval') === 'on',
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(back);
  revalidatePath('/purchase-orders');
  revalidatePath('/bills');
  redirect(`/bills/${data}`);
}

/** Association spending authority: which bills and POs need a board vote. */
export async function saveBoardApprovalSettings(formData: FormData) {
  await requireStaff(); // the RPC enforces full-access staff + portfolio scope and audits the change
  const associationId = formData.get('association_id') as string;
  const back = `/associations/${associationId}/board`;
  const num = (key: string) => {
    const raw = ((formData.get(key) as string) ?? '').trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  };
  const billsThreshold = num('bills_threshold');
  const posThreshold = num('pos_threshold');
  const percentage = num('percentage_required');
  if ([billsThreshold, posThreshold, percentage].some((n) => Number.isNaN(n))) {
    redirect(`${back}?error=${encodeURIComponent('Thresholds and percentages must be numbers.')}`);
  }

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('set_board_approval_settings', {
    p_association_id: associationId,
    p_signatures_required: formData.get('signatures_required') === 'on',
    p_voting_scheme: formData.get('voting_scheme') as string,
    p_percentage_required: percentage,
    p_bills_mode: formData.get('bills_mode') as string,
    p_bills_threshold: billsThreshold,
    p_pos_mode: formData.get('pos_mode') as string,
    p_pos_threshold: posThreshold,
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}
