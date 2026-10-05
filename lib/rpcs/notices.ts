'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { queueEmails, textToHtml } from '@/lib/email/queue';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { claimSubmission, completeSubmission, releaseSubmission } from '@/lib/forms/submission';
import { isUuid, managesAssociation } from '@/lib/security/association-scope';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Send a draft notice by email. Recipients are the notice's notice_recipients
 * rows; a notice addressed to all owners resolves the association's current
 * owners (with an email, not archived) and records them as recipients first.
 * The notice is marked sent only after every email is queued.
 */
export async function sendNotice(formData: FormData) {
  const me = await requireStaff();
  const db = (await createClient()) as any;

  const noticeId = String(formData.get('notice_id') ?? '');
  const base = isUuid(noticeId) ? `/documents/notices/${noticeId}` : '/documents?tab=notices';
  const failTo = (msg: string): never => redirect(`${base}?error=${encodeURIComponent(msg)}`);
  if (!isUuid(noticeId)) failTo('That notice is not valid.');

  const { data: notice, error: noticeError } = await db
    .from('notices')
    .select('id, association_id, status, subject, body, send_to, channel, archived_at, associations(portfolio_id, name)')
    .eq('id', noticeId)
    .maybeSingle();
  if (noticeError) failTo(`Could not load the notice: ${noticeError.message}`);
  if (!notice) failTo('That notice is unavailable or outside your access.');

  // The notice must belong to the caller's company and an association they manage.
  const noticePortfolio = notice.associations?.portfolio_id ?? null;
  if (!me.is_platform_operator && (!noticePortfolio || noticePortfolio !== me.portfolio?.id)) {
    failTo('That notice is unavailable or outside your access.');
  }
  if (!(await managesAssociation(db, notice.association_id))) {
    failTo('That notice belongs to an association outside your access.');
  }
  if (notice.archived_at) failTo('This notice is archived.');
  if (notice.status !== 'draft') failTo('This notice has already been sent.');
  if (notice.channel && notice.channel !== 'email') failTo(`This notice is set to the ${notice.channel} channel; only email notices can be sent here.`);

  // Recipients already recorded on the notice.
  const existing = await fetchAllRows(() => db
    .from('notice_recipients')
    .select('id, owner_id, email, name')
    .eq('notice_id', noticeId)
    .order('id'));
  if (existing.error) failTo(`Could not load the notice recipients: ${existing.error}`);
  if (existing.truncated) failTo('This notice has too many recipients to send in one batch.');
  let recipients = (existing.rows as Array<{ owner_id: string | null; email: string; name: string | null }>)
    .filter((r) => r.email && EMAIL_RE.test(r.email.trim()));

  if (!existing.rows.length && notice.send_to === 'all_owners') {
    const occs = await fetchAllRows(() => db
      .from('occupancies')
      .select('id, owners!owner_id(id, email, full_name, archived_at)')
      .eq('association_id', notice.association_id)
      .eq('occupancy_type', 'owner')
      .eq('status', 'current')
      .order('id'));
    if (occs.error) failTo(`Could not load the association's owners: ${occs.error}`);
    if (occs.truncated) failTo('This association has too many owners to send in one batch.');
    const seenOwner = new Set<string>();
    const resolved = (occs.rows as any[])
      .map((o) => o.owners)
      .filter((o) => o?.email && !o.archived_at && EMAIL_RE.test(String(o.email).trim()))
      .filter((o) => (seenOwner.has(o.id) ? false : (seenOwner.add(o.id), true)))
      .map((o) => ({ owner_id: o.id as string, email: String(o.email).trim(), name: (o.full_name ?? null) as string | null }));
    if (resolved.length) {
      const { error: insertError } = await db.from('notice_recipients').insert(
        resolved.map((r) => ({ notice_id: noticeId, owner_id: r.owner_id, email: r.email, name: r.name })),
      );
      if (insertError) failTo(`Could not record the notice recipients: ${insertError.message}`);
    }
    recipients = resolved;
  }

  // Deduplicate by address.
  const seen = new Set<string>();
  recipients = recipients.filter((r) => {
    const key = r.email.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!recipients.length) failTo('No recipients with an email address on file. Add owner email addresses and try again.');

  // A double click or a re-sent form must not email everyone twice.
  const claim = await claimSubmission(db, formData, 'notice_send');
  if (claim.status === 'error') failTo(claim.message);
  if (claim.status === 'duplicate') redirect(`/documents/notices/${noticeId}?sent=already`);
  const token = (claim as { token: string }).token;

  const html = textToHtml(notice.body ?? '');
  const { error: queueError, count } = await queueEmails(db, recipients.map((r) => ({
    to: r.email.trim(),
    toName: r.name,
    subject: notice.subject,
    html,
    // Delivery brands the email with the client company of this portfolio.
    portfolioId: noticePortfolio,
    associationId: notice.association_id,
    noticeId,
    ownerId: r.owner_id,
    sentBy: me.auth_user_id,
    // Keyed per notice + address: a retry after a partial failure cannot
    // queue the same person twice.
    idempotencyKey: `notice:${noticeId}:${r.email.trim().toLowerCase()}`,
  })));
  if (queueError) {
    await releaseSubmission(db, token);
    failTo(`Could not queue the notice emails: ${queueError}`);
  }

  const { error: markError } = await db
    .from('notices')
    .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', noticeId)
    .eq('status', 'draft');
  if (markError) {
    await releaseSubmission(db, token);
    failTo(`The emails were queued, but the notice could not be marked sent: ${markError.message}. Sending again will not email anyone twice.`);
  }
  await completeSubmission(db, token, noticeId);

  revalidatePath('/documents');
  revalidatePath(`/documents/notices/${noticeId}`);
  redirect(`/documents/notices/${noticeId}?sent=${count || recipients.length}`);
}
