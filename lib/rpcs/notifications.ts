'use server';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { emailQueueRow, textToHtml } from '@/lib/email/queue';
import { safeInternalNext } from '@/lib/security/redirects';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { claimSubmission, releaseSubmission } from '@/lib/forms/submission';
import { managesAssociation } from '@/lib/security/association-scope';

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};

/**
 * Queue emails to owners, tenants, or both — scoped to one association.
 * One communication_messages row per recipient tracks delivery; email_queue
 * rows (idempotent per form submission and address) carry the actual send.
 */
export async function sendEmail(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const failTo = (msg: string) => {
    const base = safeInternalNext(str(formData, 'return_to')) ?? '/send-email';
    redirect(`${base}${base.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`);
  };

  // A missing field redirects back with a message instead of a crash page.
  const need = (k: string, label: string): string => str(formData, k) ?? (failTo(`Enter ${label}.`) as never);
  const associationId = need('association_id', 'an association');
  const recipientType = need('recipient_type', 'the recipients'); // owners | tenants | both | board
  const subject       = need('subject', 'a subject');
  const body          = need('message', 'a message');
  const cc            = str(formData, 'cc');
  const additional    = str(formData, 'additional_recipients'); // comma-sep extra emails
  const fromOverride  = formData.get('from_donotreply') === 'on';
  if (!['owners', 'tenants', 'both', 'board'].includes(recipientType)) { failTo('Choose who should receive this email.'); return; }
  // communications_log RLS only checks portfolio_id, so without this an
  // announcement could be published into another company's association.
  if (!(await managesAssociation(db, associationId))) {
    failTo('That association is unavailable or outside your access.');
    return;
  }

  // Resolve recipient email addresses based on the type picker. Paged past
  // PostgREST's 1,000-row cap; a failed read stops the send rather than
  // emailing a partial list.
  const recipients: Array<{ email: string; name: string; source: string }> = [];
  const readAll = async (label: string, build: () => any) => {
    const { rows, error } = await fetchAllRows(build);
    if (error) failTo(`Could not load ${label}: ${error}`);
    return rows as any[];
  };

  if (recipientType === 'owners' || recipientType === 'both') {
    const occs = await readAll('owners', () => db
      .from('occupancies')
      .select('id, owners!owner_id(id, email, full_name, archived_at)')
      .eq('association_id', associationId)
      .eq('occupancy_type', 'owner')
      .eq('status', 'current')
      .order('id'));
    occs.forEach((o: any) => {
      if (o.owners?.email && !o.owners.archived_at) recipients.push({ email: o.owners.email, name: o.owners.full_name ?? '', source: 'owner' });
    });
  }

  if (recipientType === 'tenants' || recipientType === 'both') {
    // Tenants live in the dedicated tenants table (not occupancies).
    const ten = await readAll('tenants', () => db
      .from('tenants')
      .select('id, email, first_name, last_name')
      .eq('association_id', associationId)
      .eq('status', 'active')
      .is('archived_at', null)
      .order('id'));
    ten.forEach((t: any) => {
      if (t.email) recipients.push({ email: t.email, name: `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim(), source: 'tenant' });
    });
  }

  if (recipientType === 'board') {
    const bm = await readAll('board members', () => db
      .from('board_members')
      .select('id, email, full_name')
      .eq('association_id', associationId)
      .eq('active', true)
      .order('id'));
    bm.forEach((b: any) => {
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

  // Add Additional Recipients and Cc (comma/semicolon-separated emails). Cc
  // used to be pasted into the body as text, so nobody on it got the email.
  const extra = [additional, cc].filter(Boolean).join(',');
  if (extra) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const bad = extra.split(/[,;]/).map((s) => s.trim()).filter((em) => em && !emailRe.test(em));
    if (bad.length > 0) { failTo(`Not a valid email address: ${bad.join(', ')}`); return; }
    extra.split(/[,;]/).map((s) => s.trim()).filter(Boolean).forEach((em) => {
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

  const fullBody = body;
  const fromName = me.portfolio?.company_name ?? 'Portier369';

  // Publish the resident announcement FIRST: if it fails nothing else has been
  // written (previously the per-recipient rows were left 'queued' forever).
  // Publish one durable portal announcement for resident audiences. Portal
  // feeds read this ledger rather than recipient-level email rows so private
  // addresses and delivery metadata are never exposed.
  // A double click or re-sent form must not email everyone twice.
  const claim = await claimSubmission(db, formData, 'mass_email');
  if (claim.status === 'error') { failTo(claim.message); return; }
  if (claim.status === 'duplicate') { redirect('/communication-center?notice=already_sent'); return; }
  const submissionToken = (claim as { token: string }).token;

  if (recipientType === 'owners' || recipientType === 'tenants' || recipientType === 'both') {
    const { error: announcementError } = await db.from('communications_log').insert({
      portfolio_id: me.portfolio?.id,
      association_id: associationId,
      sender_id: me.auth_user_id,
      direction: 'outbound',
      channel: 'announcement',
      announcement_audience: recipientType,
      recipient_count: unique.length,
      status: 'sent',
      subject,
      body: fullBody,
    });
    if (announcementError) {
      await releaseSubmission(db, submissionToken);
      failTo(`Could not publish the resident announcement: ${announcementError.message}`);
      return;
    }
  }

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

  const { data: insertedMessages, error: communicationError } = await db.from('communication_messages').insert(communicationRows).select('id, recipient_email');
  if (communicationError) { await releaseSubmission(db, submissionToken); failTo(communicationError.message); return; }
  const count = (insertedMessages ?? []).length;
  // Each email_queue row must carry its communication_message_id: delivery
  // updates the message status through it (otherwise "Queued" forever).
  const messageIdByEmail = new Map<string, string>(
    (insertedMessages ?? []).map((m: { id: string; recipient_email: string }) => [String(m.recipient_email).toLowerCase(), m.id]),
  );

  // (No per-recipient `notices` rows: residents can read association notices,
  // so those rows exposed every recipient's email address.)

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
    communicationMessageId: messageIdByEmail.get(r.email.toLowerCase()) ?? null,
    fromAddress: fromOverride ? 'noreply@portier369.com' : 'hello@portier369.com',
    fromName,
    sentBy: me.auth_user_id,
    idempotencyKey: `mass-email:${submissionToken}:${r.email.toLowerCase()}`,
  }));
  const { error: queueError } = await db.from('email_queue').insert(queueRows);
  if (queueError) { failTo(`Logged but could not queue for delivery: ${queueError.message}`); return; }

  // Bounce back to where we came from, or to association detail if not provided
  const returnTo = safeInternalNext(str(formData, 'return_to'));
  revalidatePath('/calendar');
  revalidatePath('/communication-center');
  if (returnTo) redirect(returnTo);
  // /associations/[id] redirects on to /units and dropped the confirmation.
  redirect(`/communication-center?queued=${count}`);
}
