// Purchase order approval email: when a purchase order is approved (within
// the manager's spending authority at submit, or by the board decision staff
// record), the vendor gets the order by email.
//
// White-labeled like the vendor assignment email (vendor-assignment.ts): the
// company's name, its support address as reply-to. The vendor portal has no
// purchase order page, so the email carries the order itself (lines, total,
// needed-by date) and links nowhere.
//
// The caller has already approved the PO through its own session (the RPC
// re-checks finance access); this helper reads with the service client,
// only within the caller's company, and never throws: an email failure must
// not fail the approval.

import { createServiceClient } from '@/lib/supabase/server';
import { queueEmails } from '@/lib/email/queue';
import { primaryVendorEmail } from '@/lib/vendors/contact';
import { date } from '@/lib/utils';

export interface ApprovedPurchaseOrderLine {
  description: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

/** Subject and plain-text body of a purchase order approval email. */
export function purchaseOrderApprovedEmail({
  vendorName,
  brandName,
  supportEmail,
  number,
  associationName,
  description,
  neededBy,
  total,
  lines,
}: {
  vendorName: string;
  brandName: string;
  supportEmail: string | null;
  number: string | null;
  associationName: string | null;
  description: string | null;
  neededBy: string | null;
  total: number;
  lines: ApprovedPurchaseOrderLine[];
}): { subject: string; text: string } {
  const label = number ? `Purchase order ${number}` : 'Purchase order';
  const subject = `${label} approved${associationName ? ` - ${associationName}` : ''}`;
  const lineText = lines.map((l) =>
    `- ${l.description}: ${Number(l.qty)} x ${money(Number(l.unitPrice))} = ${money(Number(l.lineTotal))}`,
  );
  const text =
    `Hi ${vendorName},\n\n` +
    `${brandName} has approved ${number ? `purchase order ${number}` : 'a purchase order'} for you.\n\n` +
    (associationName ? `Property: ${associationName}\n` : '') +
    (description ? `Scope: ${description}\n` : '') +
    (neededBy ? `Needed by: ${date(neededBy, 'long', 'UTC')}\n` : '') +
    `\n${lineText.join('\n')}\n\n` +
    `Total: ${money(total)}\n\n` +
    (number ? `Please put ${number} on your invoice.\n\n` : '') +
    `${brandName}${supportEmail ? `\n${supportEmail}` : ''}`;
  return { subject, text };
}

/** What happened to the vendor email. `reason` is set when an approved PO's vendor was not emailed. */
export interface PurchaseOrderApprovalEmailResult {
  sent: boolean;
  reason: string | null;
}

function skipped(purchaseOrderId: string, reason: string, detail?: unknown): PurchaseOrderApprovalEmailResult {
  if (detail) console.error('[purchase-order-approved] vendor not emailed:', purchaseOrderId, reason, detail);
  else console.warn('[purchase-order-approved] vendor not emailed:', purchaseOrderId, reason);
  return { sent: false, reason };
}

/**
 * Email the vendor that its purchase order was approved. `sent` is true only
 * when an email was queued (or was already queued for this approval). A PO
 * that isn't approved yet (it went to the board) is not an error: nothing is
 * sent and `reason` is null. Every other skip (the PO or its lines could not
 * be read, it belongs to another company, the vendor has no email on file)
 * is logged and returned as `reason`, so the caller can tell staff. One email
 * per approval (keyed on the PO and its approval time), so a retried action
 * queues nothing twice.
 *
 * `portfolioId` is the caller's company (or, for the platform operator, the
 * company of the PO the caller just read through its own session); the PO
 * must belong to it.
 */
export async function notifyVendorOfPurchaseOrderApproval({
  purchaseOrderId,
  portfolioId,
}: {
  purchaseOrderId: string;
  portfolioId: string | null | undefined;
}): Promise<PurchaseOrderApprovalEmailResult> {
  try {
    if (!purchaseOrderId) return skipped(purchaseOrderId, 'the purchase order was not found');
    if (!portfolioId) return skipped(purchaseOrderId, "the purchase order's company could not be determined");
    const svc = createServiceClient() as any;
    const { data: po, error: poError } = await svc
      .from('purchase_orders')
      .select('id, number, description, needed_by, po_total, approval_status, approved_at, archived_at, portfolio_id, association_id, vendor_id, associations(name)')
      .eq('id', purchaseOrderId)
      .maybeSingle();
    if (poError) return skipped(purchaseOrderId, 'the purchase order could not be read', poError);
    if (!po || po.portfolio_id !== portfolioId) return skipped(purchaseOrderId, 'the purchase order was not found in this company');
    if (po.approval_status !== 'approved' || !po.approved_at || po.archived_at) return { sent: false, reason: null };
    if (!po.vendor_id) return skipped(purchaseOrderId, 'the purchase order has no vendor');

    const [{ data: vendor, error: vendorError }, { data: lines, error: linesError }, { data: company }] = await Promise.all([
      svc.from('vendors').select('id, name, emails, portfolio_id').eq('id', po.vendor_id).maybeSingle(),
      svc.from('purchase_order_line_items')
        .select('description, qty, unit_price, line_total, sort_order')
        .eq('purchase_order_id', po.id)
        .order('sort_order')
        .limit(100),
      svc.from('portfolios').select('company_name, support_email').eq('id', po.portfolio_id).maybeSingle(),
    ]);
    if (vendorError) return skipped(purchaseOrderId, 'the vendor could not be read', vendorError);
    if (!vendor || vendor.portfolio_id !== po.portfolio_id) return skipped(purchaseOrderId, 'the vendor was not found in this company');
    if (linesError) return skipped(purchaseOrderId, 'the line items could not be read', linesError);
    const to = primaryVendorEmail(vendor.emails);
    if (!to) return skipped(purchaseOrderId, 'the vendor has no email address on file');

    const brandName: string = company?.company_name?.trim() || 'Your management team';
    const supportEmail: string | null = company?.support_email?.trim() || null;
    const association = Array.isArray(po.associations) ? po.associations[0] : po.associations;
    const { subject, text } = purchaseOrderApprovedEmail({
      vendorName: vendor.name?.trim() || 'there',
      brandName,
      supportEmail,
      number: po.number ?? null,
      associationName: association?.name ?? null,
      description: po.description ?? null,
      neededBy: po.needed_by ?? null,
      total: Number(po.po_total ?? 0),
      lines: ((lines ?? []) as any[]).map((l) => ({
        description: String(l.description ?? ''),
        qty: Number(l.qty ?? 0),
        unitPrice: Number(l.unit_price ?? 0),
        lineTotal: Number(l.line_total ?? 0),
      })),
    });

    const { error } = await queueEmails(svc, [{
      to,
      toName: vendor.name ?? null,
      fromName: brandName,
      replyTo: supportEmail,
      subject,
      text,
      portfolioId: po.portfolio_id,
      associationId: po.association_id ?? null,
      idempotencyKey: `po-vendor-approved:${po.id}:${po.approved_at}`,
    }]);
    if (error) return skipped(po.id, 'the email could not be queued', error);
    return { sent: true, reason: null };
  } catch (e) {
    return skipped(purchaseOrderId, 'the email could not be prepared', e ?? 'error');
  }
}

/** Where to send staff after an approval: the PO page, with a warning when the vendor wasn't emailed. */
export function purchaseOrderPageAfterApproval(purchaseOrderId: string, result: PurchaseOrderApprovalEmailResult | null): string {
  const page = `/purchase-orders/${purchaseOrderId}`;
  return result?.reason ? `${page}?warning=${encodeURIComponent(`Approved \u2014 vendor not emailed: ${result.reason}.`)}` : page;
}
