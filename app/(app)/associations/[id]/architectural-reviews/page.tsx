import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function ArchitecturalReviewsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();

  const { data: assoc, error: aErr } = await (supabase as any)
    .from('associations').select('id, name').eq('id', id).maybeSingle();
  if (aErr || !assoc) notFound();

  const { data: settings } = await (supabase as any)
    .from('architectural_review_settings')
    .select('*')
    .eq('association_id', id)
    .maybeSingle();

  const { data: committees } = await (supabase as any)
    .from('committees')
    .select('id, name')
    .eq('association_id', id)
    .is('archived_at', null)
    .order('name');

  async function saveSettings(formData: FormData) {
    'use server';
    const supabase = await createClient();

    await (supabase as any).from('architectural_review_settings').upsert({
      association_id: id,
      online_requests_disabled: formData.get('online_requests_disabled') === 'on',
      default_committee_id: (formData.get('default_committee_id') as string) || null,
      default_approver_scope: (formData.get('default_approver_scope') as string) || 'all',
      default_voting_scheme: (formData.get('default_voting_scheme') as string) || 'majority_approval_required',
      portal_homepage_html: (formData.get('portal_homepage_html') as string) || null,
      submission_form_html: (formData.get('submission_form_html') as string) || null,
      document_upload_html: (formData.get('document_upload_html') as string) || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'association_id' });
  }

  const rail = null;

  return (
    <Workspace
      header={
        <>
          <AssociationTabs associationId={id} active="architectural-reviews" />
          <WorkspaceHeader title="Architectural Review Settings" subtitle={assoc.name} />
        </>
      }
      rail={rail}
    >
      <form action={saveSettings as any} className="max-w-3xl space-y-5">
        <Section padded>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="online_requests_disabled" defaultChecked={settings?.online_requests_disabled ?? false} />
            Disable online architectural requests
          </label>
        </Section>

        <Section title="Board Approval Defaults" padded>
          <div className="mb-3">
            <label className="mb-1 block text-sm text-gray-600">Select Participants</label>
            <select name="default_committee_id" defaultValue={settings?.default_committee_id ?? ''} className="w-full max-w-md rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
              <option value="">â€” Select a committee â€”</option>
              {(committees ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="mb-3 flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="default_approver_scope" value="all" defaultChecked={(settings?.default_approver_scope ?? 'all') === 'all'} />
              All
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="default_approver_scope" value="select" defaultChecked={settings?.default_approver_scope === 'select'} />
              Select Approvers
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-600">Voting Scheme</label>
            <select name="default_voting_scheme" defaultValue={settings?.default_voting_scheme ?? 'majority_approval_required'} className="w-72 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
              <option value="majority_approval_required">Majority Approval Required</option>
              <option value="unanimous_approval_required">Unanimous Approval Required</option>
              <option value="any_one_approver">Any One Approver</option>
              <option value="percentage_required">Percentage Required</option>
            </select>
          </div>
        </Section>

        <RichTextSection
          title="Portal Homepage"
          help="Provide a brief overview of what you would like homeowners to know prior to submitting an Architectural Review."
          name="portal_homepage_html"
          defaultValue={settings?.portal_homepage_html ?? ''}
        />

        <RichTextSection
          title="Architectural Review Submission Form"
          help="Give the homeowner context for how you would like them to describe the modification they'd like to make to their home."
          name="submission_form_html"
          defaultValue={settings?.submission_form_html ?? ''}
        />

        <RichTextSection
          title="Document Upload Instructions"
          help="Describe the kind of documents you'd like the homeowner to upload."
          name="document_upload_html"
          defaultValue={settings?.document_upload_html ?? ''}
        />

        <div className="flex items-center gap-2 pt-2">
          <Button type="submit" size="sm">Save Settings</Button>
        </div>
      </form>
    </Workspace>
  );
}

function RichTextSection({
  title, help, name, defaultValue,
}: {
  title: string; help: string; name: string; defaultValue: string;
}) {
  return (
    <Section
      title={title}
      actions={<button type="button" className="text-sm text-blue-700 hover:underline">Preview</button>}
      padded
    >
      <p className="mb-2 text-sm text-gray-600">{help}</p>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={6}
        className="block w-full resize-y rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        maxLength={500}
      />
      <div className="mt-1 text-right text-xs text-gray-400">0/500</div>
    </Section>
  );
}
