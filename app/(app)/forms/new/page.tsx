import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FormTemplateFields } from '@/components/forms/form-template-fields';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { saveFormTemplate } from '@/lib/rpcs/forms';

export const dynamic = 'force-dynamic';

export default async function NewFormTemplatePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;

  return (
    <DataWorkspace title="New form" description="Upload a form homeowners can download from the owner portal, or keep it for staff use." actions={<Link href="/forms"><Button variant="secondary">Back to forms</Button></Link>}>
      <form action={saveFormTemplate} className="max-w-2xl space-y-5 rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not create form:">{sp.error}</Alert>}
        <FormTemplateFields />
        <div className="flex items-center gap-3 border-t border-gray-100 pt-5">
          <Button type="submit">Create form</Button>
          <Link href="/forms"><Button type="button" variant="ghost">Cancel</Button></Link>
        </div>
      </form>
    </DataWorkspace>
  );
}
