'use server';

import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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
  if (!vendor?.emails || !Array.isArray(vendor.emails)) return null;
  const work = vendor.emails.find((e: any) => e?.type === 'work' || e?.label === 'work');
  if (work?.email) return work.email;
  const first = vendor.emails.find((e: any) => e?.email);
  return first?.email ?? null;
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
  const sendEmail = channel === 'email' || channel === 'both';
  const sendSms = channel === 'sms' || channel === 'both';

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

    // Communication message entry
    if (sendEmail && r.email) {
      commRows.push({
        portfolio_id: me.portfolio?.id,
        channel: 'email',
        context: 'maintenance',
        status: 'queued',
        recipient_group: commType,
        recipient_email: r.email,
        recipient_name: r.vendorName,
        subject: personalizedSubject,
        body: personalizedBody,
        created_by: me.auth_user_id,
      });

      emailRows.push({
        portfolio_id: me.portfolio?.id,
        to_email: r.email,
        to_name: r.vendorName,
        subject: personalizedSubject,
        body: personalizedBody,
        status: 'pending',
        from_address: 'maintenance@portier369.com',
        from_name: me.portfolio?.name ?? 'Portier369 Maintenance',
        created_by: me.auth_user_id,
      });

      emailCount++;
    }

    if (sendSms && r.phone) {
      commRows.push({
        portfolio_id: me.portfolio?.id,
        channel: 'sms',
        context: 'maintenance',
        status: 'queued',
        recipient_group: commType,
        recipient_phone: r.phone,
        recipient_name: r.vendorName,
        body: personalizedBody.substring(0, 1600),
        created_by: me.auth_user_id,
      });

      smsMessageRows.push({
        portfolio_id: me.portfolio?.id,
        vendor_id: r.vendorId,
        to_phone: r.phone,
        body: personalizedBody.substring(0, 1600),
        direction: 'outbound',
        status: 'pending',
        context: 'maintenance',
        context_type: commType,
      });

      smsCount++;
    }
  }

  // ── Batch insert ──
  if (commRows.length > 0) {
    const { error: commErr } = await db.from('communication_messages').insert(commRows);
    if (commErr) return { success: false, error: `Failed to log communications: ${commErr.message}` };
    queued += commRows.length;
  }

  if (emailRows.length > 0) {
    const { error: emailErr } = await db.from('email_queue').insert(emailRows);
    if (emailErr) return { success: false, error: `Failed to queue emails: ${emailErr.message}` };
  }

  if (smsMessageRows.length > 0) {
    // Insert into sms_messages (requires conversation context; use a flat queue approach)
    for (const sms of smsMessageRows) {
      await db.from('sms_messages').insert({
        portfolio_id: sms.portfolio_id,
        body: sms.body,
        to_number: sms.to_phone,
        from_number: me.portfolio?.phone_number ?? '+10000000000',
        direction: 'outbound',
        status: 'pending',
        created_by: me.auth_user_id,
      }).select('id');
    }
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
