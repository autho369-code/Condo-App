import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { sendEmail } from '@/lib/rpcs/notifications';

export const dynamic = 'force-dynamic';

/**
 * Send Email — compose form matching AppFolio's Send Email modal.
 * URL params let entry points pre-fill context:
 *   ?association=<id>         — scope the recipient list
 *   ?subject=...&message=...  — pre-fill subject/body (URL-encoded)
 *   ?return_to=/calendar      — redirect target after send
 */
export default async function SendEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ association?: string; subject?: string; message?: string; return_to?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: associations }, { data: profile }] = await Promise.all([
    supabase.from('associations').select('id, name').is('archived_at', null).order('name'),
    supabase.from('profiles').select('email, full_name').eq('id', me.auth_user_id ?? '').maybeSingle(),
  ]);

  const fromEmail = profile?.email ?? me.email ?? 'no-reply@condo-app.example';
  const preAssoc = sp.association ?? '';

  // Pull counts per recipient group for the preselected association so the
  // user knows how many each bucket resolves to before hitting Send.
  let ownerCount = 0, tenantCount = 0, boardCount = 0;
  if (preAssoc) {
    const [ownC, tenC, brdC] = await Promise.all([
      supabase.from('occupancies')
        .select('*', { count: 'exact', head: true })
        .eq('association_id', preAssoc)
        .eq('occupancy_type', 'owner')
        .eq('status', 'current'),
      supabase.from('occupancies')
        .select('*', { count: 'exact', head: true })
        .eq('association_id', preAssoc)
        .eq('occupancy_type', 'tenant')
        .eq('status', 'current'),
      supabase.from('board_members')
        .select('*', { count: 'exact', head: true })
        .eq('association_id', preAssoc)
        .eq('active', true),
    ]);
    ownerCount  = ownC.count ?? 0;
    tenantCount = tenC.count ?? 0;
    boardCount  = brdC.count ?? 0;
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-6">
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-900">Send Email</h1>
          <Link href={sp.return_to && sp.return_to.startsWith('/') ? sp.return_to : '/associations'}
            className="text-gray-400 hover:text-gray-600" aria-label="Close">×</Link>
        </div>

        <form action={sendEmail} className="space-y-5 px-6 py-5">
          {sp.return_to && <input type="hidden" name="return_to" value={sp.return_to} />}

          {/* From */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">From <span className="text-red-500">*</span></label>
            <input
              value={fromEmail}
              readOnly
              className="h-10 w-full rounded border border-gray-300 bg-gray-100 px-3 text-sm text-gray-700"
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="from_donotreply" />
              Send from donotreply@condo-app.example
            </label>
          </div>

          {/* Association */}
          <div>
            <label htmlFor="association_id" className="mb-1 block text-sm font-medium text-gray-700">
              Association <span className="text-red-500">*</span>
            </label>
            <select
              id="association_id"
              name="association_id"
              required
              defaultValue={preAssoc}
              className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="">Select an association…</option>
              {(associations ?? []).map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Recipient type — owners / tenants / both / board */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Recipients <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <RecipientOption value="owners" label="Owners only" count={ownerCount} />
              <RecipientOption value="tenants" label="Tenants only" count={tenantCount} />
              <RecipientOption value="both" label="Owners + Tenants" count={ownerCount + tenantCount} defaultChecked />
              <RecipientOption value="board" label="Board members" count={boardCount} />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              A separate email will be sent to each recipient for privacy. Only people with an email address on file receive it.
            </p>
          </div>

          {/* Cc */}
          <div>
            <label htmlFor="cc" className="mb-1 block text-sm font-medium text-gray-700">Cc</label>
            <input
              id="cc"
              name="cc"
              placeholder="someone@example.com"
              className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
            />
          </div>

          {/* Additional Recipients */}
          <div>
            <label htmlFor="additional_recipients" className="mb-1 block text-sm font-medium text-gray-700">
              Additional Recipients
            </label>
            <input
              id="additional_recipients"
              name="additional_recipients"
              placeholder="Comma-separated emails"
              className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
            />
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="subject" className="mb-1 block text-sm font-medium text-gray-700">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              id="subject"
              name="subject"
              required
              defaultValue={sp.subject ?? ''}
              className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
            />
          </div>

          {/* Message */}
          <div>
            <label htmlFor="message" className="mb-1 block text-sm font-medium text-gray-700">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={10}
              defaultValue={sp.message ?? ''}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          {/* Attachments — placeholder; actual upload via storage bucket is tracked in FINAL_INTEGRATION.md */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Attachments</label>
            <div className="rounded border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
              <strong>Drag Files Here</strong>
              <span className="mx-3 text-gray-400">or</span>
              <label className="inline-block cursor-pointer rounded border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50">
                Choose Files to Add
                <input type="file" name="attachments" multiple className="hidden" />
              </label>
              <p className="mt-2 text-xs text-gray-400">
                Upload pipeline lands in next integration pass — see FINAL_INTEGRATION.md
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <div className="flex gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Send
              </button>
              <Link
                href={sp.return_to && sp.return_to.startsWith('/') ? sp.return_to : '/associations'}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
            </div>
            <Link href="/settings" className="text-sm text-blue-700 hover:underline">
              Customize My Signature
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecipientOption({
  value, label, count, defaultChecked,
}: {
  value: string; label: string; count: number; defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded border border-gray-200 bg-white px-3 py-2 hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
      <input type="radio" name="recipient_type" value={value} defaultChecked={defaultChecked} className="mt-1" />
      <div className="flex-1 text-sm">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{count} recipient{count === 1 ? '' : 's'} with email on file</div>
      </div>
    </label>
  );
}
