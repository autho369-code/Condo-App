import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FormTemplateFields } from '@/components/forms/form-template-fields';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { signFormFiles } from '@/lib/forms/files';
import { archiveFormTemplate, saveFormTemplate } from '@/lib/rpcs/forms';
import { PendingSubmit } from '@/components/ui/pending-submit';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditFormTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();

  const db = (await createClient()) as any;
  const { data: form } = await db.from('form_templates')
    .select('id, portfolio_id, name, description, form_type, audience, file_url, file_path, file_name, active')
    .eq('id', id).is('archived_at', null).maybeSingle();
  if (!form) notFound();
  const links = await signFormFiles([form]);

  return (
    <DataWorkspace title={form.name} description="Edit the form, replace its file, or take it out of the owner portal." actions={<Link href="/forms"><Button variant="secondary">Back to forms</Button></Link>}>
      <div className="max-w-2xl space-y-4">
        {sp.error && <Alert tone="danger" title="Could not save:">{sp.error}</Alert>}
        <form action={saveFormTemplate} className="space-y-5 rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <FormTemplateFields form={form} fileHref={links.get(form.id)} />
          <div className="flex items-center gap-3 border-t border-gray-100 pt-5">
            <Button type="submit">Save changes</Button>
            <Link href="/forms"><Button type="button" variant="ghost">Cancel</Button></Link>
          </div>
        </form>
        <form action={archiveFormTemplate} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:flex-row sm:items-center">
          <input type="hidden" name="id" value={form.id} />
          <p className="text-sm text-gray-600">Archive this form to remove it from the list and the owner portal.</p>
          <div className="sm:ml-auto"><PendingSubmit variant="danger" pendingLabel="Archiving…" confirm="Archive this form? Owners will no longer see it.">Archive form</PendingSubmit></div>
        </form>
      </div>
    </DataWorkspace>
  );
}
