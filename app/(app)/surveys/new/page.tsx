import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const TYPES = ['general', 'maintenance', 'leasing'];
const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default async function NewSurveyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;

  async function createSurvey(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const name = (formData.get('name') as string)?.trim();
    if (!name) redirect('/surveys/new?error=' + encodeURIComponent('Enter a survey name.'));
    const { error } = await (supabase as any).from('surveys').insert({
      portfolio_id: me.portfolio?.id,
      name,
      survey_type: (formData.get('survey_type') as string) || 'general',
      description: (formData.get('description') as string)?.trim() || null,
      questions: [],
      active: true,
      created_by: me.auth_user_id,
    });
    if (error) redirect('/surveys/new?error=' + encodeURIComponent(error.message));
    redirect('/surveys');
  }

  return (
    <DataWorkspace title="New Survey" description="Create a survey. You can add questions after it's created." actions={<Link href="/surveys"><Button variant="secondary">Back to surveys</Button></Link>}>
      <form action={createSurvey} className="max-w-2xl space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not create survey">{sp.error}</Alert>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div><Label htmlFor="name">Survey name <span className="text-red-500">*</span></Label><Input id="name" name="name" required placeholder="e.g. Annual resident satisfaction" /></div>
          <div>
            <Label htmlFor="survey_type">Type</Label>
            <select id="survey_type" name="survey_type" defaultValue="general" className={`${inputCls} capitalize`}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </div>
        </div>
        <div><Label htmlFor="description">Description</Label><textarea id="description" name="description" rows={3} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="What is this survey for?" /></div>
        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/surveys" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Create survey</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
