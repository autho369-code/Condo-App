// Vendor assignment emails: when staff assign a vendor to one or more work
// orders (single assign or the bulk action), the vendor gets one email listing
// each job with a link to it in the vendor portal.
//
// White-labeled like the owner status emails (status-change.ts) and vendor
// bulk messages (maintenance-comms.ts): the company's name, its support
// address as reply-to and links on the company's own address. Only the
// sending address stays on portier369.com.
//
// The caller has already read the work orders and the vendor through its own
// session (RLS), so the ids passed here are ones it may act on. This helper
// reads with the service client, and never throws: an email failure must not
// fail the assignment.

import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { queueEmails } from '@/lib/email/queue';
import { companyUrl, type CompanyAddress } from '@/lib/tenant/host';
import { primaryVendorEmail } from '@/lib/vendors/contact';
import { date } from '@/lib/utils';

export interface AssignedJob {
  id: string;
  number: string | number | null;
  title: string | null;
  associationName: string | null;
  unitNumber: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  link: string;
}

/** Subject and plain-text body of a vendor assignment email. */
export function vendorAssignmentEmail({
  vendorName,
  brandName,
  supportEmail,
  jobs,
}: {
  vendorName: string;
  brandName: string;
  supportEmail: string | null;
  jobs: AssignedJob[];
}): { subject: string; text: string } {
  const label = (j: AssignedJob) => `${j.number != null ? `#${j.number} ` : ''}${j.title?.trim() || 'Work order'}`;
  const subject = jobs.length === 1
    ? `New work order ${label(jobs[0])}`
    : `${jobs.length} new work orders from ${brandName}`;
  const lines = jobs.map((j) => {
    const where = [j.associationName, j.unitNumber ? `Unit ${j.unitNumber}` : null].filter(Boolean).join(', ');
    const when = j.scheduledDate
      ? `${date(j.scheduledDate, 'long', 'UTC')}${j.scheduledTime ? ` at ${j.scheduledTime}` : ''}`
      : 'Not scheduled yet';
    return `${label(j)}\n` +
      (where ? `Property: ${where}\n` : '') +
      `Scheduled: ${when}\n` +
      `${j.link}`;
  });
  const intro = jobs.length === 1
    ? `${brandName} has assigned you a work order.`
    : `${brandName} has assigned you ${jobs.length} work orders.`;
  const text =
    `Hi ${vendorName},\n\n${intro}\n\n` +
    `${lines.join('\n\n')}\n\n` +
    'Sign in to your vendor portal to see the details and post updates.\n\n' +
    `— ${brandName}${supportEmail ? `\n${supportEmail}` : ''}`;
  return { subject, text };
}

/**
 * Email the vendor about work orders just assigned to it. Resolves true only
 * when an email was queued (or was already queued under the same key); skips
 * when the vendor has no email on file. Queued jobs get vendor_notified_at,
 * so the nightly recurring cron (/api/work-orders/notify-recurring) doesn't
 * email them again. `idempotencyKey` replaces the default key (the cron uses
 * one per job so a retried run queues nothing twice).
 */
export async function notifyVendorOfAssignment({
  vendorId,
  workOrderIds,
  idempotencyKey,
}: {
  vendorId: string;
  workOrderIds: string[];
  idempotencyKey?: string;
}): Promise<boolean> {
  try {
    const ids = [...new Set(workOrderIds)].filter(Boolean);
    if (!vendorId || ids.length === 0) return false;
    const svc = createServiceClient() as any;

    const [{ data: vendor, error: vendorError }, { data: wos, error: woError }] = await Promise.all([
      svc.from('vendors').select('id, name, emails, portfolio_id, association_id').eq('id', vendorId).maybeSingle(),
      svc.from('work_orders')
        .select('id, number, title, scheduled_date, scheduled_time, updated_at, vendor_id, portfolio_id, association_id, associations(name), units(unit_number)')
        .in('id', ids)
        .eq('vendor_id', vendorId)
        .is('archived_at', null)
        .order('number'),
    ]);
    if (vendorError || woError || !vendor) return false;
    const to = primaryVendorEmail(vendor.emails);
    if (!to) return false;
    // Only work orders of the vendor's own company.
    const jobsRows = ((wos ?? []) as any[]).filter((w) => w.portfolio_id && w.portfolio_id === vendor.portfolio_id);
    if (jobsRows.length === 0) return false;

    const { data: company } = await svc
      .from('portfolios')
      .select('company_name, support_email, slug, custom_domain, custom_domain_verified_at')
      .eq('id', vendor.portfolio_id)
      .maybeSingle();
    const brandName: string = company?.company_name?.trim() || 'Your management team';
    const supportEmail: string | null = company?.support_email?.trim() || null;
    const address: CompanyAddress | null = company ?? null;

    const jobs: AssignedJob[] = jobsRows.map((w) => ({
      id: w.id,
      number: w.number ?? null,
      title: w.title ?? null,
      associationName: (Array.isArray(w.associations) ? w.associations[0] : w.associations)?.name ?? null,
      unitNumber: (Array.isArray(w.units) ? w.units[0] : w.units)?.unit_number ?? null,
      scheduledDate: w.scheduled_date ?? null,
      scheduledTime: w.scheduled_time ?? null,
      link: companyUrl(address, `/vendor/work-orders/${w.id}`),
    }));
    const vendorName: string = vendor.name?.trim() || 'there';
    const { subject, text } = vendorAssignmentEmail({ vendorName, brandName, supportEmail, jobs });

    // A retry of the same assignment (same work orders, unchanged since) is
    // queued once.
    const stamp = createHash('sha256')
      .update(jobsRows.map((w) => `${w.id}:${w.updated_at ?? ''}`).sort().join('|'))
      .digest('hex')
      .slice(0, 24);
    const associations = new Set(jobsRows.map((w) => w.association_id ?? null));
    const { error } = await queueEmails(svc, [{
      to,
      toName: vendor.name ?? null,
      fromName: brandName,
      replyTo: supportEmail,
      subject,
      text,
      portfolioId: vendor.portfolio_id,
      // The message belongs to the jobs' association when they share one.
      associationId: associations.size === 1 ? [...associations][0] : (vendor.association_id ?? null),
      idempotencyKey: idempotencyKey ?? `wo-vendor-assign:${vendorId}:${stamp}`,
    }]);
    if (error) {
      console.error('[vendor-assignment] failed to queue email:', vendorId, error);
      return false;
    }
    const { error: stampError } = await svc
      .from('work_orders')
      .update({ vendor_notified_at: new Date().toISOString() })
      .in('id', jobsRows.map((w) => w.id));
    if (stampError) console.error('[vendor-assignment] failed to mark jobs emailed:', vendorId, stampError.message);
    return true;
  } catch (e) {
    console.error('[vendor-assignment] notifyVendorOfAssignment failed:', vendorId, e);
    return false;
  }
}
