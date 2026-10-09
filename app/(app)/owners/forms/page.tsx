import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const TEMPLATES = [
  { value: 'portal_activation', label: 'Owner portal activation' },
  { value: 'owner_packet', label: 'Owner onboarding packet' },
  { value: 'ach_authorization', label: 'ACH authorization' },
  { value: 'management_agreement', label: 'Management agreement' },
  { value: 'owner_intake', label: 'Owner intake form' },
];

export default async function OwnerFormsPage({ searchParams }: { searchParams: Promise<{ owner?: string; template?: string; error?: string; sent?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: owners } = await (supabase as any).from('owners').select('id, full_name, email').order('full_name').limit(500);

  async function handleSubmit(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const ownerId = (formData.get('owner_id') as string) || null;
    if (!ownerId) redirect(`/owners/forms?error=${encodeURIComponent('Select an owner to send the form to.')}`);

    const template = (formData.get('template') as string) || 'owner_intake';
    const subject = (formData.get('subject') as string) || 'Owner form';
    const message = (formData.get('message') as string) || null;
    const delivery = (formData.get('delivery_method') as string) || 'email';
    const dueDate = (formData.get('due_date') as string) || null;

    // Portal activation is an *invitation*, not a document request: create a real
    // user_invitations row (hoa_role 'owner') so the owner gets an email with a
    // /invite link, sets a password, and can log into the owner portal. The
    // queue_invitation_email trigger sends the email; accepting it links exactly
    // this owner record to the sign-in (link_owner_on_invitation_accept).
    if (template === 'portal_activation') {
      // RLS: only an owner record the staffer can see.
      const { data: owner, error: ownerErr } = await (supabase as any)
        .from('owners')
        .select('id, full_name, email, association_id, portfolio_id, archived_at, portfolios(company_name)')
        .eq('id', ownerId)
        .maybeSingle();
      if (ownerErr) redirect(`/owners/forms?error=${encodeURIComponent(ownerErr.message)}`);
      if (!owner || owner.archived_at) {
        redirect(`/owners/forms?error=${encodeURIComponent('Owner not found.')}`);
      }
      if (!owner.email) {
        redirect(`/owners/forms?error=${encodeURIComponent('This owner has no email on file. Add an email before sending a portal activation.')}`);
      }
      const email = owner.email.trim().toLowerCase();
      const svc = createServiceClient() as any;
      // The invitation is in the owner record's own company and association,
      // so accepting it links exactly this record.
      const { data: invitation, error: inviteErr } = await svc.from('user_invitations').insert({
        portfolio_id: owner.portfolio_id,
        email,
        full_name: owner.full_name,
        hoa_role: 'owner',
        association_id: owner.association_id,
        metadata: { owner_id: owner.id },
        invited_by: me.auth_user_id,
        // The owner's own company (a platform operator may be acting for it).
        message: message || `Activate your owner portal for ${owner.portfolios?.company_name ?? 'your community'}.`,
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      }).select('id, created_at').single();
      if (inviteErr || !invitation) {
        redirect(`/owners/forms?error=${encodeURIComponent(inviteErr?.message ?? 'Could not create the invitation.')}`);
      }
      // Only once the new link exists: revoke this record's older pending
      // links (and older owner links naming no record), so one link is live.
      // A pending staff or board invite to the same address, or this person's
      // invitations for their other associations, stay.
      const { error: revokeErr } = await svc.from('user_invitations')
        .update({ status: 'revoked', updated_at: new Date().toISOString() })
        .eq('email', email)
        .eq('portfolio_id', owner.portfolio_id)
        .eq('hoa_role', 'owner')
        .eq('status', 'pending')
        .or(`metadata->>owner_id.eq.${owner.id},metadata->>owner_id.is.null`)
        // Only links created before this one: two overlapping sends never
        // cancel each other's new link.
        .lt('created_at', invitation.created_at)
        .neq('id', invitation.id);
      if (revokeErr) {
        redirect(`/owners/forms?error=${encodeURIComponent(`The new link was sent, but an older link could not be cancelled: ${revokeErr.message}`)}`);
      }
      redirect('/owners/forms?sent=1');
    }

    // All other owner "forms" are document/form requests sent to a specific owner.
    const { error } = await (supabase as any).from('document_requests').insert({
      portfolio_id: me.portfolio?.id,
      owner_id: ownerId,
      doc_type: template,
      name: subject,
      description: message,
      due_date: dueDate,
      requested_by: me.auth_user_id,
      notes: `Delivery: ${delivery}`,
      status: 'requested',
    });
    if (error) {
      redirect(`/owners/forms?error=${encodeURIComponent(error.message)}`);
    }

    // The request row alone reached nobody (owners have no portal view of
    // document_requests), so actually email the owner when email is chosen.
    if (delivery === 'email') {
      const { data: recipient } = await (supabase as any)
        .from('owners').select('full_name, email').eq('id', ownerId).maybeSingle();
      if (!recipient?.email) {
        redirect(`/owners/forms?error=${encodeURIComponent('The request was recorded, but this owner has no email on file, so nothing was sent. Add an email or choose another delivery method.')}`);
      }
      const { queueEmails } = await import('@/lib/email/queue');
      const company = me.portfolio?.company_name ?? 'Your management office';
      const queued = await queueEmails(supabase, [{
        to: recipient.email,
        toName: recipient.full_name,
        subject,
        text: [
          `Hello ${recipient.full_name},`,
          '',
          ...(message ? [message, ''] : []),
          ...(dueDate ? [`Please return this by ${dueDate}.`, ''] : []),
          `Reply to this email with the completed form or document, or contact ${company} with any questions.`,
          '',
          company,
        ].join('\n'),
        portfolioId: me.portfolio?.id,
        fromName: company,
        replyTo: me.portfolio?.support_email ?? me.portfolio?.brand_email ?? null,
        sentBy: me.auth_user_id,
        ownerId,
      }]);
      if (queued.error) {
        redirect(`/owners/forms?error=${encodeURIComponent(`The request was recorded but the email could not be queued: ${queued.error}`)}`);
      }
      redirect('/owners/forms?sent=email');
    }
    redirect('/owners/forms?sent=1');
  }

  return (
    <DataWorkspace
      title="Send Owner Form"
      description="Stage owner communications with recipient, template, and delivery context."
      actions={<Link href="/owners"><Button variant="secondary">Back to owners</Button></Link>}
    >
      <div className="max-w-4xl space-y-4">
        {sp.error && <Alert tone="danger" title="Could not stage the form:">{sp.error}</Alert>}
        {sp.sent === 'email' && <Alert tone="success" title="Form request emailed.">The owner has been emailed and the request is tracked on their record.</Alert>}
        {sp.sent === '1' && <Alert tone="success" title="Form request recorded.">Deliver it by the method you chose; it is tracked on the owner&apos;s record.</Alert>}
        <Surface>
          <form action={handleSubmit as any} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Owner" htmlFor="owner_id">
                <Select id="owner_id" name="owner_id" defaultValue={sp.owner ?? ''}>
                  <option value="">Select an owner</option>
                  {(owners ?? []).map((owner: any) => <option key={owner.id} value={owner.id}>{owner.full_name} - {owner.email}</option>)}
                </Select>
              </Field>
              <Field label="Template" htmlFor="template">
                <Select id="template" name="template" defaultValue={sp.template ?? 'owner_intake'}>
                  {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Subject" htmlFor="subject">
              <Input id="subject" name="subject" defaultValue="Action requested" />
            </Field>
            <Field label="Message" htmlFor="message">
              <Textarea id="message" name="message" rows={4} placeholder="Enter message..." />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Delivery" htmlFor="delivery_method">
                <Select id="delivery_method" name="delivery_method">
                  <option value="email">Email</option><option value="portal">Owner portal</option><option value="mail">Mail</option>
                </Select>
              </Field>
              <Field label="Due date (optional)" htmlFor="due_date">
                <Input id="due_date" name="due_date" type="date" />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <Link href="/owners"><Button variant="secondary" type="button">Cancel</Button></Link>
              <Button type="submit">Send form</Button>
            </div>
          </form>
        </Surface>
      </div>
    </DataWorkspace>
  );
}
