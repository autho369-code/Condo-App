'use server';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { emailQueueRow, textToHtml } from '@/lib/email/queue';

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};
const req = (f: FormData, k: string) => {
  const v = str(f, k);
  if (!v) throw new Error(`${k} is required`);
  return v;
};

/**
 * Queue emails to owners, tenants, or both — scoped to one association.
 * One `notices` row per recipient so individual delivery status is tracked.
 * Actual send goes through whichever edge function is wired to notices.status='draft'
 * (see FINAL_INTEGRATION.md §1 Email sender).
 */
export async function sendEmail(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const failTo = (msg: string) => {
    const returnTo = str(formData, 'return_to');
    const base = returnTo && returnTo.startsWith('/') ? returnTo : '/send-email';
    redirect(`${base}${base.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`);
  };

  const associationId = req(formData, 'association_id');
  const recipientType = req(formData, 'recipient_type'); // owners | tenants | both | board
  const subject       = req(formData, 'subject');
  const body          = req(formData, 'message');
  const cc            = str(formData, 'cc');
  const additional    = str(formData, 'additional_recipients'); // comma-sep extra emails
  const fromOverride  = formData.get('from_donotreply') === 'on';

  // Resolve recipient email addresses based on the type picker
  const recipients: Array<{ email: string; name: string; source: string }> = [];

  if (recipientType === 'owners' || recipientType === 'both') {
    const { data: occs } = await (supabase as any)
      .from('occupancies')
      .select('owners!owner_id(id, email, full_name)')
      .eq('association_id', associationId)
      .eq('occupancy_type', 'owner')
      .eq('status', 'current');
    (occs ?? []).forEach((o: any) => {
      if (o.owners?.email) recipients.push({ email: o.owners.email, name: o.owners.full_name ?? '', source: 'owner' });
    });
  }

  if (recipientType === 'tenants' || recipientType === 'both') {
    // Tenants live in the dedicated tenants table (not occupancies).
    const { data: ten } = await (supabase as any)
      .from('tenants')
      .select('email, first_name, last_name')
      .eq('association_id', associationId)
      .eq('status', 'active')
      .is('archived_at', null);
    (ten ?? []).forEach((t: any) => {
      if (t.email) recipients.push({ email: t.email, name: `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim(), source: 'tenant' });
    });
  }

  if (recipientType === 'board') {
    const { data: bm } = await (supabase as any)
      .from('board_members')
      .select('email, full_name')
      .eq('association_id', associationId)
      .eq('active', true);
    (bm ?? []).forEach((b: any) => {
      if (b.email) recipients.push({ email: b.email, name: b.full_name ?? '', source: 'board' });
    });
  }

  // Deduplicate by email
  const seen = new Set<string>();
  const unique = recipients.filter((r) => {
    const k = r.email.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Add Additional Recipients (comma/semicolon-separated emails)
  if (additional) {
    additional.split(/[,;]/).map((s) => s.trim()).filter(Boolean).forEach((em) => {
      if (!seen.has(em.toLowerCase())) {
        unique.push({ email: em, name: '', source: 'additional' });
        seen.add(em.toLowerCase());
      }
    });
  }

  if (unique.length === 0) {
    failTo(`No recipients found for ${recipientType} at this association. Make sure owners/tenants have email addresses on file.`);
    return;
  }

  const fullBody = cc ? body + `\n\n---\nCc: ${cc}` : body;
  const fromName = me.portfolio?.company_name ?? 'Portier369';

  // 1) Operations log — one communication_messages row per recipient (status queued).
  const communicationRows = unique.map((r) => ({
    portfolio_id:    me.portfolio?.id,
    association_id:  associationId,
    channel:         'email',
    status:          'queued',
    recipient_group: recipientType,
    recipient_name:  r.name,
    recipient_email: r.email,
    subject,
    body:            fullBody,
    created_by:      me.auth_user_id,
  }));

  const { error: communicationError, count } = await db.from('communication_messages').insert(communicationRows, { count: 'exact' });
  if (communicationError) { failTo(communicationError.message); return; }

  // 2) Association notices ledger (legacy/reporting).
  const rows = unique.map((r) => ({
    association_id: associationId,
    notice_type:    'general',
    status:         'sent',
    channel:        'email',
    subject,
    body:           fullBody,
    send_to:        r.email,
    created_by:     me.auth_user_id,
  }));
  await db.from('notices').insert(rows);

  // 3) Actually deliver — enqueue to email_queue (drained by the process-email-queue
  //    cron → Resend). Without this, composed emails were created but never sent.
  const html = textToHtml(fullBody);
  const queueRows = unique.map((r) => emailQueueRow({
    to: r.email,
    toName: r.name || null,
    subject,
    html,
    portfolioId: me.portfolio?.id,
    associationId,
    fromAddress: fromOverride ? 'noreply@portier369.com' : 'hello@portier369.com',
    fromName,
    sentBy: me.auth_user_id,
  }));
  const { error: queueError } = await db.from('email_queue').insert(queueRows);
  if (queueError) { failTo(`Logged but could not queue for delivery: ${queueError.message}`); return; }

  // Bounce back to where we came from, or to association detail if not provided
  const returnTo = str(formData, 'return_to');
  revalidatePath('/calendar');
  revalidatePath('/communication-center');
  if (returnTo && returnTo.startsWith('/')) redirect(returnTo);
  redirect(`/associations/${associationId}?emailed=${count ?? rows.length}`);
}
