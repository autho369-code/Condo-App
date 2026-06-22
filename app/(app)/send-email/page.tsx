import Link from 'next/link';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { sendEmail } from '@/lib/rpcs/notifications';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { PageShell, Surface } from '@/components/ui/shell';
import { CommunicationDrafter } from '@/components/ai/communication-drafter';

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

  const fromEmail = profile?.email ?? me.email ?? 'no-reply@condo-app.example';
  const preAssoc = sp.association ?? '';
  const closeHref = sp.return_to && sp.return_to.startsWith('/') ? sp.return_to : '/associations';

  // Pull counts per recipient group for the preselected association so the
  // user knows how many each bucket resolves to before hitting Send.
  let ownerCount = 0, tenantCount = 0, boardCount = 0;
  if (preAssoc) {
    const [ownC, tenC, brdC] = await Promise.all([
      (supabase as any).from('occupancies')
        .select('*', { count: 'exact', head: true })
        .eq('association_id', preAssoc)
        .eq('occupancy_type', 'owner')
        .eq('status', 'current'),
      (supabase as any).from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('association_id', preAssoc)
        .eq('status', 'active')
        .is('archived_at', null),
      (supabase as any).from('board_members')
        .select('*', { count: 'exact', head: true })
        .eq('association_id', preAssoc)
        .eq('active', true),
    ]);
    ownerCount  = ownC.count ?? 0;
    tenantCount = tenC.count ?? 0;
    boardCount  = brdC.count ?? 0;
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
          {sp.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              <span className="font-semibold">Could not send email:</span> {sp.error}
            </div>
          )}
          {sp.return_to && <input type="hidden" name="return_to" value={sp.return_to} />}

          {/* From */}
          <Field label="From" required>
            <Input value={fromEmail} readOnly className="bg-gray-50 text-gray-700" />
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="from_donotreply" className="h-4 w-4 rounded border-gray-300" />
              Send from donotreply@condo-app.example
            </label>
          </Field>

          {/* Association */}
          <Field label="Association" htmlFor="association_id" required>
            <Select id="association_id" name="association_id" required defaultValue={preAssoc}>
              <option value="">Select an association…</option>
              {(associations ?? []).map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>

          {/* Recipient type — owners / tenants / both / board */}
          <Field
            label="Recipients"
            required
            hint="A separate email will be sent to each recipient for privacy. Only people with an email address on file receive it."
          >
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <RecipientOption value="owners" label="Owners only" count={ownerCount} />
              <RecipientOption value="tenants" label="Tenants only" count={tenantCount} />
              <RecipientOption value="both" label="Owners + Tenants" count={ownerCount + tenantCount} defaultChecked />
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

          {/* Attachments — placeholder; actual upload via storage bucket is tracked in FINAL_INTEGRATION.md */}
          <Field label="Attachments">
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/60 px-4 py-6 text-center text-sm text-gray-600">
              <strong>Drag files here</strong>
              <span className="mx-3 text-gray-400">or</span>
              <label className="inline-block cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 transition-colors hover:bg-gray-50">
                Choose files to add
                <input type="file" name="attachments" multiple className="hidden" />
              </label>
              <p className="mt-2 text-xs text-gray-400">
                Upload pipeline lands in next integration pass — see FINAL_INTEGRATION.md
              </p>
            </div>
          </Field>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <div className="flex gap-2">
              <Button type="submit">Send</Button>
              <Link href={closeHref}>
                <Button variant="secondary" type="button">Cancel</Button>
              </Link>
            </div>
            <Link href="/settings" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-950">
              Customize my signature
            </Link>
          </div>
        </form>
      </Surface>
    </PageShell>
  );
}

function RecipientOption({
  value, label, count, defaultChecked,
}: {
  value: string; label: string; count: number; defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 transition-colors hover:border-blue-500 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/50">
      <input type="radio" name="recipient_type" value={value} defaultChecked={defaultChecked} className="mt-1" />
      <div className="flex-1 text-sm">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{count} recipient{count === 1 ? '' : 's'} with email on file</div>
      </div>
    </label>
  );
}
