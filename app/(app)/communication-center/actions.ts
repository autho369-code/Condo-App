'use server';

// Approve & send a Communication Center message. Resolves the message's
// recipient group (or its explicit recipient_email) to real addresses at send
// time and delivers via email_queue → Resend. Email channel only; SMS messages
// are handled in the SMS console.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { emailQueueRow, textToHtml } from '@/lib/email/queue';

const CENTER = '/communication-center';

function fail(message: string): never {
  redirect(`${CENTER}?error=${encodeURIComponent(message)}`);
}

type Recipient = { email: string; name: string };

export async function sendCommunication(formData: FormData) {
  const me = await requireStaff();
  const messageId = formData.get('message_id') as string;
  if (!messageId) fail('No message specified.');

  const supabase = await createClient();
  const db = supabase as any;

  const { data: msg } = await db
    .from('communication_messages')
    .select('id, channel, status, association_id, portfolio_id, calendar_event_id, recipient_group, recipient_email, recipient_name, subject, body')
    .eq('id', messageId)
    .maybeSingle();

  if (!msg) fail('Message not found.');
  if (msg.channel !== 'email') fail('Only email messages can be sent from here. Use the SMS console for text messages.');
  if (msg.status === 'sent') fail('This message has already been sent.');
  if (!msg.subject || !msg.body) fail('This message is missing a subject or body.');

  const recipients = await resolveRecipients(db, msg);
  if (recipients.length === 0) {
    fail(`No recipients with an email address could be resolved for "${String(msg.recipient_group ?? 'this message').replace(/_/g, ' ')}".`);
  }

  const html = textToHtml(msg.body);
  const fromName = me.portfolio?.company_name ?? 'Portier369';
  const queueRows = recipients.map((r) => emailQueueRow({
    to: r.email,
    toName: r.name || null,
    subject: msg.subject,
    html,
    portfolioId: msg.portfolio_id ?? me.portfolio?.id,
    associationId: msg.association_id,
    fromName,
    sentBy: me.auth_user_id,
  }));

  const { error: queueError } = await db.from('email_queue').insert(queueRows);
  if (queueError) fail(`Could not queue for delivery: ${queueError.message}`);

  await db.from('communication_messages')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', messageId);

  revalidatePath(CENTER);
  redirect(`${CENTER}?sent=${recipients.length}`);
}

async function resolveRecipients(db: any, msg: any): Promise<Recipient[]> {
  // Explicit recipient wins.
  if (msg.recipient_email) {
    return [{ email: msg.recipient_email, name: msg.recipient_name ?? '' }];
  }

  const group = String(msg.recipient_group ?? '').toLowerCase();
  const assocId = msg.association_id;
  const out: Recipient[] = [];

  const ownerGroups = ['affected_residents', 'all_owners', 'owners', 'both', 'residents'];
  if (assocId && (ownerGroups.includes(group))) {
    const { data: occs } = await db
      .from('occupancies')
      .select('owners!owner_id(email, full_name)')
      .eq('association_id', assocId)
      .eq('occupancy_type', 'owner')
      .eq('status', 'current');
    (occs ?? []).forEach((o: any) => {
      if (o.owners?.email) out.push({ email: o.owners.email, name: o.owners.full_name ?? '' });
    });
  }

  if (assocId && (group === 'tenants' || group === 'both')) {
    const { data: ten } = await db
      .from('tenants')
      .select('email, first_name, last_name')
      .eq('association_id', assocId)
      .eq('status', 'active')
      .is('archived_at', null);
    (ten ?? []).forEach((t: any) => {
      if (t.email) out.push({ email: t.email, name: `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim() });
    });
  }

  if (assocId && (group === 'board' || group === 'board_members')) {
    const { data: bm } = await db
      .from('board_members')
      .select('email, full_name')
      .eq('association_id', assocId)
      .eq('active', true);
    (bm ?? []).forEach((b: any) => {
      if (b.email) out.push({ email: b.email, name: b.full_name ?? '' });
    });
  }

  if (group === 'vendor' && msg.calendar_event_id) {
    const { data: ev } = await db
      .from('calendar_events')
      .select('vendors:vendor_id(name, emails)')
      .eq('id', msg.calendar_event_id)
      .maybeSingle();
    const emails = ev?.vendors?.emails;
    const email = Array.isArray(emails) ? emails[0] : null;
    if (email) out.push({ email, name: ev?.vendors?.name ?? '' });
  }

  if (group === 'management_office') {
    const { data: admins } = await db
      .from('profiles')
      .select('email, full_name')
      .eq('portfolio_id', msg.portfolio_id)
      .eq('hoa_role', 'company_admin');
    (admins ?? []).forEach((a: any) => {
      if (a.email) out.push({ email: a.email, name: a.full_name ?? '' });
    });
    if (out.length === 0 && msg.portfolio_id) {
      const { data: pf } = await db.from('portfolios').select('support_email, company_name').eq('id', msg.portfolio_id).maybeSingle();
      if (pf?.support_email) out.push({ email: pf.support_email, name: pf.company_name ?? 'Management office' });
    }
  }

  // Dedupe by email.
  const seen = new Set<string>();
  return out.filter((r) => {
    const k = r.email.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
