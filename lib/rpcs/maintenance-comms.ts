'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { emailQueueRow } from '@/lib/email/queue';
import { primaryVendorEmail } from '@/lib/vendors/contact';
import { claimSubmission, releaseSubmission } from '@/lib/forms/submission';

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};
const req = (f: FormData, k: string) => {
  const v = str(f, k);
  if (!v) throw new Error(`${k} is required`);
  return v;
};

function extractEmail(vendor: any): string | null {
  return primaryVendorEmail(vendor?.emails);
}

function extractPhone(vendor: any): string | null {
  if (!vendor?.phone_numbers || !Array.isArray(vendor.phone_numbers)) return null;
  const mobile = vendor.phone_numbers.find((p: any) => p?.type === 'mobile' || p?.label === 'mobile');
  if (mobile?.number) return mobile.number;
  const first = vendor.phone_numbers.find((p: any) => p?.number);
  return first?.number ?? null;
}

interface ResolvedRecipient {
  vendorId: string;
  vendorName: string;
  email: string | null;
  phone: string | null;
  source: string;
  sourceRef: string;
}

/**
 * Bulk send email/SMS to vendors for work orders, status updates, and reminders.
 * Called from /maintenance/communications form.
 */
export async function sendBulkComms(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const channel = req(formData, 'channel'); // email | sms | both
  const commType = req(formData, 'comm_type'); // status_update | reminder | custom
  const subject = req(formData, 'subject');
  const body = req(formData, 'body');

  // Collect IDs from form data (multiple hidden inputs with same name)
  const woIds = formData.getAll('work_order_ids').filter((v): v is string => typeof v === 'string');
  const taskIds = formData.getAll('maintenance_task_ids').filter((v): v is string => typeof v === 'string');
  const vendorIds = formData.getAll('vendor_ids').filter((v): v is string => typeof v === 'string');

  const recipients = new Map<string, ResolvedRecipient>();

  // ── Resolve from work orders ──
  if (woIds.length > 0) {
    const { data: wos } = await db
      .from('work_orders')
      .select('id, number, title, vendor_id, vendors(name, emails, phone_numbers)')
      .in('id', woIds)
      .is('archived_at', null);

    for (const wo of wos ?? []) {
      const vendor = wo.vendors;
      if (!vendor) continue;
      const email = extractEmail(vendor);
      const phone = extractPhone(vendor);
      if (!email && !phone) continue;
      const key = vendor.name || wo.vendor_id;
      if (!recipients.has(key)) {
        recipients.set(key, {
          vendorId: wo.vendor_id,
          vendorName: vendor.name ?? 'Unknown Vendor',
          email,
          phone,
          source: 'work_order',
          sourceRef: `WO #${wo.number ?? wo.id} — ${wo.title}`,
        });
      }
    }
  }

  // ── Resolve from maintenance tasks ──
  if (taskIds.length > 0) {
    const { data: tasks } = await db
      .from('maintenance_tasks')
      .select('id, task_name, vendor_id, vendors(name, emails, phone_numbers)')
      .in('id', taskIds)
      .is('archived_at', null);

    for (const task of tasks ?? []) {
      const vendor = task.vendors;
      if (!vendor) continue;
      const email = extractEmail(vendor);
      const phone = extractPhone(vendor);
      if (!email && !phone) continue;
      const key = vendor.name || task.vendor_id;
      if (!recipients.has(key)) {
        recipients.set(key, {
          vendorId: task.vendor_id,
          vendorName: vendor.name ?? 'Unknown Vendor',
          email,
          phone,
          source: 'maintenance_task',
          sourceRef: task.task_name ?? 'Maintenance Task',
        });
      }
    }
  }

  // ── Resolve from direct vendor selection ──
  if (vendorIds.length > 0) {
    const { data: vens } = await db
      .from('vendors')
      .select('id, name, emails, phone_numbers, trade')
      .in('id', vendorIds)
      .is('archived_at', null);

    for (const v of vens ?? []) {
      const email = extractEmail(v);
      const phone = extractPhone(v);
      if (!email && !phone) continue;
      if (!recipients.has(v.name)) {
        recipients.set(v.name, {
          vendorId: v.id,
          vendorName: v.name,
          email,
          phone,
          source: 'manual',
          sourceRef: v.trade ?? 'Vendor',
        });
      }
    }
  }

  const recipientList = Array.from(recipients.values());
  if (recipientList.length === 0) {
    return { success: false, error: 'No recipients resolved. Ensure selected vendors have email or phone on file.' };
  }

  const now = new Date().toISOString();
  // Bulk SMS was logged as "queued" but never reached the SMS sender (which
  // needs each vendor's consent and a conversation). Refuse it plainly until
  // it is wired up; single texts go through /sms.
  if (channel === 'sms' || channel === 'both') {
    return { success: false, error: 'Bulk text messages are not available here yet. Send this by email, or text vendors one at a time from SMS (which checks their consent).' };
  }
  const sendEmail = channel === 'email';
  const sendSms = false;

  // Each email goes out under the vendor's own company (the one it works
  // for), not the sender's: a platform operator's workspace is not the
  // client's. The vendors were read with the caller's client above, so only
  // visible vendors are here; the service client reads their company's public
  // name and support address.
  const recipientVendorIds = Array.from(new Set(recipientList.map((r) => r.vendorId).filter(Boolean)));
  const { data: vendorCompanies, error: vendorCompanyError } = await db
    .from('vendors').select('id, portfolio_id').in('id', recipientVendorIds);
  if (vendorCompanyError) return { success: false, error: `Could not load the vendors' companies: ${vendorCompanyError.message}` };
  const vendorCompany = new Map<string, string>((vendorCompanies ?? []).map((v: any) => [v.id, v.portfolio_id]));
  const companyIds = Array.from(new Set(vendorCompany.values())).filter(Boolean);
  const { data: companies, error: companyError } = companyIds.length
    ? await createServiceClient().from('portfolios').select('id, company_name, support_email').in('id', companyIds)
    : { data: [], error: null };
  if (companyError) return { success: false, error: `Could not load the vendors' companies: ${companyError.message}` };
  const companyById = new Map<string, any>((companies ?? []).map((c: any) => [c.id, c]));
  const unplaced = recipientList.find((r) => !companyById.get(vendorCompany.get(r.vendorId) ?? ''));
  if (unplaced) return { success: false, error: `${unplaced.vendorName} is not available. Reload the page and try again.` };

  // A double click or a retried send must not email every vendor twice.
  const claim = await claimSubmission(db, formData, 'vendor_bulk_comms');
  if (claim.status === 'error') return { success: false, error: claim.message };
  if (claim.status === 'duplicate') return { success: false, error: 'These messages were already queued. Reload the page to send a new one.' };
  const token = claim.token;

  let queued = 0;
  let emailCount = 0;
  let smsCount = 0;

  // ── Insert communication_messages entries for tracking/audit ──
  const commRows = [];
  const emailRows = [];
  const smsMessageRows = [];

  for (const r of recipientList) {
    // Merge fields into body
    const personalizedBody = body
      .replace(/{vendor_name}/g, r.vendorName)
      .replace(/{source_ref}/g, r.sourceRef);

    const personalizedSubject = subject.replace(/{vendor_name}/g, r.vendorName);

    const companyId = vendorCompany.get(r.vendorId)!;
    const company = companyById.get(companyId);
    const companyName: string | null = company?.company_name?.trim() || null;

    // Communication message entry
    if (sendEmail && r.email) {
      commRows.push({
        portfolio_id: companyId,
        channel: 'email',
        status: 'queued',
        recipient_group: commType,
        recipient_email: r.email,
        recipient_name: r.vendorName,
        subject: personalizedSubject,
        body: personalizedBody,
        created_by: me.auth_user_id,
      });

      // email_queue has no created_by column (it is sent_by); use the shared
      // builder so the row + verified sender stay correct.
      emailRows.push(emailQueueRow({
        to: r.email,
        toName: r.vendorName,
        subject: personalizedSubject,
        text: personalizedBody,
        portfolioId: companyId,
        fromAddress: 'maintenance@portier369.com',
        // portfolios has no `name` column — company_name is the brand
        fromName: companyName,
        replyTo: company?.support_email?.trim() || null,
        sentBy: me.auth_user_id,
        idempotencyKey: `vendor-bulk:${token}:${r.vendorId}`,
      }));

      emailCount++;
    }

    if (sendSms && r.phone) {
      commRows.push({
        portfolio_id: companyId,
        channel: 'sms',
        status: 'queued',
        recipient_group: commType,
        recipient_phone: r.phone,
        recipient_name: r.vendorName,
        body: personalizedBody.substring(0, 1600),
        created_by: me.auth_user_id,
      });

      smsCount++;
    }
  }

  // ── Batch insert ──
  // Emails first: their idempotency key makes a retry after a partial failure
  // queue each vendor's email once, and the log is written only after they
  // are queued, so a retry doesn't log the same messages twice.
  if (emailRows.length > 0) {
    const { error: emailErr } = await db.from('email_queue')
      .upsert(emailRows, { onConflict: 'idempotency_key', ignoreDuplicates: true });
    if (emailErr) {
      await releaseSubmission(db, token);
      return { success: false, error: `Failed to queue emails: ${emailErr.message}` };
    }
  }

  if (commRows.length > 0) {
    const { error: commErr } = await db.from('communication_messages').insert(commRows);
    // The emails are queued; the claim stays, so a retry can't send them again.
    if (commErr) return { success: false, error: `The emails were queued, but logging them failed: ${commErr.message}` };
    queued += commRows.length;
  }

  // Revalidate paths
  revalidatePath('/maintenance/communications');
  revalidatePath('/communication-center');
  revalidatePath('/sms');

  return {
    success: true,
    queued,
    channel,
    emailCount,
    smsCount,
    vendorCount: recipientList.length,
  };
}
