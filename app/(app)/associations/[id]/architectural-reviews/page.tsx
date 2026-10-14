import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { resolveAssociation } from '@/lib/associations/resolve';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/shell';
import { Field, Select, Textarea } from '@/components/ui/input';

export const dynamic = 'force-dynamic';

export default async function ArchitecturalReviewsTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireStaff();
  const { id: assocParam } = await params;
  const sp = await searchParams;
  const association = await resolveAssociation(assocParam);
  if (!association) notFound();
  const id = association.id;
  const supabase = await createClient();

  const { data: assoc, error: aErr } = await (supabase as any)
    .from('associations').select('id, name').eq('id', id).maybeSingle();
  if (aErr || !assoc) notFound();

  const { data: settings, error: settingsError } = await (supabase as any)
    .from('architectural_review_settings')
    .select('association_id, online_requests_disabled, default_committee_id, portal_homepage_html, submission_form_html, document_upload_html')
    .eq('association_id', id)
    .maybeSingle();

  const { data: committees, error: committeesError } = await (supabase as any)
    .from('committees')
    .select('id, name')
    .eq('association_id', id)
    .is('archived_at', null)
    .order('name');

  async function saveSettings(formData: FormData) {
    'use server';
    await (await import('@/lib/auth/me')).requireStaff();  // in-action guard
    const supabase = await createClient();
    const base = `/associations/${id}/architectural-reviews`;
    const fail = (msg: string) => redirect(`${base}?error=${encodeURIComponent(msg)}`);

    // The caller must manage this association (RLS also scopes the write).
    const { data: manages, error: manageError } = await (supabase as any)
      .rpc('can_manage_association', { p_association_id: id });
    if (manageError || manages !== true) fail('You do not manage this association.');

    // The default committee must be one of this association's own (the
    // database checks it too).
    const committeeId = ((formData.get('default_committee_id') as string) || '').trim() || null;
    if (committeeId) {
      const { data: committee, error: committeeError } = await (supabase as any)
        .from('committees').select('id').eq('id', committeeId).eq('association_id', id).is('archived_at', null).maybeSingle();
      if (committeeError) fail(committeeError.message);
      if (!committee) fail('Choose a committee of this association.');
    }
    const text = (name: string) => (((formData.get(name) as string) ?? '').trim().slice(0, 500)) || null;

    const { error } = await (supabase as any).from('architectural_review_settings').upsert({
      association_id: id,
      online_requests_disabled: formData.get('online_requests_disabled') === 'on',
      default_committee_id: committeeId,
      portal_homepage_html: text('portal_homepage_html'),
      submission_form_html: text('submission_form_html'),
      document_upload_html: text('document_upload_html'),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'association_id' });
    if (error) fail(error.message);
    revalidatePath(base);
    redirect(`${base}?saved=1`);
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
      {sp.error && <Alert tone="danger" title="Settings not saved." className="mb-4 max-w-3xl">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success" title="Settings saved." className="mb-4 max-w-3xl" />}
      {(settingsError || committeesError) && (
        <Alert tone="danger" title="Could not load the settings." className="mb-4 max-w-3xl">
          {(settingsError ?? committeesError)?.message ?? 'Reload the page to try again.'}
        </Alert>
      )}
      <form action={saveSettings as any} className="max-w-3xl space-y-5">
        <Section title="Owner portal" padded>
          <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-gray-900">
            <input type="checkbox" name="online_requests_disabled" aria-describedby="online-requests-hint" defaultChecked={settings?.online_requests_disabled ?? false} className="h-4 w-4 rounded border-gray-300" />
            Turn off online requests
          </label>
          <p id="online-requests-hint" className="ml-6 text-[13px] text-gray-500">Homeowners can&apos;t submit requests from the owner portal; staff still can.</p>
        </Section>

        <Section title="Reviewing committee" padded>
          <Field label="Committee" htmlFor="arc-default-committee" hint="New requests are assigned to this committee.">
            <Select id="arc-default-committee" name="default_committee_id" defaultValue={settings?.default_committee_id ?? ''} className="max-w-md">
              <option value="">No committee</option>
              {(committees ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        </Section>

        <InstructionSection
          title="Requests page note"
          help="Shown to homeowners at the top of their architectural requests page, for example what needs approval and how long a review takes."
          name="portal_homepage_html"
          defaultValue={settings?.portal_homepage_html ?? ''}
        />

        <InstructionSection
          title="Request form guidance"
          help="Shown above the new-request form: what to include when describing the planned change."
          name="submission_form_html"
          defaultValue={settings?.submission_form_html ?? ''}
        />

        <InstructionSection
          title="Document guidance"
          help="Shown next to the document upload: which plans, drawings, quotes or photos to attach."
          name="document_upload_html"
          defaultValue={settings?.document_upload_html ?? ''}
        />

        <div className="flex items-center gap-2 pt-2">
          <Button type="submit">Save settings</Button>
        </div>
      </form>
    </Workspace>
  );
}

function InstructionSection({
  title, help, name, defaultValue,
}: {
  title: string; help: string; name: string; defaultValue: string;
}) {
  return (
    <Section title={title} padded>
      <p id={`${name}-help`} className="mb-2 text-sm text-gray-600">{help}</p>
      <Textarea
        name={name}
        defaultValue={defaultValue}
        rows={5}
        aria-label={title}
        aria-describedby={`${name}-help`}
        className="block resize-y"
        maxLength={500}
      />
      <div className="mt-1 text-right text-xs text-gray-400">Plain text, up to 500 characters</div>
    </Section>
  );
}
