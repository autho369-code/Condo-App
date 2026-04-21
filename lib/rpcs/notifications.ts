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

/**
 * Queue emails to owners, tenants, or both — scoped to one association.
 * One `notices` row per recipient so individual delivery status is tracked.
 * Actual send goes through whichever edge function is wired to notices.status='draft'
 * (see FINAL_INTEGRATION.md §1 Email sender).
 */
export async function sendEmail(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();

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
    const { data: occs } = await supabase
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
    const { data: occs } = await supabase
      .from('occupancies')
      .select('owners!owner_id(id, email, full_name)')
      .eq('association_id', associationId)
      .eq('occupancy_type', 'tenant')
      .eq('status', 'current');
    (occs ?? []).forEach((o: any) => {
      if (o.owners?.email) recipients.push({ email: o.owners.email, name: o.owners.full_name ?? '', source: 'tenant' });
    });
  }

  if (recipientType === 'board') {
    const { data: bm } = await supabase
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
    return { error: `No recipients found for ${recipientType} at this association. Make sure owners/tenants have email addresses on file.` };
  }

  // Queue one notices row per recipient so individual delivery status is tracked
  const rows = unique.map((r) => ({
    association_id: associationId,
    notice_type:    'general',
    status:         'draft',
    channel:        'email',
    subject,
    body: cc
      ? body + `\n\n---\nCc: ${cc}`  // Cc text goes into the body footer for now; real SMTP Cc needs provider-specific handling
      : body,
    send_to:        r.email,
    created_by:     me.auth_user_id,
  }));

  const { error, count } = await supabase.from('notices').insert(rows, { count: 'exact' });
  if (error) return { error: error.message };

  // Bounce back to where we came from, or to association detail if not provided
  const returnTo = str(formData, 'return_to');
  revalidatePath('/calendar');
  if (returnTo && returnTo.startsWith('/')) redirect(returnTo);
  redirect(`/associations/${associationId}?emailed=${count ?? rows.length}`);
}
