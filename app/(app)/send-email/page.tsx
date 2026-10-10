import Link from 'next/link';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { sendEmail } from '@/lib/rpcs/notifications';
import { newSubmissionToken, SUBMISSION_FIELD } from '@/lib/forms/submission';
import { Button } from '@/components/ui/button';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Alert, PageShell, Surface } from '@/components/ui/shell';
import { CommunicationDrafter } from '@/components/ai/communication-drafter';
import { safeInternalNext } from '@/lib/security/redirects';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { AssociationSelect } from './_association-select';

export const dynamic = 'force-dynamic';

/**
 * Send Email — compose form for owner/tenant/board email blasts.
 * URL params let entry points pre-fill context:
 *   ?association=<id>         — scope the recipient list
 *   ?subject=...&message=...  — pre-fill subject/body (URL-encoded)
 *   ?return_to=/calendar      — redirect target after send
 */
export default async function SendEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ association?: string; subject?: string; message?: string; return_to?: string; error?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: associations }, { data: profile }] = await Promise.all([
    (supabase as any).from('associations').select('id, name').is('archived_at', null).order('name'),
    (supabase as any).from('profiles').select('email, full_name').eq('id', me.auth_user_id ?? '').maybeSingle(),
  ]);

  const fromEmail = profile?.email ?? me.email ?? me.portfolio?.support_email ?? '';
  const preAssoc = sp.association ?? '';
  const returnTo = safeInternalNext(sp.return_to);
  const closeHref = returnTo ?? '/associations';

  // Recipients per group for the chosen association, counted exactly the way
  // sendEmail resolves them: distinct email addresses of current, unarchived
  // owners / active tenants / active board members ("both" de-duplicates
  // across owners and tenants).
  let ownerCount: number | null = null, tenantCount: number | null = null, bothCount: number | null = null, boardCount: number | null = null;
  let countError: string | null = null;
  const validAssoc = (associations ?? []).some((a: any) => a.id === preAssoc) ? preAssoc : '';
  if (validAssoc) {
    const db = supabase as any;
    const [occs, tens, board] = await Promise.all([
      fetchAllRows<any>(() => db.from('occupancies')
        .select('id, owners!owner_id(email, archived_at)')
        .eq('association_id', validAssoc)
        .eq('occupancy_type', 'owner')
        .eq('status', 'current')
        .order('id')),
      fetchAllRows<any>(() => db.from('tenants')
        .select('id, email')
        .eq('association_id', validAssoc)
        .eq('status', 'active')
        .is('archived_at', null)
        .order('id')),
      fetchAllRows<any>(() => db.from('board_members')
        .select('id, email')
        .eq('association_id', validAssoc)
        .eq('active', true)
        .order('id')),
    ]);
    countError = occs.error ?? tens.error ?? board.error;
    if (!countError) {
      const emails = (list: Array<string | null | undefined>) => new Set(list.filter((e): e is string => !!e).map((e) => e.toLowerCase()));
      const ownerEmails = emails(occs.rows.filter((o: any) => o.owners && !o.owners.archived_at).map((o: any) => o.owners.email));
      const tenantEmails = emails(tens.rows.map((t: any) => t.email));
      ownerCount = ownerEmails.size;
      tenantCount = tenantEmails.size;
      bothCount = new Set([...ownerEmails, ...tenantEmails]).size;
      boardCount = emails(board.rows.map((b: any) => b.email)).size;
    }
  }

  return (
    <PageShell className="max-w-3xl">
      <Surface padded={false}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-gray-950">Send email</h1>
          <Link
            href={closeHref}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>

        <form action={sendEmail as any} className="space-y-5 px-6 py-5">
          <input type="hidden" name={SUBMISSION_FIELD} value={newSubmissionToken()} />
          {sp.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              <span className="font-semibold">Could not send email:</span> {sp.error}
            </div>
          )}
          {returnTo && <input type="hidden" name="return_to" value={returnTo} />}

          {/* From */}
          <Field label="From" required>
            <Input value={fromEmail} readOnly placeholder="Your company's sending address" className="bg-gray-50 text-gray-700" />
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="from_donotreply" className="h-4 w-4 rounded border-gray-300" />
              Send from the no-reply address
            </label>
          </Field>

          {/* Association */}
          <Field label="Association" htmlFor="association_id" required>
            <AssociationSelect associations={associations ?? []} defaultValue={validAssoc} />
          </Field>

          {/* Recipient type — owners / tenants / both / board */}
          <Field
            label="Recipients"
            required
            hint="A separate email will be sent to each recipient for privacy. Only people with an email address on file receive it."
          >
            {countError && <Alert tone="warning" title="Recipient counts could not be loaded." className="mb-2">{countError}</Alert>}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <RecipientOption value="owners" label="Owners only" count={ownerCount} />
              <RecipientOption value="tenants" label="Tenants only" count={tenantCount} />
              <RecipientOption value="both" label="Owners + Tenants" count={bothCount} defaultChecked />
              <RecipientOption value="board" label="Board members" count={boardCount} />
            </div>
          </Field>

          {/* Cc */}
          <Field label="Cc" htmlFor="cc">
            <Input id="cc" name="cc" placeholder="someone@example.com" />
          </Field>

          {/* Additional Recipients */}
          <Field label="Additional recipients" htmlFor="additional_recipients">
            <Input id="additional_recipients" name="additional_recipients" placeholder="Comma-separated emails" />
          </Field>

          {/* AI drafting copilot */}
          <CommunicationDrafter subjectId="subject" bodyId="message" />

          {/* Subject */}
          <Field label="Subject" htmlFor="subject" required>
            <Input id="subject" name="subject" required defaultValue={sp.subject ?? ''} />
          </Field>

          {/* Message */}
          <Field label="Message" htmlFor="message" required>
            <Textarea id="message" name="message" required rows={10} defaultValue={sp.message ?? ''} />
          </Field>

          {/* File attachments aren't supported by the email pipeline yet — no
              dropzone is shown so files can't be silently dropped. To share a
              file, upload it in Documents and paste its link in the message. */}
          <Field label="Attachments">
            <p className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm text-gray-500">
              Direct file attachments aren&apos;t supported yet. Upload the file in{' '}
              <Link href="/documents" className="font-medium text-gray-700 underline underline-offset-2 hover:text-gray-950">Documents</Link>{' '}
              and paste its share link into the message instead.
            </p>
          </Field>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <div className="flex gap-2">
              <PendingSubmit pendingLabel="Sending…">Send</PendingSubmit>
              <Link href={closeHref}>
                <Button variant="secondary" type="button">Cancel</Button>
              </Link>
            </div>
            <p className="text-sm text-gray-500">Sent under your company&apos;s name.</p>
          </div>
        </form>
      </Surface>
    </PageShell>
  );
}

function RecipientOption({
  value, label, count, defaultChecked,
}: {
  value: string; label: string; count: number | null; defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 transition-colors hover:border-blue-500 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/50">
      <input type="radio" name="recipient_type" value={value} defaultChecked={defaultChecked} className="mt-1" />
      <div className="flex-1 text-sm">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-[13px] text-gray-500">
          {count == null ? 'Choose an association to see the count' : `${count} recipient${count === 1 ? '' : 's'} with email on file`}
        </div>
      </div>
    </label>
  );
}
