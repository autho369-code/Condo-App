// Owner status-change notifications (AppFolio parity: "auto keep homeowner informed").
//
// When staff or a vendor changes the status of a work order or service request,
// the owner gets a white-labeled email (management company name + reply-to, per
// the pattern in app/api/insurance/send-reminders/route.ts). Emails go through
// queueEmails() → email_queue → Vercel's process-queue cron → Resend.
//
// This helper NEVER throws — it is fire-and-forget. A notification failure must
// never break the status update itself, so every error is caught and logged.
//
// Owner resolution (schema verified in lib/types/database.ts):
// - work_orders have no owner column; the owner is reached via unit_id →
//   unit_owners (active row: end_date IS NULL, primary first), falling back to
//   occupancies (status = 'current', occupancy_type = 'owner'). Common-area
//   work orders (unit_id NULL) have no owner → skipped silently.
// - service_requests carry homeowner_id (owner_id kept as fallback) → owners.
// Uses the service-role client so vendor/staff RLS never blocks reading the
// owner row or inserting into email_queue.

import { createServiceClient } from '@/lib/supabase/server';
import { queueEmails } from '@/lib/email/queue';
import { companyUrl, type CompanyAddress } from '@/lib/tenant/host';
import { DEFAULT_TIME_ZONE, todayInZone } from '@/lib/time/zoned';


export interface StatusChangeParams {
  kind: 'work_order' | 'service_request' | 'architectural_request';
  id: string;
  newStatus: string;
  /** Optional note from staff, quoted in the email (e.g. the answer to a question). */
  message?: string | null;
}

/** "in_progress" → "In progress" */
function statusLabel(status: string): string {
  const s = status.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Owner of a unit: active unit_owners row first (primary preferred), then
 * current owner occupancy. Exported so the automation-flows cron resolves
 * charge/work-order subjects to owners the exact same way.
 */
export async function resolveUnitOwnerId(svc: any, unitId: string): Promise<string | null> {
  // An owner counts only while they hold a current owner occupancy that has
  // not reached its move-out date. A unit_owners row opened for a sale with a
  // future move-out stays open past that date (no trigger fires when a date
  // passes), so it is checked against the occupancy here.
  const today = todayInZone();
  const { data: occs } = await svc
    .from('occupancies')
    .select('owner_id, is_primary, move_out_date')
    .eq('unit_id', unitId)
    .eq('status', 'current')
    .eq('occupancy_type', 'owner')
    .not('owner_id', 'is', null);
  const currentOwners = new Set<string>(
    ((occs ?? []) as any[])
      .filter((o) => !o.move_out_date || o.move_out_date > today)
      .map((o) => String(o.owner_id)),
  );

  const { data: uos } = await svc
    .from('unit_owners')
    .select('owner_id, is_primary')
    .eq('unit_id', unitId)
    .is('end_date', null)
    .order('is_primary', { ascending: false });
  const fromUnitOwners = ((uos ?? []) as any[]).find((u) => currentOwners.has(String(u.owner_id)));
  if (fromUnitOwners?.owner_id) return fromUnitOwners.owner_id;

  const fromOccupancy = ((occs ?? []) as any[])
    .filter((o) => currentOwners.has(String(o.owner_id)))
    .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)))[0];
  return fromOccupancy?.owner_id ?? null;
}

/**
 * The current owner's move-in date for a unit, or null when any of their
 * current occupancies has none (no cutoff), as current_resident_unit_since.
 */
async function ownerMoveInDate(svc: any, unitId: string, ownerId: string): Promise<string | null> {
  const { data } = await svc
    .from('occupancies')
    .select('move_in_date')
    .eq('unit_id', unitId)
    .eq('owner_id', ownerId)
    .eq('status', 'current');
  const rows = (data ?? []) as Array<{ move_in_date: string | null }>;
  if (!rows.length || rows.some((r) => !r.move_in_date)) return null;
  return rows.map((r) => r.move_in_date as string).sort()[0];
}

/** True when a work order was opened (association's local date) before the owner moved in. */
export function workOrderPredatesOwner(createdAt: string, moveInDate: string, timeZone?: string | null): boolean {
  const opened = todayInZone(timeZone?.trim() || DEFAULT_TIME_ZONE, new Date(createdAt));
  return opened < moveInDate;
}

/**
 * Email the owner that their work order / service request has a new status.
 * White-labeled as the management company. Never throws; skips silently when
 * there is no owner or the owner has no email on file. Resolves true only
 * when the email was queued.
 */
export async function notifyOwnerOfStatusChange({ kind, id, newStatus, message }: StatusChangeParams): Promise<boolean> {
  try {
    const svc = createServiceClient() as any;

    let ownerId: string | null = null;
    // Tenant-submitted requests carry only tenant_id: reply to the tenant.
    let tenant: { email: string | null; first_name: string | null; last_name: string | null } | null = null;
    let associationId: string | null = null;
    let portfolioId: string | null = null;
    let associationName: string | null = null;
    let itemTitle: string;
    let itemNumber: string | null = null;
    let noun: string;
    let linkPath: string;

    if (kind === 'work_order') {
      const { data: wo, error } = await svc
        .from('work_orders')
        .select('id, number, title, unit_id, association_id, service_request_id, created_at, associations(name, portfolio_id, timezone)')
        .eq('id', id)
        .maybeSingle();
      if (error || !wo) return false;
      // A work order from a service request answers whoever submitted that
      // request (owner or tenant), not whoever owns the unit today.
      // Intentional: the requester keeps getting updates on their own
      // request even after they sell or move out (reviewed 2026-10-14).
      if (wo.service_request_id) {
        return notifyOwnerOfStatusChange({ kind: 'service_request', id: wo.service_request_id, newStatus, message });
      }
      if (!wo.unit_id) return false; // common-area work order — no single owner to inform
      ownerId = await resolveUnitOwnerId(svc, wo.unit_id);
      // A buyer never hears about the seller's work orders: skip one opened
      // before the current owner moved in (the association's local date).
      if (ownerId) {
        const since = await ownerMoveInDate(svc, wo.unit_id, ownerId);
        if (since && wo.created_at && workOrderPredatesOwner(wo.created_at, since, wo.associations?.timezone)) return false;
      }
      associationId = wo.association_id ?? null;
      portfolioId = wo.associations?.portfolio_id ?? null;
      associationName = wo.associations?.name ?? null;
      itemTitle = wo.title ?? 'Work order';
      itemNumber = wo.number ?? null;
      noun = 'work order';
      linkPath = `/portal/work-orders/${wo.id}`;
    } else if (kind === 'architectural_request') {
      const { data: ar, error } = await svc
        .from('architectural_requests')
        .select('id, title, owner_id, association_id, associations(name, portfolio_id)')
        .eq('id', id)
        .maybeSingle();
      if (error || !ar) return false;
      ownerId = ar.owner_id ?? null;
      associationId = ar.association_id ?? null;
      portfolioId = ar.associations?.portfolio_id ?? null;
      associationName = ar.associations?.name ?? null;
      itemTitle = ar.title ?? 'Architectural request';
      noun = 'architectural request';
      linkPath = `/portal/architectural/${ar.id}`;
    } else {
      const { data: sr, error } = await svc
        .from('service_requests')
        .select('id, number, description, homeowner_id, owner_id, tenant_id, association_id, portfolio_id, associations(name, portfolio_id), tenants:tenant_id(email, first_name, last_name)')
        .eq('id', id)
        .maybeSingle();
      if (error || !sr) return false;
      ownerId = sr.homeowner_id ?? sr.owner_id ?? null;
      if (!ownerId && sr.tenant_id) tenant = Array.isArray(sr.tenants) ? sr.tenants[0] ?? null : sr.tenants ?? null;
      associationId = sr.association_id ?? null;
      portfolioId = sr.portfolio_id ?? sr.associations?.portfolio_id ?? null;
      associationName = sr.associations?.name ?? null;
      const desc = (sr.description ?? '').trim();
      itemTitle = desc.length > 80 ? `${desc.slice(0, 77)}...` : desc || 'Service request';
      itemNumber = sr.number ?? null;
      noun = 'service request';
      // No per-request owner detail page exists — link to the portal list.
      linkPath = tenant ? '/resident/requests' : '/portal/service-requests';
    }

    let owner: { email: string | null; full_name: string | null } | null = null;
    if (ownerId) {
      const { data } = await svc.from('owners').select('email, full_name').eq('id', ownerId).maybeSingle();
      owner = data ?? null;
    } else if (tenant) {
      owner = { email: tenant.email, full_name: [tenant.first_name, tenant.last_name].filter(Boolean).join(' ') || 'Resident' };
    }
    if (!owner?.email) return false; // no recipient / no email on file — skip silently

    // White-label branding: present as the management company (same pattern as
    // insurance reminders). Only the sending address stays on portier369.com.
    let companyName: string | null = null;
    let supportEmail: string | null = null;
    let address: CompanyAddress | null = null;
    if (portfolioId) {
      const { data: pf } = await svc.from('portfolios').select('company_name, support_email, slug, custom_domain, custom_domain_verified_at').eq('id', portfolioId).maybeSingle();
      companyName = pf?.company_name ?? null;
      supportEmail = pf?.support_email ?? null;
      address = pf ?? null;
    }
    const link = companyUrl(address, linkPath);
    const brandName = companyName ?? associationName ?? 'Your management team';

    const label = statusLabel(newStatus);
    const ownerName = owner.full_name ?? 'Owner';
    const ref = itemNumber ? `#${itemNumber} — ` : '';
    const signature = `— ${brandName}${supportEmail ? `\n${supportEmail}` : ''}`;

    const { error: queueErr } = await queueEmails(svc, [
      {
        to: owner.email,
        toName: ownerName,
        fromName: brandName,
        replyTo: supportEmail,
        subject: `Update on your ${noun}: ${itemTitle} — now ${label}`,
        text:
          `Hi ${ownerName},\n\n` +
          `Your ${noun} ${ref}"${itemTitle}"${associationName ? ` at ${associationName}` : ''} has a new status: ${label}.\n\n` +
          (message?.trim() ? `Message from ${brandName}:\n\n${message.trim()}\n\n` : '') +
          `View the latest details in your ${tenant ? 'resident' : 'owner'} portal:\n${link}\n\n${signature}`,
        portfolioId,
        associationId,
      },
    ]);
    if (queueErr) {
      // Constant format string; the record kind and id are plain arguments.
      console.error('[status-change] failed to queue status email:', noun, id, queueErr);
      return false;
    }
    return true;
  } catch (e) {
    // Fire-and-forget: a notification failure must never fail the status update.
    console.error('[status-change] notifyOwnerOfStatusChange failed:', kind, id, e);
    return false;
  }
}
