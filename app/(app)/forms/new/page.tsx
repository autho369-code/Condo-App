import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewFormTemplatePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;

  async function createForm(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const name = (formData.get('name') as string)?.trim();
    if (!name) redirect('/forms/new?error=' + encodeURIComponent('Enter a form name.'));
    const { error } = await (supabase as any).from('form_templates').insert({
      portfolio_id: me.portfolio?.id,
      name,
      description: (formData.get('description') as string)?.trim() || null,
      form_type: (formData.get('form_type') as string)?.trim() || null,
      file_url: (formData.get('file_url') as string)?.trim() || null,
      active: true,
    });
    if (error) redirect('/forms/new?error=' + encodeURIComponent(error.message));
    redirect('/forms');
  }

  return (
    <DataWorkspace title="New Form" description="Add a form template owners or vendors can complete." actions={<Link href="/forms"><Button variant="secondary">Back to forms</Button></Link>}>
      <form action={createForm} className="max-w-2xl space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not create form">{sp.error}</Alert>}
        <div><Label htmlFor="name">Form name <span className="text-red-500">*</span></Label><Input id="name" name="name" required placeholder="e.g. Move-in inspection form" /></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div><Label htmlFor="form_type">Form type</Label><Input id="form_type" name="form_type" placeholder="e.g. inspection, intake" /></div>
          <div><Label htmlFor="file_url">File URL</Label><Input id="file_url" name="file_url" type="url" placeholder="Link to a PDF or doc (optional)" /></div>
        </div>
        <div><Label htmlFor="description">Description</Label><Input id="description" name="description" placeholder="Optional" /></div>
        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/forms" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Create form</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
