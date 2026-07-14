// Owner status-change notifications (AppFolio parity: "auto keep homeowner informed").
//
// When staff or a vendor changes the status of a work order or service request,
// the owner gets a white-labeled email (management company name + reply-to, per
// the pattern in app/api/insurance/send-reminders/route.ts). Emails go through
// queueEmails() → email_queue → process-email-queue cron → Resend.
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

const SITE_URL = 'https://portier369.com';

export interface StatusChangeParams {
  kind: 'work_order' | 'service_request';
  id: string;
  newStatus: string;
}

/** "in_progress" → "In progress" */
function statusLabel(status: string): string {
  const s = status.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Owner of a unit: active unit_owners row first (primary preferred), then current owner occupancy. */
async function resolveUnitOwnerId(svc: any, unitId: string): Promise<string | null> {
  const { data: uo } = await svc
    .from('unit_owners')
    .select('owner_id, is_primary')
    .eq('unit_id', unitId)
    .is('end_date', null)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (uo?.owner_id) return uo.owner_id;

  const { data: occ } = await svc
    .from('occupancies')
    .select('owner_id, is_primary')
    .eq('unit_id', unitId)
    .eq('status', 'current')
    .eq('occupancy_type', 'owner')
    .not('owner_id', 'is', null)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();
  return occ?.owner_id ?? null;
}

/**
 * Email the owner that their work order / service request has a new status.
 * White-labeled as the management company. Never throws; skips silently when
 * there is no owner or the owner has no email on file.
 */
export async function notifyOwnerOfStatusChange({ kind, id, newStatus }: StatusChangeParams): Promise<void> {
  try {
    const svc = createServiceClient() as any;

    let ownerId: string | null = null;
    let associationId: string | null = null;
    let portfolioId: string | null = null;
    let associationName: string | null = null;
    let itemTitle: string;
    let itemNumber: string | null = null;
    let noun: string;
    let link: string;

    if (kind === 'work_order') {
      const { data: wo, error } = await svc
        .from('work_orders')
        .select('id, number, title, unit_id, association_id, associations(name, portfolio_id)')
        .eq('id', id)
        .maybeSingle();
      if (error || !wo) return;
      if (!wo.unit_id) return; // common-area work order — no single owner to inform
      ownerId = await resolveUnitOwnerId(svc, wo.unit_id);
      associationId = wo.association_id ?? null;
      portfolioId = wo.associations?.portfolio_id ?? null;
      associationName = wo.associations?.name ?? null;
      itemTitle = wo.title ?? 'Work order';
      itemNumber = wo.number ?? null;
      noun = 'work order';
      link = `${SITE_URL}/portal/work-orders/${wo.id}`;
    } else {
      const { data: sr, error } = await svc
        .from('service_requests')
        .select('id, number, description, homeowner_id, owner_id, association_id, portfolio_id, associations(name, portfolio_id)')
        .eq('id', id)
        .maybeSingle();
      if (error || !sr) return;
      ownerId = sr.homeowner_id ?? sr.owner_id ?? null;
      associationId = sr.association_id ?? null;
      portfolioId = sr.portfolio_id ?? sr.associations?.portfolio_id ?? null;
      associationName = sr.associations?.name ?? null;
      const desc = (sr.description ?? '').trim();
      itemTitle = desc.length > 80 ? `${desc.slice(0, 77)}...` : desc || 'Service request';
      itemNumber = sr.number ?? null;
      noun = 'service request';
      // No per-request owner detail page exists — link to the portal list.
      link = `${SITE_URL}/portal/service-requests`;
    }

    if (!ownerId) return;

    const { data: owner } = await svc.from('owners').select('email, full_name').eq('id', ownerId).maybeSingle();
    if (!owner?.email) return; // owner has no email on file — skip silently

    // White-label branding: present as the management company (same pattern as
    // insurance reminders). Only the sending address stays on portier369.com.
    let companyName: string | null = null;
    let supportEmail: string | null = null;
    if (portfolioId) {
      const { data: pf } = await svc.from('portfolios').select('company_name, support_email').eq('id', portfolioId).maybeSingle();
      companyName = pf?.company_name ?? null;
      supportEmail = pf?.support_email ?? null;
    }
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
          `View the latest details in your owner portal:\n${link}\n\n${signature}`,
        portfolioId,
        associationId,
      },
    ]);
    if (queueErr) console.error(`[status-change] failed to queue ${noun} ${id} email:`, queueErr);
  } catch (e) {
    // Fire-and-forget: a notification failure must never fail the status update.
    console.error(`[status-change] notifyOwnerOfStatusChange(${kind}, ${id}) failed:`, e);
  }
}
